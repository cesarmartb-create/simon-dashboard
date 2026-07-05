-- =====================================================================
-- Caja Chica - 02: RLS de las 4 tablas + extension de adjuntos (gasto_id,
--   rendicion_id) + verificacion de Storage. Spec seccion 6 / 7 paso 3.
-- Transaccional. Lo pega Cesar. NO ejecutar aqui.
--
-- Convencion tomada del inventario (Paso 0): NO existen helpers auth_*.
--   Todas las politicas usan  perfil_actual()  inline, igual que casos y
--   ajustes_inventario en produccion. Replicamos EXACTAMENTE ese patron.
--
-- Null-safety (requisito): 'areas' es nullable. Toda comparacion usa
--   coalesce(p.areas,'{}') para que  = ANY(...)  nunca dependa de NULL.
--
-- La dimension de supervision (areas_supervisa) NO entra aqui: se agrega en
--   03, que RE-CREA rendiciones_select para sumar areas ∪ areas_supervisa.
--   En 02, rendiciones_select usa solo 'areas' (no puede referenciar una
--   columna/funcion que aun no existe). El estado final tras 01->02->03 es
--   el correcto.
-- =====================================================================

begin;

-- =====================================================================
-- A) RLS de las 4 tablas nuevas
-- =====================================================================

-- ---------------------------------------------------------------------
-- A.1 tipos_gasto : SELECT mismo cliente ; escritura solo admin
-- ---------------------------------------------------------------------
alter table public.tipos_gasto enable row level security;

drop policy if exists tipos_gasto_select on public.tipos_gasto;
create policy tipos_gasto_select on public.tipos_gasto
  for select to authenticated
  using (
    exists (
      select 1 from perfil_actual() p
      where p.cliente_id = tipos_gasto.cliente_id
    )
  );

drop policy if exists tipos_gasto_write on public.tipos_gasto;
create policy tipos_gasto_write on public.tipos_gasto
  for all to authenticated
  using (
    exists (
      select 1 from perfil_actual() p
      where p.cliente_id = tipos_gasto.cliente_id and p.rol = 'admin'
    )
  )
  with check (
    exists (
      select 1 from perfil_actual() p
      where p.cliente_id = tipos_gasto.cliente_id and p.rol = 'admin'
    )
  );

-- ---------------------------------------------------------------------
-- A.2 fondos_caja_chica : SELECT mismo cliente ; escritura solo admin
-- ---------------------------------------------------------------------
alter table public.fondos_caja_chica enable row level security;

drop policy if exists fondos_select on public.fondos_caja_chica;
create policy fondos_select on public.fondos_caja_chica
  for select to authenticated
  using (
    exists (
      select 1 from perfil_actual() p
      where p.cliente_id = fondos_caja_chica.cliente_id
    )
  );

drop policy if exists fondos_write on public.fondos_caja_chica;
create policy fondos_write on public.fondos_caja_chica
  for all to authenticated
  using (
    exists (
      select 1 from perfil_actual() p
      where p.cliente_id = fondos_caja_chica.cliente_id and p.rol = 'admin'
    )
  )
  with check (
    exists (
      select 1 from perfil_actual() p
      where p.cliente_id = fondos_caja_chica.cliente_id and p.rol = 'admin'
    )
  );

-- ---------------------------------------------------------------------
-- A.3 rendiciones_caja_chica
--   SELECT : admin (todo su cliente) / gestor con 'caja_chica' en areas /
--            qf solo su local.  (03 amplia a areas ∪ areas_supervisa)
--   INSERT : admin y qf (qf solo su local)
--   UPDATE : admin o gestor con 'caja_chica' en areas (supervision NO escribe)
--   Sin DELETE.
-- ---------------------------------------------------------------------
alter table public.rendiciones_caja_chica enable row level security;

drop policy if exists rendiciones_select on public.rendiciones_caja_chica;
create policy rendiciones_select on public.rendiciones_caja_chica
  for select to authenticated
  using (
    exists (
      select 1 from perfil_actual() p
      where p.cliente_id = rendiciones_caja_chica.cliente_id
        and (
          p.rol = 'admin'
          or (p.rol = 'gestor' and 'caja_chica' = any(coalesce(p.areas, '{}'::text[])))
          or (p.rol = 'qf' and p.local = rendiciones_caja_chica.local)
        )
    )
  );

drop policy if exists rendiciones_insert on public.rendiciones_caja_chica;
create policy rendiciones_insert on public.rendiciones_caja_chica
  for insert to authenticated
  with check (
    exists (
      select 1 from perfil_actual() p
      where p.cliente_id = rendiciones_caja_chica.cliente_id
        and (
          p.rol = 'admin'
          or (p.rol = 'qf' and p.local = rendiciones_caja_chica.local)
        )
    )
  );

