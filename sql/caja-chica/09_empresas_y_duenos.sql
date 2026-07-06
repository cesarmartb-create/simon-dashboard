-- =====================================================================
-- Caja Chica - 09: empresas del holding (empresa por gasto) + rama
--   "dueno de unidad" en la RLS (cualquier rol cuyo p.local coincida con
--   el local de la rendicion puede crear/cargar/enviar SU rendicion).
-- Incremental: se corre DESPUES de 01-08. Transaccional. Lo pega Cesar.
-- NO ejecutar aqui. perfil_actual() NO se toca; sin CASCADE.
--
-- SEGURIDAD (precisiones):
--  1) La rama dueno de rendiciones_insert exige estado='abierto' en el
--     WITH CHECK (no se puede insertar directo en_revision/pagado por REST).
--  2) TODAS las ramas dueno anclan p.cliente_id = <tabla>.cliente_id ademas
--     del match de local (dos clientes podrian tener locales homonimos).
--  3) Cotas de estado identicas a la rama qf actual: padre 'abierto' para
--     escribir gastos; enviar solo abierto->en_revision.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- A) empresas (catalogo del holding, gemela de tipos_gasto)
-- ---------------------------------------------------------------------
create table if not exists public.empresas (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  text not null,
  codigo      text not null,
  nombre      text not null,
  activo      boolean not null default true,
  orden       int,
  created_at  timestamptz not null default now(),
  unique (cliente_id, codigo)
);

alter table public.empresas enable row level security;

drop policy if exists empresas_select on public.empresas;
create policy empresas_select on public.empresas
  for select to authenticated
  using (
    exists (select 1 from perfil_actual() p where p.cliente_id = empresas.cliente_id)
  );

drop policy if exists empresas_write on public.empresas;
create policy empresas_write on public.empresas
  for all to authenticated
  using (
    exists (select 1 from perfil_actual() p
            where p.cliente_id = empresas.cliente_id and p.rol = 'admin')
  )
  with check (
    exists (select 1 from perfil_actual() p
            where p.cliente_id = empresas.cliente_id and p.rol = 'admin')
  );

-- Seed de las 5 empresas del holding (grupobaco), idempotente.
insert into public.empresas (cliente_id, codigo, nombre, orden) values
  ('grupobaco', 'jcs',      'J Carolina Salazar SpA',   1),
  ('grupobaco', 'fsalazar', 'Farmaceutica Salazar SpA', 2),
  ('grupobaco', 'fcastro',  'Farmaceutica Castro SpA',  3),
  ('grupobaco', 'cokoa',    'Sociedad Cokoa SpA',       4),
  ('grupobaco', 'storia',   'Sociedad Storia SpA',      5)
on conflict (cliente_id, codigo) do nothing;

-- ---------------------------------------------------------------------
-- B) empresa por gasto (nullable)
-- ---------------------------------------------------------------------
alter table public.gastos_caja_chica
  add column if not exists empresa_id uuid references public.empresas(id);

-- =====================================================================
-- C) Rama "dueno de unidad" en la RLS. Se recrean solo las politicas
--    necesarias; admin y la rama gestor-con-area quedan igual.
-- =====================================================================

-- ---- rendiciones_select : + rama dueno (preserva supervisa del 03) ----
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
          or (p.local is not null and p.local = rendiciones_caja_chica.local)
        )
    )
  );

-- ---- rendiciones_insert : admin, o dueno (SU local Y estado 'abierto') ----
drop policy if exists rendiciones_insert on public.rendiciones_caja_chica;
create policy rendiciones_insert on public.rendiciones_caja_chica
  for insert to authenticated
  with check (
    exists (
      select 1 from perfil_actual() p
      where p.cliente_id = rendiciones_caja_chica.cliente_id
        and (
          p.rol = 'admin'
          or (
            p.local is not null
            and p.local = rendiciones_caja_chica.local
            and rendiciones_caja_chica.estado = 'abierto'
          )
        )
    )
  );

