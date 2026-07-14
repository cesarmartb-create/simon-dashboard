-- =====================================================================
-- Validacion de Ajustes - 12: INVENTARIO (solo SELECT, no modifica nada).
--   Lo pega Cesar en el SQL Editor de Supabase y pega la salida de vuelta.
--   Con esta salida se escriben los SQL finales 13 (estado/columnas) y
--   14 (RLS). NADA de recrear policies a ciegas: 14 copia el texto
--   vigente de qual/with_check que devuelva la seccion 2.
--
-- OJO SQL Editor: al pegar varios SELECT juntos solo muestra el
--   resultado del ULTIMO. Correr de a uno (o resaltar cada bloque).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Check constraints de ajustes_inventario (nombre y definicion).
--    Buscamos el check de 'estado' (pendiente|realizado|anulado): el 13
--    lo dropea por NOMBRE y lo recrea agregando 'validado'.
-- ---------------------------------------------------------------------
select conname, pg_get_constraintdef(oid) as definicion
from pg_constraint
where conrelid = 'public.ajustes_inventario'::regclass
  and contype = 'c'
order by conname;

-- ---------------------------------------------------------------------
-- 2) Policies VIGENTES de ajustes_inventario (texto completo).
--    ajustes_select / ajustes_update / ajustes_insert: el 14 recrea
--    select y update copiando estas ramas + la rama ejecutor.
-- ---------------------------------------------------------------------
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'ajustes_inventario'
order by policyname;

-- ---------------------------------------------------------------------
-- 3) Columnas de ajustes_inventario (confirmar que validado_por y
--    fecha_validacion NO existen aun, y tipos de cerrado_por/fecha_cierre
--    para espejarlos).
-- ---------------------------------------------------------------------
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'ajustes_inventario'
order by ordinal_position;

-- ---------------------------------------------------------------------
-- 4) eventos: columnas (clave: ¿caso_id es NOT NULL? ¿existe ya ajuste_id?).
--    Define si el 13 debe relajar caso_id a nullable + check "exactamente
--    un padre", o solo agregar ajuste_id.
-- ---------------------------------------------------------------------
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'eventos'
order by ordinal_position;

-- ---------------------------------------------------------------------
-- 5) eventos: constraints y policies vigentes (el 14 agrega la herencia
--    desde ajustes_inventario sin romper la herencia desde casos).
-- ---------------------------------------------------------------------
select conname, contype, pg_get_constraintdef(oid) as definicion
from pg_constraint
where conrelid = 'public.eventos'::regclass
order by contype, conname;

select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'eventos'
order by policyname;

-- ---------------------------------------------------------------------
-- 6) Usuarios involucrados: Dyson (ejecutor), Carolina (filtro hoy),
--    Maria Andrea (filtro futuro / supervisa), qf de prueba FTEST.
--    Confirmar areas/areas_supervisa/activo reales antes de tocar nada.
-- ---------------------------------------------------------------------
select u.email, uc.rol, uc.local, uc.areas, uc.areas_supervisa, uc.activo
from public.usuarios_cliente uc
join auth.users u on u.id = uc.user_id
where uc.cliente_id = 'grupobaco'
  and lower(u.email) in (
    'dyson.gonzalez@grupobaco.cl',
    'carolina.armingol@jcsfarmacias.cl',
    'mandrea.pinzon@jcsfarmacias.cl',
    'empleado.mes@ftest.cl'
  )
order by u.email;

-- ---------------------------------------------------------------------
-- 7) Sanity: nadie tiene aun el area 'ajustes_ejecucion' (ni en areas ni
--    en areas_supervisa). Esperado: 0 filas.
-- ---------------------------------------------------------------------
select u.email, uc.areas, uc.areas_supervisa
from public.usuarios_cliente uc
join auth.users u on u.id = uc.user_id
where 'ajustes_ejecucion' = any(coalesce(uc.areas, '{}'::text[]))
   or 'ajustes_ejecucion' = any(coalesce(uc.areas_supervisa, '{}'::text[]));

-- ---------------------------------------------------------------------
-- 8) areas_derivacion: routing de correos de ajustes. Esperado: existe
--    'ajustes_inventario' (correo del filtro) y NO existe 'ajustes_ejecucion'
--    (se crea en Fase 4 via Configuracion -> Derivaciones).
-- ---------------------------------------------------------------------
select nombre, responsable_nombre, responsable_correo, orden, activo
from public.areas_derivacion
where cliente_id = 'grupobaco'
  and nombre in ('ajustes_inventario', 'ajustes_ejecucion');

-- ---------------------------------------------------------------------
-- 9) Sanity de datos: distribucion actual de estados (esperado: solo
--    pendiente/realizado/anulado) y cuantos hay del local de pruebas.
-- ---------------------------------------------------------------------
select estado, count(*) as n
from public.ajustes_inventario
where cliente_id = 'grupobaco'
group by estado
order by estado;

select local, estado, count(*) as n
from public.ajustes_inventario
where cliente_id = 'grupobaco' and local like 'FTEST%'
group by local, estado
order by local, estado;
