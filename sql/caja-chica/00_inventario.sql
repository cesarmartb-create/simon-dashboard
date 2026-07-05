-- =====================================================================
-- Caja Chica - Paso 0: INVENTARIO (solo lectura, no modifica nada)
-- Objetivo: capturar nombres exactos de politicas y helpers ya aplicados
-- (03-jul) para escribir 02_rls.sql y 03_areas_supervisa_y_retrofit.sql
-- con los nombres reales y sin pisar lo que ya funciona en 'casos'.
-- Correr en el SQL Editor de Supabase y pegar la salida COMPLETA.
-- No es transaccional: son puros SELECT.
-- =====================================================================

-- 1. RLS habilitada por tabla (public)
select relname, relrowsecurity
from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r'
order by relname;

-- 2. Todas las politicas actuales de public
--    (incluye las de 'casos' = plantilla, y ajustes_inventario/tipos_ajuste/adjuntos)
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- 3. Definicion completa de perfil_actual() y de los helpers auth_* (¿existen? ¿SECURITY DEFINER?)
select p.proname,
       pg_get_functiondef(p.oid) as definicion
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'perfil_actual',
    'auth_cliente_id','auth_rol','auth_local','auth_areas','auth_areas_supervisa'
  )
order by p.proname;

-- 4. Politicas del bucket de Storage (para confirmar si el scope por cliente
--    ya cubre los prefijos gastos/ y rendiciones/ sin tocar nada)
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;

-- 5. Columnas de la tabla adjuntos (para el ALTER que agrega gasto_id / rendicion_id)
select column_name, data_type, udt_name, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'adjuntos'
order by ordinal_position;

-- 6. Prevencion para el 03: ¿algo depende directamente de perfil_actual()?
--    Si nada la referencia (las politicas deberian usar los helpers auth_*),
--    es seguro hacer DROP FUNCTION + CREATE si cambia el tipo de retorno.

-- 6a. Politicas (public + storage) que mencionan perfil_actual en su definicion:
select schemaname, tablename, policyname, cmd
from pg_policies
where schemaname in ('public','storage')
  and (coalesce(qual,'') ilike '%perfil_actual%'
       or coalesce(with_check,'') ilike '%perfil_actual%')
order by schemaname, tablename, policyname;

-- 6b. Otras funciones/vistas cuyo cuerpo referencia perfil_actual():
select p.proname, n.nspname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname <> 'perfil_actual'
  and pg_get_functiondef(p.oid) ilike '%perfil_actual%'
order by p.proname;

-- 6c. Firma y tipo de retorno actual de perfil_actual()
--     (define si CREATE OR REPLACE basta o hay que DROP + CREATE)
select p.proname,
       pg_get_function_identity_arguments(p.oid) as argumentos,
       pg_get_function_result(p.oid)            as retorno
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'perfil_actual';

-- 7. Columnas de usuarios_cliente
--    (confirmar tipo exacto de 'areas' y que 'areas_supervisa' NO exista aun)
select column_name, data_type, udt_name, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'usuarios_cliente'
order by ordinal_position;