drop policy if exists rendiciones_update on public.rendiciones_caja_chica;
create policy rendiciones_update on public.rendiciones_caja_chica
  for update to authenticated
  using (
    exists (
      select 1 from perfil_actual() p
      where p.cliente_id = rendiciones_caja_chica.cliente_id
        and (
          p.rol = 'admin'
          or (p.rol = 'gestor' and 'caja_chica' = any(coalesce(p.areas, '{}'::text[])))
        )
    )
  )
  with check (
    exists (
      select 1 from perfil_actual() p
      where p.cliente_id = rendiciones_caja_chica.cliente_id
    )
  );

-- ---------------------------------------------------------------------
-- A.4 gastos_caja_chica : hereda visibilidad del padre (EXISTS contra
--   rendiciones_caja_chica, que ya tiene RLS), igual que adjuntos/eventos.
--   SELECT : cliente propio + padre visible (cualquier estado).
--   INSERT : admin (cualquier estado) ; qf solo si el padre esta 'abierto'.
--   UPDATE : admin y gestor c/'caja_chica' (cualquier estado, incl.
--            'en_revision' = revision por linea) ; qf solo si padre 'abierto'.
--   DELETE : admin (cualquier estado) ; qf solo si el padre esta 'abierto'.
--   La cota de estado del qf es DEFENSA EN RLS: no espera a la API (Fase 2).
--   Por eso el EXISTS del padre va DENTRO de cada rama de rol (con la
--   condicion de estado solo en la rama qf), no como condicion comun.
-- ---------------------------------------------------------------------
alter table public.gastos_caja_chica enable row level security;

drop policy if exists gastos_select on public.gastos_caja_chica;
create policy gastos_select on public.gastos_caja_chica
  for select to authenticated
  using (
    exists (
      select 1 from perfil_actual() p
      where p.cliente_id = gastos_caja_chica.cliente_id
    )
    and exists (
      select 1 from public.rendiciones_caja_chica r
      where r.id = gastos_caja_chica.rendicion_id
    )
  );

drop policy if exists gastos_insert on public.gastos_caja_chica;
create policy gastos_insert on public.gastos_caja_chica
  for insert to authenticated
  with check (
    -- admin: puede agregar en cualquier estado del padre
    (
      exists (
        select 1 from perfil_actual() p
        where p.cliente_id = gastos_caja_chica.cliente_id and p.rol = 'admin'
      )
      and exists (
        select 1 from public.rendiciones_caja_chica r
        where r.id = gastos_caja_chica.rendicion_id
      )
    )
    -- qf: solo mientras la rendicion padre este 'abierto' (borrador)
    or (
      exists (
        select 1 from perfil_actual() p
        where p.cliente_id = gastos_caja_chica.cliente_id and p.rol = 'qf'
      )
      and exists (
        select 1 from public.rendiciones_caja_chica r
        where r.id = gastos_caja_chica.rendicion_id and r.estado = 'abierto'
      )
    )
  );

drop policy if exists gastos_update on public.gastos_caja_chica;
create policy gastos_update on public.gastos_caja_chica
  for update to authenticated
  using (
    -- admin: cualquier estado del padre
    (
      exists (
        select 1 from perfil_actual() p
        where p.cliente_id = gastos_caja_chica.cliente_id and p.rol = 'admin'
      )
      and exists (
        select 1 from public.rendiciones_caja_chica r
        where r.id = gastos_caja_chica.rendicion_id
      )
    )
    -- gestor con 'caja_chica' en areas: revision por linea (necesita 'en_revision')
    or (
      exists (
        select 1 from perfil_actual() p
        where p.cliente_id = gastos_caja_chica.cliente_id
          and p.rol = 'gestor'
          and 'caja_chica' = any(coalesce(p.areas, '{}'::text[]))
      )
      and exists (
        select 1 from public.rendiciones_caja_chica r
        where r.id = gastos_caja_chica.rendicion_id
      )
    )
    -- qf: solo mientras la rendicion padre este 'abierto' (borrador)
    or (
      exists (
        select 1 from perfil_actual() p
        where p.cliente_id = gastos_caja_chica.cliente_id and p.rol = 'qf'
      )
      and exists (
        select 1 from public.rendiciones_caja_chica r
        where r.id = gastos_caja_chica.rendicion_id and r.estado = 'abierto'
      )
    )
  )
  with check (
    exists (
      select 1 from perfil_actual() p
      where p.cliente_id = gastos_caja_chica.cliente_id
    )
  );

