-- =====================================================================
-- Caja Chica - 06: columnas para Fase 3.
--   a) configuracion_cliente.instrucciones_caja_chica : texto de ayuda
--      editable por el admin, mostrado en la pantalla de caja chica.
--   b) locales.correo : correo de contacto por unidad, fuente PRIMARIA del
--      recordatorio de fin de mes (mas estable que el local_correo de la
--      ultima rendicion, que se desactualiza al cambiar el QF).
-- Ambas nullable. Incremental: se corre DESPUES de 01-05.
-- Transaccional. Lo pega Cesar. NO ejecutar aqui.
-- =====================================================================

begin;

alter table public.configuracion_cliente
  add column if not exists instrucciones_caja_chica text;

alter table public.locales
  add column if not exists correo text;

commit;

-- =====================================================================
-- VERIFICACION (correr DESPUES del commit; solo SELECT)
-- =====================================================================
-- -- 1) Columna de instrucciones en configuracion_cliente:
-- select column_name, data_type, is_nullable
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'configuracion_cliente'
--   and column_name = 'instrucciones_caja_chica';
--
-- -- 2) Columna de correo en locales:
-- select column_name, data_type, is_nullable
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'locales'
--   and column_name = 'correo';
