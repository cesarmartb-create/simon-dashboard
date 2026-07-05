-- =====================================================================
-- Caja Chica - 04: cierra 2 hoyos de RLS del contrato del PATCH.
--   A) rama qf en rendiciones_update (editar cabecera + enviar).
--   B) cerrar_rendicion() SECURITY DEFINER: cierre atomico (validar,
--      total, estado final, arrastre de rechazados, fechas).
-- Incremental: se corre DESPUES de 01, 02 y 03 (ya aplicados).
-- Transaccional. Lo pega Cesar. NO ejecutar aqui.
-- Null-safety: coalesce(p.areas,'{}') como en 02/03.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- A) rendiciones_update : se AGREGA la rama qf. admin y gestor(caja_chica)
--    sin cambios. qf puede editar cabecera y enviar, sin saltarse estados:
--      USING (fila vieja): su local + estado actual 'abierto'.
--      WITH CHECK (fila nueva): su cliente/local + estado en
--        ('abierto','en_revision')  -> editar borrador o enviar, nada mas.
--    CAMBIO CONSCIENTE sobre produccion (tabla Fase 1, sin datos aun).
-- ---------------------------------------------------------------------
drop policy if exists rendiciones_update on public.rendiciones_caja_chica;
create policy rendiciones_update on public.rendiciones_caja_chica
  for update to authenticated
  using (
    exists (select 1 from perfil_actual() p
            where p.cliente_id = rendiciones_caja_chica.cliente_id and p.rol = 'admin')
    or exists (select 1 from perfil_actual() p
            where p.cliente_id = rendiciones_caja_chica.cliente_id
              and p.rol = 'gestor'
              and 'caja_chica' = any(coalesce(p.areas, '{}'::text[])))
    or (
      exists (select 1 from perfil_actual() p
              where p.cliente_id = rendiciones_caja_chica.cliente_id
                and p.rol = 'qf' and p.local = rendiciones_caja_chica.local)
      and rendiciones_caja_chica.estado = 'abierto'
    )
  )
  with check (
    exists (select 1 from perfil_actual() p
            where p.cliente_id = rendiciones_caja_chica.cliente_id
              and (p.rol = 'admin'
                   or (p.rol = 'gestor'
                       and 'caja_chica' = any(coalesce(p.areas, '{}'::text[])))))
    or (
      exists (select 1 from perfil_actual() p
              where p.cliente_id = rendiciones_caja_chica.cliente_id
                and p.rol = 'qf' and p.local = rendiciones_caja_chica.local)
      and rendiciones_caja_chica.estado in ('abierto', 'en_revision')
    )
  );

-- ---------------------------------------------------------------------
-- B) cerrar_rendicion(): valida al llamador via perfil_actual() (admin o
--    gestor con 'caja_chica' en areas) y ejecuta atomicamente el cierre.
--    SECURITY DEFINER => la creacion del borrador y el movimiento de
--    gastos no dependen de rendiciones_insert/gastos_update (quedan intactas).
--    DEBE llamarse con el cliente Supabase de SESION del usuario (auth.uid()
--    real); con service role auth.uid() es null y devuelve sin_perfil.
--    aprobado_por = email del JWT del llamador.
--    Excepciones (las mapea la API a HTTP): sin_perfil, rendicion_no_encontrada,
--    otro_cliente, no_autorizado, estado_invalido, gastos_pendientes.
-- ---------------------------------------------------------------------
create or replace function public.cerrar_rendicion(
  p_rendicion_id uuid,
  p_observacion  text default null
) returns text
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_cliente     text;
  v_rol         text;
  v_areas       text[];
  v_r_cliente   text;
  v_local       text;
  v_periodo     text;
  v_estado      text;
  v_local_corr  text;
  v_reportado   text;
  v_pendientes  int;
  v_aprobados   int;
  v_rechazados  int;
  v_total       numeric;
  v_final       text;
  v_borrador    uuid;
  v_next_num    int;