drop policy if exists gastos_delete on public.gastos_caja_chica;
create policy gastos_delete on public.gastos_caja_chica
  for delete to authenticated
  using (
    -- admin: cualquier estado del padre
    (
      exists (
        select 1 from perfil_actual() p
        where p.cliente_id = gastos_caja_chica.cliente_id and p.rol = 'admin'
      )
      and exists (
        select 1 from public.rendiciones_caja_chica r
        where r.id = gastos_caja_chica.rendicion_id
      )
    )
    -- qf: solo mientras la rendicion padre este 'abierto' (borrador)
    or (
      exists (
        select 1 from perfil_actual() p
        where p.cliente_id = gastos_caja_chica.cliente_id and p.rol = 'qf'
      )
      and exists (
        select 1 from public.rendiciones_caja_chica r
        where r.id = gastos_caja_chica.rendicion_id and r.estado = 'abierto'
      )
    )
  );

-- =====================================================================
-- B) Extension de adjuntos para boletas (gasto_id) y comprobantes (rendicion_id)
--    Se clona el patron caso_id / ajuste_id (uuid nullable) y se AMPLIAN
--    adjuntos_select y adjuntos_insert con dos ramas OR nuevas.
--    adjuntos_delete NO cambia (admin + cliente, ya es agnostico a la entidad).
--    CAMBIO CONSCIENTE SOBRE PRODUCCION: re-crea 2 politicas vivas de adjuntos.
--
--    NOTA (debio detectarse aqui): adjuntos tiene ademas un CHECK preexistente
--    (adjuntos_check) que exigia EXACTAMENTE UNO entre caso_id/ajuste_id. Con
--    solo agregar las columnas gasto_id/rendicion_id ese check SIGUE bloqueando
--    toda fila con los padres nuevos. El Paso 0 no lo capturo (miramos politicas
--    y columnas, no constraints). Se corrige aparte en 05_fix_adjuntos_check.sql
--    (num_nonnulls(caso_id, ajuste_id, gasto_id, rendicion_id) = 1). Sin el 05,
--    subir boletas/comprobantes falla con violacion de adjuntos_check.
-- =====================================================================
alter table public.adjuntos add column if not exists gasto_id     uuid;
alter table public.adjuntos add column if not exists rendicion_id uuid;

-- FKs (idempotentes): las tablas padre existen desde 01.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'adjuntos_gasto_id_fkey'
  ) then
    alter table public.adjuntos
      add constraint adjuntos_gasto_id_fkey
      foreign key (gasto_id) references public.gastos_caja_chica(id) on delete cascade;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'adjuntos_rendicion_id_fkey'
  ) then
    alter table public.adjuntos
      add constraint adjuntos_rendicion_id_fkey
      foreign key (rendicion_id) references public.rendiciones_caja_chica(id) on delete cascade;
  end if;
end $$;

-- SELECT: cliente propio + alguno de los 4 padres visibles.
drop policy if exists adjuntos_select on public.adjuntos;
create policy adjuntos_select on public.adjuntos
  for select to authenticated
  using (
    exists (
      select 1 from perfil_actual() p where p.cliente_id = adjuntos.cliente_id
    )
    and (
      (caso_id      is not null and exists (select 1 from public.casos c                  where c.id = adjuntos.caso_id))
      or (ajuste_id  is not null and exists (select 1 from public.ajustes_inventario a      where a.id = adjuntos.ajuste_id))
      or (gasto_id   is not null and exists (select 1 from public.gastos_caja_chica g       where g.id = adjuntos.gasto_id))
      or (rendicion_id is not null and exists (select 1 from public.rendiciones_caja_chica r where r.id = adjuntos.rendicion_id))
    )
  );

-- INSERT: mismas 4 ramas de padre visible + cliente propio.
drop policy if exists adjuntos_insert on public.adjuntos;
create policy adjuntos_insert on public.adjuntos
  for insert to authenticated
  with check (
    exists (
      select 1 from perfil_actual() p where p.cliente_id = adjuntos.cliente_id
    )
    and (
      (caso_id      is not null and exists (select 1 from public.casos c                  where c.id = adjuntos.caso_id))
      or (ajuste_id  is not null and exists (select 1 from public.ajustes_inventario a      where a.id = adjuntos.ajuste_id))
      or (gasto_id   is not null and exists (select 1 from public.gastos_caja_chica g       where g.id = adjuntos.gasto_id))
      or (rendicion_id is not null and exists (select 1 from public.rendiciones_caja_chica r where r.id = adjuntos.rendicion_id))
    )
  );

-- adjuntos_delete: SIN CAMBIOS (solo admin del cliente; ya cubre las nuevas filas).

commit;

