-- =====================================================================
-- Validacion de Ajustes - 13: estado 'validado' + columnas de auditoria
--   + eventos con padre ajuste. Escrito CONTRA la salida real del SQL 12
--   (segunda revision de Cesar, 14-jul-2026). Transaccional. Lo pega
--   Cesar en Supabase. NO ejecutar aqui.
--
-- RETROCOMPATIBLE: agrega un valor de estado y columnas nullables; nada
--   escribe 'validado' ni eventos.ajuste_id hasta que despliegue el
--   codigo nuevo. El flujo actual de Carolina sigue identico.
--
-- Decisiones tomadas con el inventario (Bloques 1, 4, 5a del SQL 12):
--   - estado es CHECK constraint 'ajustes_inventario_estado_check'
--     (3 valores) -> se recrea con MISMO NOMBRE agregando 'validado'.
--   - eventos.tipo tiene CHECK cerrado 'eventos_tipo_check' (8 valores)
--     -> se recrea con MISMO NOMBRE agregando 'ajuste_validado'; sin
--     esto el insert del evento fallaria en produccion.
--   - eventos.caso_id es NOT NULL -> se relaja, se agrega ajuste_id
--     (FK a ajustes_inventario ON DELETE CASCADE, espejo de
--     eventos_caso_id_fkey) y un CHECK "exactamente un padre"
--     (num_nonnulls = 1). Las filas existentes (todas con caso_id)
--     pasan el check sin backfill.
--   - validado_por text / fecha_validacion timestamptz, nullables,
--     espejo de cerrado_por / fecha_cierre (Bloque 3).
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1) ajustes_inventario: estado 'validado' en el check (mismo nombre).
-- ---------------------------------------------------------------------
alter table public.ajustes_inventario
  drop constraint ajustes_inventario_estado_check;
alter table public.ajustes_inventario
  add constraint ajustes_inventario_estado_check
  check (estado = any (array['pendiente'::text, 'validado'::text, 'realizado'::text, 'anulado'::text]));

-- ---------------------------------------------------------------------
-- 2) ajustes_inventario: auditoria de la validacion. Nullables: los
--    ajustes historicos y los anulados desde pendiente no la tienen.
--    Regla de negocio (la aplica el codigo): realizar directo desde
--    pendiente (filtro/admin) estampa validacion implicita con el
--    mismo actor -> todo 'realizado' queda con validacion registrada.
-- ---------------------------------------------------------------------
alter table public.ajustes_inventario
  add column if not exists validado_por text;
alter table public.ajustes_inventario
  add column if not exists fecha_validacion timestamptz;

-- ---------------------------------------------------------------------
-- 3) eventos: tipo nuevo 'ajuste_validado' (recrea el check con mismo
--    nombre; los 8 valores actuales se preservan LITERALES del Bloque 5a).
-- ---------------------------------------------------------------------
alter table public.eventos
  drop constraint eventos_tipo_check;
alter table public.eventos
  add constraint eventos_tipo_check
  check (tipo = any (array['creado'::text, 'recordatorio'::text, 're_derivacion'::text, 'escalado'::text, 'cerrado'::text, 'reabierto'::text, 'cambio_estado'::text, 'notificacion_pendiente'::text, 'ajuste_validado'::text]));

-- ---------------------------------------------------------------------
-- 4) eventos: padre alternativo ajuste. caso_id deja de ser NOT NULL y
--    el CHECK exige EXACTAMENTE un padre (nunca cero, nunca dos), asi
--    ninguna fila queda huerfana de padre por error de codigo.
-- ---------------------------------------------------------------------
alter table public.eventos
  alter column caso_id drop not null;

alter table public.eventos
  add column if not exists ajuste_id uuid
  references public.ajustes_inventario(id) on delete cascade;

alter table public.eventos
  add constraint eventos_un_padre_check
  check (num_nonnulls(caso_id, ajuste_id) = 1);

-- Para leer el timeline de un ajuste (espejo del acceso por caso_id).
create index if not exists idx_eventos_ajuste_id
  on public.eventos (ajuste_id);

commit;

-- =====================================================================
-- VERIFICACION (correr DESPUES del commit, de a uno; no confiar en
-- "Success. No rows returned").
-- =====================================================================

-- V1: los 4 constraints tocados/creados. Esperado:
--   ajustes_inventario_estado_check -> incluye 'validado' (4 valores)
--   eventos_tipo_check              -> incluye 'ajuste_validado' (9 valores)
--   eventos_un_padre_check          -> num_nonnulls(caso_id, ajuste_id) = 1
--   eventos_ajuste_id_fkey          -> FK a ajustes_inventario ON DELETE CASCADE
select conname, pg_get_constraintdef(oid) as definicion
from pg_constraint
where (conrelid = 'public.ajustes_inventario'::regclass
        and conname = 'ajustes_inventario_estado_check')
   or (conrelid = 'public.eventos'::regclass
        and conname in ('eventos_tipo_check', 'eventos_un_padre_check', 'eventos_ajuste_id_fkey'))
order by conname;

-- V2: columnas nuevas y nulabilidad. Esperado:
--   ajustes_inventario.validado_por      text        YES
--   ajustes_inventario.fecha_validacion  timestamptz YES
--   eventos.caso_id                      uuid        YES  (relajado)
--   eventos.ajuste_id                    uuid        YES  (nuevo)
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and ((table_name = 'ajustes_inventario' and column_name in ('validado_por', 'fecha_validacion'))
    or (table_name = 'eventos' and column_name in ('caso_id', 'ajuste_id')))
order by table_name, column_name;

-- V3: el indice existe y los eventos historicos siguen sanos (todos con
-- exactamente un padre; el conteo debe calzar con el total de eventos).
select
  (select count(*) from pg_indexes
    where schemaname = 'public' and indexname = 'idx_eventos_ajuste_id') as indice_creado,
  (select count(*) from public.eventos)                                  as eventos_total,
  (select count(*) from public.eventos
    where num_nonnulls(caso_id, ajuste_id) = 1)                          as eventos_con_un_padre;
