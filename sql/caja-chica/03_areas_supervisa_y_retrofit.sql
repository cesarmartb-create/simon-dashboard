-- =====================================================================
-- Caja Chica - 03: areas_supervisa + helper perfil_areas_supervisa() +
--   retrofit de visibilidad (ajustes_select y rendiciones_select) a
--   areas ∪ areas_supervisa.  Spec seccion 2b / 6 / 7 paso 4.
-- Transaccional. Lo pega Cesar. NO ejecutar aqui.
--
-- DECISION DE DISENO (inventario Paso 0):
--   perfil_actual() NO SE TOCA. Devuelve TABLE(cliente_id,rol,local,areas)
--   y tiene 26 politicas dependientes -> CREATE OR REPLACE no puede cambiar
--   su tipo de retorno y DROP esta bloqueado (CASCADE prohibido).
--   Via complementaria (opcion B aprobada): una funcion nueva
--   perfil_areas_supervisa() RETURNS text[], SECURITY DEFINER, compartida
--   por las politicas RLS y por lib/sesion.ts (via rpc).
--
-- REGLA: ver = area ∈ (areas ∪ areas_supervisa) ; gestionar = area ∈ areas.
--   Por eso 03 solo re-crea las politicas SELECT. Las de UPDATE/INSERT
--   (ajustes_update, ajustes_insert, rendiciones_update, rendiciones_insert)
--   NO se tocan: gestionar sigue dependiendo solo de 'areas'.
--
-- NULL-SAFETY (requisito): areas y areas_supervisa son nullable. El helper
--   coalesce internamente a '{}', y en las politicas se vuelve a envolver
--   con coalesce, de modo que  = ANY(...)  nunca dependa de NULL.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1) Nueva columna: clona el tipo de 'areas' (text[] / _text), nullable.
--    OJO: NO confundir con la columna legacy 'area' (text singular).
-- ---------------------------------------------------------------------
alter table public.usuarios_cliente
  add column if not exists areas_supervisa text[];

-- ---------------------------------------------------------------------
-- 2) Helper compartido (RLS + codigo). Espeja perfil_actual():
--    filtra activo = true, limit 1. Un usuario desactivado no conserva
--    visibilidad de supervision por ninguna via.
--    OJO: el coalesce es POR FILA. Con CERO filas (usuario inactivo/inexistente)
--    la funcion devuelve NULL, no '{}'. Por eso las politicas re-coalescean el
--    resultado (coalesce(perfil_areas_supervisa(),'{}')) y lib/sesion.ts trata
--    el NULL del rpc como [] al poblar Usuario.areas_supervisa.
-- ---------------------------------------------------------------------
create or replace function public.perfil_areas_supervisa()
  returns text[]
  language sql
  stable
  security definer
  set search_path = public
as $$
  select coalesce(areas_supervisa, '{}'::text[])
  from public.usuarios_cliente
  where user_id = auth.uid()
    and activo = true
  limit 1;
$$;

-- Ejecutable por sesiones autenticadas (lo llama lib/sesion.ts via rpc y las politicas).
grant execute on function public.perfil_areas_supervisa() to authenticated;

-- ---------------------------------------------------------------------
-- 3) RETROFIT ajustes_inventario.ajustes_select : gestor ve si el area esta
--    en areas ∪ areas_supervisa. admin y qf sin cambios. UPDATE/INSERT intactos.
--    CAMBIO CONSCIENTE SOBRE PRODUCCION.
-- ---------------------------------------------------------------------
drop policy if exists ajustes_select on public.ajustes_inventario;
create policy ajustes_select on public.ajustes_inventario
  for select to authenticated
  using (
    exists (
      select 1 from perfil_actual() p
      where p.cliente_id = ajustes_inventario.cliente_id
        and (
          p.rol = 'admin'
          or (
            p.rol = 'gestor'
            and 'ajustes_inventario' = any(
              coalesce(p.areas, '{}'::text[])
              || coalesce(public.perfil_areas_supervisa(), '{}'::text[])
            )
          )
          or (p.rol = 'qf' and p.local = ajustes_inventario.local)
        )
    )
  );

-- ---------------------------------------------------------------------
-- 4) RETROFIT rendiciones_caja_chica.rendiciones_select : sube a
--    areas ∪ areas_supervisa (en 02 quedo solo con 'areas'). Reemplaza
--    esa politica. rendiciones_update sigue en 'areas' (no se toca).
-- ---------------------------------------------------------------------
drop policy if exists rendiciones_select on public.rendiciones_caja_chica;
create policy rendiciones_select on public.rendiciones_caja_chica
  for select to authenticated
  using (
    exists (
      select 1 from perfil_actual() p
      where p.cliente_id = rendiciones_caja_chica.cliente_id
        and (
          p.rol = 'admin'
          or (
            p.rol = 'gestor'
            and 'caja_chica' = any(
              coalesce(p.areas, '{}'::text[])
              || coalesce(public.perfil_areas_supervisa(), '{}'::text[])
            )
          )
          or (p.rol = 'qf' and p.local = rendiciones_caja_chica.local)
        )
    )
  );

commit;

-- =====================================================================
-- VERIFICACION (correr DESPUES del commit; son solo SELECT)
-- =====================================================================
-- -- 1) La columna existe y es text[] nullable (y sigue la legacy 'area' aparte):
-- select column_name, data_type, udt_name, is_nullable
-- from information_schema.columns
-- where table_schema='public' and table_name='usuarios_cliente'
--   and column_name in ('area','areas','areas_supervisa')
-- order by column_name;
--
-- -- 2) El helper quedo SECURITY DEFINER + search_path fijo:
-- select p.proname,
--        p.prosecdef            as security_definer,
--        pg_get_function_result(p.oid) as retorno,
--        pg_get_functiondef(p.oid)     as definicion
-- from pg_proc p join pg_namespace n on n.oid=p.pronamespace
-- where n.nspname='public' and p.proname='perfil_areas_supervisa';
--
-- -- 3) Las dos SELECT recreadas mencionan perfil_areas_supervisa; las de
-- --    escritura (ajustes_update/insert, rendiciones_update/insert) NO:
-- select tablename, policyname, cmd,
--        (qual ilike '%perfil_areas_supervisa%') as usa_supervisa
-- from pg_policies
-- where schemaname='public'
--   and tablename in ('ajustes_inventario','rendiciones_caja_chica')
-- order by tablename, policyname;
--
-- -- 4) perfil_actual() intacto (mismo retorno de siempre, no se toco):
-- select pg_get_function_result(p.oid) as retorno
-- from pg_proc p join pg_namespace n on n.oid=p.pronamespace
-- where n.nspname='public' and p.proname='perfil_actual';
--
-- -- 5) Prueba funcional sugerida (en preview, con Maria Andrea:
-- --    areas=['operaciones'], areas_supervisa=['ajustes_inventario']):
-- --    debe VER todos los ajustes (SELECT) y NO poder realizar/anular (UPDATE).
