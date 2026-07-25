-- =====================================================================
-- Caja Chica - 10: locales.empresa_id (empresa fija por local) para
--   derivar la empresa del gasto desde el local de la rendicion.
-- YA APLICADO EN PRODUCCION el 24-jul por Cesar directo en Supabase.
-- Este archivo es SOLO REGISTRO HISTORICO — no ejecutar de nuevo.
--
-- Efecto: locales F0006/F0024/F0090/F0287/F0521/F0578 quedan fijos a
--   empresa 'jcs'; F0160/F0171/F0313/F0544/FTEST a 'fsalazar';
--   F0234/F0383/F0437 a 'fcastro'. El resto de los locales (incluidas
--   las cajas OC) queda con empresa_id NULL = eleccion libre en el gasto.
-- =====================================================================

begin;

alter table public.locales
  add column if not exists empresa_id uuid references public.empresas(id);

update public.locales l
set empresa_id = e.id
from public.empresas e
where l.cliente_id = 'grupobaco' and e.cliente_id = 'grupobaco'
  and (
    (e.codigo = 'jcs'      and l.codigo in ('F0006','F0024','F0090','F0287','F0521','F0578')) or
    (e.codigo = 'fsalazar' and l.codigo in ('F0160','F0171','F0313','F0544','FTEST')) or
    (e.codigo = 'fcastro'  and l.codigo in ('F0234','F0383','F0437'))
  );

commit;