begin
  -- 1) Perfil del llamador
  select cliente_id, rol, areas into v_cliente, v_rol, v_areas
  from perfil_actual() limit 1;
  if v_cliente is null then
    raise exception 'sin_perfil';
  end if;

  -- 2) Cargar y bloquear la rendicion
  select cliente_id, local, periodo, estado, local_correo, reportado_por
    into v_r_cliente, v_local, v_periodo, v_estado, v_local_corr, v_reportado
  from rendiciones_caja_chica
  where id = p_rendicion_id
  for update;
  if not found then
    raise exception 'rendicion_no_encontrada';
  end if;
  if v_r_cliente <> v_cliente then
    raise exception 'otro_cliente';
  end if;

  -- 3) Autorizacion: admin o gestor con caja_chica en areas
  if not (v_rol = 'admin'
          or (v_rol = 'gestor'
              and 'caja_chica' = any(coalesce(v_areas, '{}'::text[])))) then
    raise exception 'no_autorizado';
  end if;

  -- 4) Solo desde en_revision
  if v_estado <> 'en_revision' then
    raise exception 'estado_invalido';
  end if;

  -- 5) Conteos + total de aprobados
  select count(*) filter (where estado = 'pendiente'),
         count(*) filter (where estado = 'aprobado'),
         count(*) filter (where estado = 'rechazado'),
         coalesce(sum(monto) filter (where estado = 'aprobado'), 0)
    into v_pendientes, v_aprobados, v_rechazados, v_total
  from gastos_caja_chica
  where rendicion_id = p_rendicion_id;

  if v_pendientes > 0 then
    raise exception 'gastos_pendientes';
  end if;

  -- 6) Estado final
  if v_aprobados = 0 then
    v_final := 'rechazada';
  elsif v_rechazados = 0 then
    v_final := 'aprobada';
  else
    v_final := 'aprobada_parcial';
  end if;

  -- 7) Arrastre de rechazados (si hay)
  if v_rechazados > 0 then
    -- borrador abierto de la unidad (uno por unidad, cualquier periodo)
    select id into v_borrador
    from rendiciones_caja_chica
    where cliente_id = v_cliente and local = v_local and estado = 'abierto'
    order by created_at
    limit 1
    for update;

    if v_borrador is null then
      select coalesce(max(numero), 0) + 1 into v_next_num
      from rendiciones_caja_chica
      where cliente_id = v_cliente and local = v_local and periodo = v_periodo;

      insert into rendiciones_caja_chica
        (cliente_id, local, local_correo, reportado_por, periodo, numero, estado)
      values
        (v_cliente, v_local, v_local_corr, v_reportado, v_periodo, v_next_num, 'abierto')
      returning id into v_borrador;
    end if;

    -- mover los rechazados: reset a pendiente, conserva datos, adjunto
    -- (misma fila => mismo gasto_id) y observacion_rechazo (como pista).
    update gastos_caja_chica
    set rendicion_id = v_borrador,
        estado = 'pendiente'
    where rendicion_id = p_rendicion_id and estado = 'rechazado';

    -- recalcular el total del borrador DESTINO (suma de TODOS sus gastos,
    -- convencion 'abierto') tras recibir los arrastrados.
    update rendiciones_caja_chica
    set total = (
          select coalesce(sum(monto), 0)
          from gastos_caja_chica
          where rendicion_id = v_borrador
        ),
        updated_at = now()
    where id = v_borrador;
  end if;

  -- 8) Cerrar la rendicion origen (total = suma de APROBADOS)
  update rendiciones_caja_chica
  set estado             = v_final,
      total              = v_total,
      aprobado_por       = (auth.jwt() ->> 'email'),
      fecha_aprobacion   = now(),
      observacion_cierre = p_observacion,
      updated_at         = now()
  where id = p_rendicion_id;

  return v_final;
end;
$$;

-- Hardening: nadie ejecuta la RPC salvo sesiones autenticadas.
revoke execute on function public.cerrar_rendicion(uuid, text) from public, anon;
grant  execute on function public.cerrar_rendicion(uuid, text) to authenticated;

commit;

-- =====================================================================
-- VERIFICACION (correr DESPUES del commit)
-- =====================================================================
-- -- 1) rendiciones_update tiene rama qf (qual menciona rol 'qf' y estado):
-- select policyname, cmd, qual, with_check
-- from pg_policies
-- where schemaname='public' and tablename='rendiciones_caja_chica'
--   and policyname='rendiciones_update';
--
-- -- 2) La funcion quedo SECURITY DEFINER + search_path fijo, y sin execute
-- --    para public/anon (solo authenticated):
-- select proname, prosecdef, pg_get_function_result(oid) as retorno
-- from pg_proc p join pg_namespace n on n.oid=p.pronamespace
-- where n.nspname='public' and proname='cerrar_rendicion';
-- select grantee, privilege_type
-- from information_schema.routine_privileges
-- where routine_schema='public' and routine_name='cerrar_rendicion';
--
-- -- 3) Prueba funcional (en preview): rendicion 'en_revision' con 1 aprobado
-- --    (monto 1000) y 1 rechazado (monto 500) -> cerrar_rendicion:
-- --      * devuelve 'aprobada_parcial'
-- --      * origen: total = 1000, fecha_aprobacion / aprobado_por seteados
-- --      * el rechazado aparece 'pendiente' en el borrador abierto de la unidad
-- --      * total del borrador destino = suma de sus gastos (incluye el 500)