-- ---- rendiciones_update : admin / gestor(caja_chica) / dueno ----
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
    or exists (select 1 from perfil_actual() p
            where p.cliente_id = rendiciones_caja_chica.cliente_id
              and p.local is not null
              and p.local = rendiciones_caja_chica.local
              and rendiciones_caja_chica.estado = 'abierto')
  )
  with check (
    exists (select 1 from perfil_actual() p
            where p.cliente_id = rendiciones_caja_chica.cliente_id
              and (p.rol = 'admin'
                   or (p.rol = 'gestor'
                       and 'caja_chica' = any(coalesce(p.areas, '{}'::text[])))))
    or exists (select 1 from perfil_actual() p
            where p.cliente_id = rendiciones_caja_chica.cliente_id
              and p.local is not null
              and p.local = rendiciones_caja_chica.local
              and rendiciones_caja_chica.estado in ('abierto', 'en_revision'))
  );

-- ---- gastos_insert : admin (padre cualquier estado) o dueno (padre 'abierto') ----
drop policy if exists gastos_insert on public.gastos_caja_chica;
create policy gastos_insert on public.gastos_caja_chica
  for insert to authenticated
  with check (
    (
      exists (select 1 from perfil_actual() p
              where p.cliente_id = gastos_caja_chica.cliente_id and p.rol = 'admin')
      and exists (select 1 from public.rendiciones_caja_chica r
              where r.id = gastos_caja_chica.rendicion_id
                and r.cliente_id = gastos_caja_chica.cliente_id)
    )
    or exists (
      select 1
      from perfil_actual() p
      join public.rendiciones_caja_chica r on r.id = gastos_caja_chica.rendicion_id
      where p.cliente_id = gastos_caja_chica.cliente_id
        and r.cliente_id = gastos_caja_chica.cliente_id
        and p.local is not null and p.local = r.local
        and r.estado = 'abierto'
    )
  );

-- ---- gastos_update : admin / gestor(caja_chica) / dueno (padre 'abierto') ----
drop policy if exists gastos_update on public.gastos_caja_chica;
create policy gastos_update on public.gastos_caja_chica
  for update to authenticated
  using (
    (
      exists (select 1 from perfil_actual() p
              where p.cliente_id = gastos_caja_chica.cliente_id and p.rol = 'admin')
      and exists (select 1 from public.rendiciones_caja_chica r
              where r.id = gastos_caja_chica.rendicion_id
                and r.cliente_id = gastos_caja_chica.cliente_id)
    )
    or (
      exists (select 1 from perfil_actual() p
              where p.cliente_id = gastos_caja_chica.cliente_id
                and p.rol = 'gestor'
                and 'caja_chica' = any(coalesce(p.areas, '{}'::text[])))
      and exists (select 1 from public.rendiciones_caja_chica r
              where r.id = gastos_caja_chica.rendicion_id
                and r.cliente_id = gastos_caja_chica.cliente_id)
    )
    or exists (
      select 1
      from perfil_actual() p
      join public.rendiciones_caja_chica r on r.id = gastos_caja_chica.rendicion_id
      where p.cliente_id = gastos_caja_chica.cliente_id
        and r.cliente_id = gastos_caja_chica.cliente_id
        and p.local is not null and p.local = r.local
        and r.estado = 'abierto'
    )
  )
  with check (
    exists (select 1 from perfil_actual() p
            where p.cliente_id = gastos_caja_chica.cliente_id)
  );

