-- =====================================================================
-- Validacion de Ajustes - 16: PROVISIONING FINAL de Dyson (ejecutor).
--   ULTIMO paso del despliegue (Fase 5): correr SOLO despues de que
--   (a) las pruebas por rol en preview pasaron,
--   (b) la rama se mergeo a main y Vercel desplego produccion,
--   (c) el area 'ajustes_ejecucion' existe en Configuracion -> Derivaciones
--       con el correo de Dyson (si no, el correo de validacion sale sin el).
--   Lo pega Cesar. NO ejecutar aqui. Transaccional.
--
-- Efecto: Dyson deja de ser filtro (pierde 'ajustes_inventario') y pasa a
-- ejecutor puro: la RLS le oculta pendientes/anulados y solo puede la
-- transicion validado -> realizado. Hasta este momento operaba como filtro.
-- Rollback: volver areas a array['ajustes_inventario'].
-- =====================================================================

begin;

update public.usuarios_cliente
set areas = array['ajustes_ejecucion']
where cliente_id = 'grupobaco'
  and user_id = (
    select id from auth.users
    where lower(email) = 'dyson.gonzalez@grupobaco.cl'
  );

commit;

-- VERIFICACION (despues del commit). Esperado: 1 fila,
-- areas={ajustes_ejecucion} (SIN ajustes_inventario), activo true.
select u.email, uc.rol, uc.local, uc.areas, uc.areas_supervisa, uc.activo
from public.usuarios_cliente uc
join auth.users u on u.id = uc.user_id
where lower(u.email) = 'dyson.gonzalez@grupobaco.cl';

-- Sanity final del routing de correos: ambas areas con responsable.
-- Esperado: ajustes_inventario -> filtro (Carolina hoy);
--           ajustes_ejecucion  -> dyson.gonzalez@grupobaco.cl.
select nombre, responsable_nombre, responsable_correo, activo
from public.areas_derivacion
where cliente_id = 'grupobaco'
  and nombre in ('ajustes_inventario', 'ajustes_ejecucion');