-- =====================================================================
-- C) STORAGE  (bucket 'adjuntos') : NO REQUIERE CAMBIOS
-- =====================================================================
-- Inventario Paso 0: las 3 politicas del bucket exigen
--   (storage.foldername(name))[1] = cliente_id  (scope por cliente).
-- Las boletas y comprobantes de caja chica se guardan bajo el MISMO primer
-- segmento del cliente, con la convencion existente construirRuta():
--     {cliente_id}/gastos/{gasto_id}/{uuid}-archivo        (boleta del gasto)
--     {cliente_id}/rendiciones/{rendicion_id}/{uuid}-archivo (comprobante)
-- Como el scope es por primer segmento, ambos prefijos ya quedan cubiertos.
-- No se toca Storage en esta fase.  (Verificacion en la matriz, punto 9.)

-- =====================================================================
-- D) MATRIZ DE PRUEBAS (correr en preview, por API REST directa y por UI)
--    Usuarios: admin (Cesar) / gestor c/'caja_chica' en areas /
--    gestor SIN el area / qf de local A / usuario FTEST (otro cliente).
-- =====================================================================
-- | #  | Escenario                                          | admin | gestor caja_chica | gestor s/area | qf A | FTEST |
-- |----|----------------------------------------------------|-------|-------------------|---------------|------|-------|
-- | 1  | Leer rendiciones de su local (A)                   |  si   | si (todas)        | no            | siA  | no    |
-- | 2  | Leer rendiciones de OTRO local (B)                 |  si   | si                | no            | no   | no    |
-- | 3  | Crear rendicion en su local                        |  si   | no                | no            | siA  | no    |
-- | 4  | Actualizar rendicion (revisar/pagar)               |  si   | si                | no            | no   | no    |
-- | 5  | Insertar gasto, rendicion 'abierto'                |  si   | no*               | no            | siA  | no    |
-- | 5b | Insertar gasto, rendicion 'en_revision' o posterior|  si   | no*               | no            | NO   | no    |
-- | 6  | Editar gasto (datos), rendicion 'abierto'          |  si   | -                 | no            | siA  | no    |
-- | 6b | qf edita gasto, rendicion 'en_revision' o posterior|  si   | -                 | no            | NO   | no    |
-- | 6c | Aprobar/rechazar gasto (update), 'en_revision'     |  si   | SI                | no            | NO   | no    |
-- | 7  | Borrar gasto, rendicion 'abierto'                  |  si   | no                | no            | siA  | no    |
-- | 7b | Borrar gasto, rendicion 'en_revision' o posterior  |  si   | no                | no            | NO   | no    |
-- | 8  | Leer/editar tipos_gasto                            | rd+wr | rd                | rd            | rd   | no    |
-- | 9  | Leer/editar fondos_caja_chica                     | rd+wr | rd                | rd            | rd   | no    |
-- | 10 | Leer adjunto (boleta) de gasto visible             |  si   | si                | no            | siA  | no    |
-- | 11 | Subir boleta a gasto visible                       |  si   | via qf/admin      | no            | siA  | no    |
-- | 12 | Borrar adjunto                                     |  si   | no                | no            | no   | no    |
-- | 13 | Storage: leer objeto {clienteB}/...                |  no   | no                | no            | no   | no    |
--    (*) el gestor de caja_chica revisa/paga; no crea gastos: eso es del qf/admin.
--    Clave de la correccion (#1): el qf pierde insert/update/delete de gastos en
--    cuanto la rendicion sale de 'abierto'; el gestor SI actualiza en 'en_revision'
--    (aprobar/rechazar por linea). Es defensa en RLS, no depende de la API (Fase 2).
--
-- Prueba de fuga (la importante), logueado como qf de A, por REST directa:
--   GET /rest/v1/rendiciones_caja_chica?select=*   -> SOLO local A
--   GET /rest/v1/gastos_caja_chica?select=*        -> SOLO gastos de A
--   GET /rest/v1/adjuntos?select=*                 -> SOLO adjuntos visibles de A
--   GET /rest/v1/tipos_gasto?select=*              -> catalogo de su cliente
--
-- Verificacion de que las politicas quedaron aplicadas (solo SELECT):
-- select tablename, policyname, cmd
-- from pg_policies
-- where schemaname = 'public'
--   and tablename in ('tipos_gasto','fondos_caja_chica',
--                     'rendiciones_caja_chica','gastos_caja_chica','adjuntos')
-- order by tablename, policyname;
--
-- Verificacion de las columnas nuevas en adjuntos:
-- select column_name, data_type, is_nullable
-- from information_schema.columns
-- where table_schema='public' and table_name='adjuntos'
--   and column_name in ('gasto_id','rendicion_id');
--
-- Verificacion de RLS habilitada en las 4 tablas:
-- select relname, relrowsecurity
-- from pg_class
-- where relnamespace='public'::regnamespace
--   and relname in ('tipos_gasto','fondos_caja_chica',
--                   'rendiciones_caja_chica','gastos_caja_chica');