-- ---- gastos_delete : admin (padre cualquier estado) o dueno (padre 'abierto') ----
drop policy if exists gastos_delete on public.gastos_caja_chica;
create policy gastos_delete on public.gastos_caja_chica
  for delete to authenticated
  using (
    (
      exists (select 1 from perfil_actual() p
              where p.cliente_id = gastos_caja_chica.cliente_id and p.rol = 'admin')
      and exists (select 1 from public.rendiciones_caja_chica r
              where r.id = gastos_caja_chica.rendicion_id
                and r.cliente_id = gastos_caja_chica.cliente_id)
    )
    or exists (
      select 1
      from perfil_actual() p
      join public.rendiciones_caja_chica r on r.id = gastos_caja_chica.rendicion_id
      where p.cliente_id = gastos_caja_chica.cliente_id
        and r.cliente_id = gastos_caja_chica.cliente_id
        and p.local is not null and p.local = r.local
        and r.estado = 'abierto'
    )
  );

commit;

-- =====================================================================
-- VERIFICACION (correr DESPUES del commit)
-- =====================================================================
-- -- 1) Seed de empresas (5 filas grupobaco):
-- select codigo, nombre, orden, activo from public.empresas
-- where cliente_id='grupobaco' order by orden;
--
-- -- 2) Columna empresa_id en gastos:
-- select column_name, data_type, is_nullable from information_schema.columns
-- where table_schema='public' and table_name='gastos_caja_chica'
--   and column_name='empresa_id';
--
-- -- 3) Politicas recreadas mencionan la rama dueno (p.local):
-- select tablename, policyname, cmd,
--        (coalesce(qual,'') || coalesce(with_check,'')) ilike '%p.local%' as usa_dueno
-- from pg_policies
-- where schemaname='public'
--   and tablename in ('rendiciones_caja_chica','gastos_caja_chica')
-- order by tablename, policyname;

-- =====================================================================
-- MATRIZ DE PRUEBAS (preview, por API REST directa y por UI)
--   Usuarios: admin ; gestor con caja_chica en areas (revisor) ;
--   gestor de oficina con local (ej OC-MA, sin caja_chica) = DUENO ;
--   qf de local A ; FTEST de otro cliente con un local HOMONIMO.
-- =====================================================================
-- | # | Escenario                                              | admin | revisor cc | dueno OC-MA | qf A | FTEST |
-- |---|--------------------------------------------------------|-------|------------|-------------|------|-------|
-- | 1 | Ver SU rendicion (select)                              |  si   | si (todas) | si (OC-MA)  | siA  | no    |
-- | 2 | Crear rendicion en SU local (estado abierto)           |  si   | no         | si (OC-MA)  | siA  | no    |
-- | 3 | Insertar rendicion estado!='abierto' por REST          |  -    | no         | NO (bloq.)  | NO   | no    |
-- | 4 | Cargar/editar/borrar gasto con padre 'abierto'         |  si   | no*        | si (OC-MA)  | siA  | no    |
-- | 5 | Editar gasto con padre 'en_revision' (dueno/qf)        |  si   | si(gestor) | NO          | NO   | no    |
-- | 6 | Enviar (abierto->en_revision) de SU rendicion          |  si   | no         | si (OC-MA)  | siA  | no    |
-- | 7 | Revisar/cerrar/pagar                                   |  si   | si         | NO          | NO   | no    |
-- | 8 | Leer/editar empresas                                   | rd+wr | rd         | rd          | rd   | no    |
-- | 9 | FTEST con local homonimo a OC-MA                       |  -    | -          | -           | -    | NO ve nada del otro cliente |
--    (*) el revisor no crea/carga gastos; solo aprueba/rechaza (update).
--
-- Prueba de fuga clave (precision 2): logueado como FTEST cuyo p.local
--   coincide en NOMBRE con OC-MA de grupobaco, por REST directa:
--     GET /rest/v1/rendiciones_caja_chica?select=*  -> NADA de grupobaco
--     (las ramas dueno anclan p.cliente_id = tabla.cliente_id).
--
-- Arrastre: cerrar_rendicion() es SECURITY DEFINER (04) -> su creacion de
--   borrador y movimiento de gastos NO dependen de estas politicas; el
--   cambio de rama dueno no lo afecta. Verificar que el cierre con
--   rechazados sigue arrastrando al borrador de la unidad.
