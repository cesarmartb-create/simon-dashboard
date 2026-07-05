-- =====================================================================
-- Caja Chica - 05: corrige el CHECK de adjuntos para admitir gasto_id y
--   rendicion_id como padres validos.
--
-- Problema (detectado en preview): adjuntos tenia un CHECK preexistente que
--   el inventario del Paso 0 no capturo (miramos politicas y columnas, no
--   constraints). Su definicion exigia EXACTAMENTE UNO entre caso_id/ajuste_id:
--     CHECK (((caso_id IS NOT NULL) AND (ajuste_id IS NULL)) OR
--            ((caso_id IS NULL) AND (ajuste_id IS NOT NULL)))
--   Por eso toda fila con gasto_id o rendicion_id lo violaba
--   ("adjuntos_check") y las boletas/comprobantes no se guardaban.
--
-- Fix: exigir EXACTAMENTE UNO no nulo entre los cuatro padres posibles con
--   num_nonnulls(...). Las filas existentes tienen exactamente un padre
--   (caso_id o ajuste_id), asi que la recreacion no falla.
-- Incremental: se corre DESPUES de 02 (que agrego gasto_id / rendicion_id).
-- Transaccional. Lo pega Cesar. NO ejecutar aqui.
-- =====================================================================

begin;

alter table public.adjuntos drop constraint if exists adjuntos_check;

alter table public.adjuntos
  add constraint adjuntos_check
  check (num_nonnulls(caso_id, ajuste_id, gasto_id, rendicion_id) = 1);

commit;

-- =====================================================================
-- VERIFICACION (correr DESPUES del commit)
-- =====================================================================
-- -- Nueva definicion del check (debe usar num_nonnulls(...) = 1):
-- select conname, pg_get_constraintdef(oid) as definicion
-- from pg_constraint
-- where conrelid = 'public.adjuntos'::regclass and conname = 'adjuntos_check';
--
-- -- Sanidad: ninguna fila existente viola el nuevo check (debe dar 0):
-- select count(*) as filas_invalidas
-- from public.adjuntos
-- where num_nonnulls(caso_id, ajuste_id, gasto_id, rendicion_id) <> 1;
