-- =====================================================================
-- Validacion de Ajustes - 14: RLS del ejecutor (area 'ajustes_ejecucion')
--   + herencia de eventos desde ajustes. Escrito CONTRA el texto literal
--   de pg_policies del SQL 12 (Bloque 2 y 5b). Transaccional. Lo pega
--   Cesar en Supabase, DESPUES del 13. NO ejecutar aqui.
--
-- INERTE HOY: nadie tiene 'ajustes_ejecucion' (Bloque 7 = 0 filas), asi
--   que las ramas nuevas no matchean a ningun usuario hasta la Fase 5.
--   Las ramas vigentes de admin / gestor-filtro / qf se preservan
--   LITERALES del Bloque 2 (incluida la llamada perfil_areas_supervisa()
--   del select y el any(p.areas) SIN coalesce del using de update).
--
-- CORRECCION CRITICA (revision de Cesar): el WITH CHECK vigente de
--   ajustes_update solo valida cliente_id. Si se preservara tal cual,
--   las policies permisivas se combinan con OR y el ejecutor pasaria el
--   USING por su rama (estado='validado') y el WITH CHECK por la rama
--   laxa, pudiendo escribir CUALQUIER estado via REST directa (anulado,
--   o de vuelta a pendiente). Por eso el WITH CHECK recreado queda
--   RAMIFICADO POR ROL:
--     (admin o gestor con 'ajustes_inventario' -> cliente match, igual
--      que su comportamiento efectivo actual: quien pasa el USING de
--      esas ramas es exactamente quien pasa esta)
--     OR
--     (gestor con 'ajustes_ejecucion' -> ademas fila nueva con
--      estado='realizado'; junto al USING estado='validado', la unica
--      transicion posible para el ejecutor es validado -> realizado).
--   Patron USING(estado viejo) / WITH CHECK(estado nuevo) ya probado en
--   caja chica (04_rls_transiciones.sql, rama qf).
--
-- EVENTOS ({public} vs authenticated): las policies vigentes de eventos
--   son roles={public} (Bloque 5b). NO se tocan. Se AGREGAN dos policies
--   nuevas solo para filas con ajuste_id, con rol 'to authenticated':
--   (a) las permisivas del mismo comando se combinan con OR, asi que no
--       hace falta recrear las de casos; para filas de ajuste, la policy
--       vieja evalua EXISTS con caso_id NULL -> false -> no filtra nada
--       de ajustes ni deja pasar nada indebido;
--   (b) 'authenticated' espeja el estilo de las policies de
--       ajustes_inventario (Bloque 2) y no regala visibilidad al rol
--       anon (que igual no tiene perfil, pero mejor cerrado por rol).
--   La visibilidad/insercion hereda del padre via EXISTS contra
--   ajustes_inventario (mismo patron que adjuntos y que eventos<-casos):
--   quien puede VER el ajuste puede leer/insertar sus eventos. El
--   ejecutor solo ve validado/realizado -> solo lee esos timelines.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1) ajustes_select: ramas vigentes intactas + rama ejecutor, que solo
--    alcanza filas en estado 'validado' o 'realizado'. El ejecutor NO ve
--    'pendiente' ni 'anulado' (forzado por RLS, no solo UI).
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
              || coalesce(perfil_areas_supervisa(), '{}'::text[])
            )
          )
          or (
            p.rol = 'gestor'
            and 'ajustes_ejecucion' = any(coalesce(p.areas, '{}'::text[]))
            and ajustes_inventario.estado in ('validado', 'realizado')
          )
          or (p.rol = 'qf' and p.local = ajustes_inventario.local)
        )
    )
  );

