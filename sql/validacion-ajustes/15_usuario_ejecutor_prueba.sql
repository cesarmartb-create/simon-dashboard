-- =====================================================================
-- Validacion de Ajustes - 15: usuario EJECUTOR DE PRUEBA (andamiaje FTEST).
--   Para probar el rol ejecutor en preview SIN tocar a Dyson (el cambia
--   de area recien en el 16, tras las pruebas y el merge).
--   Lo pega Cesar. NO ejecutar aqui. Transaccional.
--
-- PRE-REQUISITO (manual, en Supabase Auth -> Users):
--   1) Crear usuario 'ejecutor.test@ftest.cl' con password (Auto Confirm ON).
--   2) Copiar su user_id y reemplazar <<UUID_AUTH_EJECUTOR_TEST>> abajo.
--
-- Regla: ejecutor = gestor con areas={ajustes_ejecucion}, sin local.
-- Al cierre de las pruebas: correr el bloque LIMPIEZA (activo=false).
-- =====================================================================

begin;

insert into public.usuarios_cliente
  (user_id, cliente_id, rol, local, areas, areas_supervisa, activo)
values
  ('<<UUID_AUTH_EJECUTOR_TEST>>', 'grupobaco', 'gestor', null,
   array['ajustes_ejecucion'], null, true);

commit;

-- VERIFICACION (despues del commit). Esperado: 1 fila, rol gestor,
-- areas={ajustes_ejecucion}, areas_supervisa null, activo true.
select u.email, uc.rol, uc.local, uc.areas, uc.areas_supervisa, uc.activo
from public.usuarios_cliente uc
join auth.users u on u.id = uc.user_id
where u.email = 'ejecutor.test@ftest.cl';

-- =====================================================================
-- LIMPIEZA (correr AL CIERRE de las pruebas en preview; queda desactivado,
-- no se borra: perfil_actual() filtra activo=true, asi que pierde todo
-- acceso — mismo criterio que el resto del andamiaje FTEST que se conserva).
-- =====================================================================
-- update public.usuarios_cliente
--   set activo = false
--   where cliente_id = 'grupobaco'
--     and user_id = '<<UUID_AUTH_EJECUTOR_TEST>>';
--
-- -- Verificacion de la limpieza. Esperado: activo = false.
-- select u.email, uc.activo
-- from public.usuarios_cliente uc
-- join auth.users u on u.id = uc.user_id
-- where u.email = 'ejecutor.test@ftest.cl';
