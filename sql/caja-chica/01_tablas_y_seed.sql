-- =====================================================================
-- Caja Chica - 01: TABLAS + SEED de tipos_gasto
-- Spec_Caja_Chica_dashboard.md, seccion 7 paso 2 (modelo de datos, seccion 1)
-- Transaccional. NO ejecutar contra produccion sin revisar. Lo pega Cesar.
-- Estados canonicos (decision 05-jul): rendicion abierto|en_revision|
--   aprobada|aprobada_parcial|rechazada|pagado ; gasto pendiente|aprobado|rechazado.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1.1 tipos_gasto  (catalogo de categorias, gemelo de tipos_ajuste)
-- ---------------------------------------------------------------------
create table if not exists public.tipos_gasto (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  text not null,
  codigo      text not null,
  nombre      text not null,
  activo      boolean not null default true,
  orden       int,
  created_at  timestamptz not null default now(),
  unique (cliente_id, codigo)
);

-- ---------------------------------------------------------------------
-- 1.2 fondos_caja_chica  (fondo por unidad, OPCIONAL: ausencia = sin fondo)
-- ---------------------------------------------------------------------
create table if not exists public.fondos_caja_chica (
  id             uuid primary key default gen_random_uuid(),
  cliente_id     text not null,
  local          text not null,
  monto_asignado numeric not null,
  activo         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz,
  unique (cliente_id, local)
);

-- ---------------------------------------------------------------------
-- 1.3 rendiciones_caja_chica  (el lote, gemelo de ajustes_inventario)
-- ---------------------------------------------------------------------
create table if not exists public.rendiciones_caja_chica (
  id                   uuid primary key default gen_random_uuid(),
  cliente_id           text not null,
  local                text not null,
  local_correo         text,
  reportado_por        text not null,
  periodo              text not null,
  numero               int  not null default 1,
  estado               text not null default 'abierto'
    check (estado in ('abierto','en_revision','aprobada','aprobada_parcial','rechazada','pagado')),
  total                numeric not null default 0,
  monto_fondo_snapshot numeric,
  excede_fondo         boolean not null default false,
  aprobado_por         text,
  fecha_envio          timestamptz,
  fecha_aprobacion     timestamptz,
  observacion_cierre   text,
  pagado_por           text,
  fecha_pago           timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz,
  constraint rendiciones_periodo_formato check (periodo ~ '^[0-9]{4}-[0-9]{2}$'),
  unique (cliente_id, local, periodo, numero)
);

create index if not exists idx_rendiciones_cliente_local
  on public.rendiciones_caja_chica (cliente_id, local);
create index if not exists idx_rendiciones_cliente_periodo
  on public.rendiciones_caja_chica (cliente_id, periodo);
create index if not exists idx_rendiciones_cliente_estado
  on public.rendiciones_caja_chica (cliente_id, estado);

-- ---------------------------------------------------------------------
-- 1.4 gastos_caja_chica  (lineas de la rendicion)
-- ---------------------------------------------------------------------
create table if not exists public.gastos_caja_chica (
  id                  uuid primary key default gen_random_uuid(),
  cliente_id          text not null,
  rendicion_id        uuid not null references public.rendiciones_caja_chica(id) on delete cascade,
  fecha_gasto         date not null,
  monto               numeric not null check (monto > 0),
  proveedor           text,
  descripcion         text,
  tipo_gasto_id       uuid references public.tipos_gasto(id),
  forma_pago          text not null
    check (forma_pago in ('efectivo','tarjeta','transferencia')),
  n_documento         text,
  centro_costo        text,   -- NULLABLE, se puebla desde Talana en fase posterior
  estado              text not null default 'pendiente'
    check (estado in ('pendiente','aprobado','rechazado')),
  observacion_rechazo text,
  created_at          timestamptz not null default now()
);

create index if not exists idx_gastos_rendicion
  on public.gastos_caja_chica (rendicion_id);
create index if not exists idx_gastos_cliente
  on public.gastos_caja_chica (cliente_id);
create index if not exists idx_gastos_tipo
  on public.gastos_caja_chica (tipo_gasto_id);

-- ---------------------------------------------------------------------
-- SEED de tipos_gasto (semilla editable luego por admin en Configuracion).
-- cliente_id 'grupobaco' = unico cliente en produccion hoy. Idempotente.
-- codigo sin acentos; nombre legible.
-- ---------------------------------------------------------------------
insert into public.tipos_gasto (cliente_id, codigo, nombre, orden) values
  ('grupobaco', 'insumos',          'Insumos de local',          1),
  ('grupobaco', 'movilizacion',     'Movilizacion y transporte', 2),
  ('grupobaco', 'aseo',             'Aseo y limpieza',           3),
  ('grupobaco', 'mantencion',       'Mantencion menor',          4),
  ('grupobaco', 'colacion',         'Alimentacion y colacion',   5),
  ('grupobaco', 'gastos_bancarios', 'Gastos bancarios',          6),
  ('grupobaco', 'otros',            'Otros',                     7)
on conflict (cliente_id, codigo) do nothing;

commit;

-- =====================================================================
-- VERIFICACION (correr DESPUES del commit; son solo SELECT)
-- =====================================================================
-- -- 1) Las 4 tablas existen:
-- select table_name
-- from information_schema.tables
-- where table_schema = 'public'
--   and table_name in ('tipos_gasto','fondos_caja_chica',
--                      'rendiciones_caja_chica','gastos_caja_chica')
-- order by table_name;
--
-- -- 2) Seed cargado (espera 7 filas para grupobaco):
-- select codigo, nombre, orden, activo
-- from public.tipos_gasto
-- where cliente_id = 'grupobaco'
-- order by orden;
--
-- -- 3) Checks de estado declarados en las tablas:
-- select conrelid::regclass as tabla, conname, pg_get_constraintdef(oid) as definicion
-- from pg_constraint
-- where conrelid in ('public.rendiciones_caja_chica'::regclass,
--                    'public.gastos_caja_chica'::regclass)
--   and contype = 'c'
-- order by tabla, conname;
--
-- -- 4) FKs de gastos (rendicion_id -> rendiciones, tipo_gasto_id -> tipos_gasto):
-- select conname, pg_get_constraintdef(oid) as definicion
-- from pg_constraint
-- where conrelid = 'public.gastos_caja_chica'::regclass and contype = 'f';