-- ---------------------------------------------------------------------
-- 2) ajustes_update: USING agrega la rama ejecutor SOLO sobre filas
--    'validado'; WITH CHECK ramificado por rol (ver correccion critica
--    arriba). ajustes_insert NO se toca.
-- ---------------------------------------------------------------------
drop policy if exists ajustes_update on public.ajustes_inventario;
create policy ajustes_update on public.ajustes_inventario
  for update to authenticated
  using (
    exists (
      select 1 from perfil_actual() p
      where p.cliente_id = ajustes_inventario.cliente_id
        and (
          p.rol = 'admin'
          or (p.rol = 'gestor' and 'ajustes_inventario' = any(p.areas))
        )
    )
    or (
      exists (
        select 1 from perfil_actual() p
        where p.cliente_id = ajustes_inventario.cliente_id
          and p.rol = 'gestor'
          and 'ajustes_ejecucion' = any(coalesce(p.areas, '{}'::text[]))
      )
      and ajustes_inventario.estado = 'validado'
    )
  )
  with check (
    exists (
      select 1 from perfil_actual() p
      where p.cliente_id = ajustes_inventario.cliente_id
        and (
          p.rol = 'admin'
          or (p.rol = 'gestor' and 'ajustes_inventario' = any(p.areas))
        )
    )
    or (
      exists (
        select 1 from perfil_actual() p
        where p.cliente_id = ajustes_inventario.cliente_id
          and p.rol = 'gestor'
          and 'ajustes_ejecucion' = any(coalesce(p.areas, '{}'::text[]))
      )
      and ajustes_inventario.estado = 'realizado'
    )
  );

-- ---------------------------------------------------------------------
-- 3) eventos: herencia desde ajustes para filas con ajuste_id. Las dos
--    policies {public} de casos quedan INTACTAS. Nota consciente: igual
--    que en casos, cualquier usuario que VE el padre podria insertar un
--    evento via REST (patron de la casa, visibilidad-based); el tipo
--    queda acotado por eventos_tipo_check.
-- ---------------------------------------------------------------------
drop policy if exists eventos_ajuste_select on public.eventos;
create policy eventos_ajuste_select on public.eventos
  for select to authenticated
  using (
    ajuste_id is not null
    and exists (
      select 1 from public.ajustes_inventario a
      where a.id = eventos.ajuste_id
    )
  );

drop policy if exists eventos_ajuste_insert on public.eventos;
create policy eventos_ajuste_insert on public.eventos
  for insert to authenticated
  with check (
    ajuste_id is not null
    and exists (
      select 1 from public.ajustes_inventario a
      where a.id = eventos.ajuste_id
    )
  );

commit;

-- =====================================================================
-- VERIFICACION (correr DESPUES del commit, de a uno; no confiar en
-- "Success. No rows returned").
-- =====================================================================

-- V1: policies de ajustes_inventario. Esperado 3 filas:
--   ajustes_insert  -> INTACTA (with_check igual al Bloque 2 del SQL 12)
--   ajustes_select  -> qual menciona 'ajustes_ejecucion', la lista
--                      ('validado','realizado') y CONSERVA la llamada a
--                      perfil_areas_supervisa()
--   ajustes_update  -> qual menciona 'ajustes_ejecucion' + estado
--                      'validado'; with_check YA NO es solo cliente_id:
--                      ramifica admin/'ajustes_inventario' vs ejecutor
--                      con estado 'realizado'
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'ajustes_inventario'
order by policyname;

-- V2: policies de eventos. Esperado 4 filas:
--   eventos_insert / eventos_select        -> {public}, INTACTAS (solo caso_id)
--   eventos_ajuste_insert / eventos_ajuste_select -> {authenticated},
--                                             EXISTS contra ajustes_inventario
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'eventos'
order by policyname;

-- V3: resumen booleano rapido (una sola fila, todo debe dar true).
select
  (select count(*) = 3 from pg_policies
    where schemaname = 'public' and tablename = 'ajustes_inventario')          as tres_policies_ajustes,
  (select qual like '%ajustes_ejecucion%' and qual like '%perfil_areas_supervisa%'
    from pg_policies where schemaname = 'public'
      and tablename = 'ajustes_inventario' and policyname = 'ajustes_select')  as select_ok,
  (select qual like '%validado%' and with_check like '%realizado%'
         and with_check like '%ajustes_inventario%'
    from pg_policies where schemaname = 'public'
      and tablename = 'ajustes_inventario' and policyname = 'ajustes_update')  as update_ok,
  (select count(*) = 4 from pg_policies
    where schemaname = 'public' and tablename = 'eventos')                     as cuatro_policies_eventos;
