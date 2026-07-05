-- =====================================================================
-- Caja Chica - 08: tipo de documento por gasto (boleta / factura /
--   sin_documento). Importa contablemente (credito fiscal de facturas).
-- Columna NOT NULL con default 'sin_documento': las filas existentes
--   quedan como 'sin_documento'. Incremental: se corre DESPUES de 01-07.
-- Transaccional. Lo pega Cesar. NO ejecutar aqui.
-- =====================================================================

begin;

alter table public.gastos_caja_chica
  add column if not exists tipo_documento text not null default 'sin_documento'
  check (tipo_documento in ('boleta', 'factura', 'sin_documento'));

commit;

-- =====================================================================
-- VERIFICACION (correr DESPUES del commit; solo SELECT)
-- =====================================================================
-- -- 1) La columna existe, NOT NULL, con el check:
-- select column_name, data_type, is_nullable, column_default
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'gastos_caja_chica'
--   and column_name = 'tipo_documento';
--
-- select conname, pg_get_constraintdef(oid) as definicion
-- from pg_constraint
-- where conrelid = 'public.gastos_caja_chica'::regclass
--   and contype = 'c'
--   and pg_get_constraintdef(oid) ilike '%tipo_documento%';
--
-- -- 2) Distribucion actual (las filas viejas deben quedar en 'sin_documento'):
-- select tipo_documento, count(*) from public.gastos_caja_chica
-- group by tipo_documento order by tipo_documento;
