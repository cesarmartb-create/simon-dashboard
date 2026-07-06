-- =====================================================================
-- Caja Chica - 07: PROVISIONING de los gestores nuevos (DOCUMENTADO).
--   NO lo ejecuta Claude Code. Cesar lo completa (reemplaza los <<...>>) y
--   lo corre en Supabase. Es provisioning sensible (da acceso al panel).
--
-- Orden real de alta de cada gestor:
--   1) Crear su cuenta en Supabase Auth (email + password) -> copiar su user_id.
--   2) Insertar su fila en usuarios_cliente (abajo) con ese user_id.
--   3) Agregar email -> nombre al mapa USUARIOS de lib/auth.ts (ver bloque final,
--      comentado) para que su nombre salga en los correos.
--   4) Routing de correos (Configuracion -> Derivaciones, en la app): crear el
--      area 'caja_chica' con el correo del revisor y actualizar el responsable
--      de 'ajustes_inventario'. Eso NO va aqui (se hace en la app).
--
-- Regla: ver = area in (areas ∪ areas_supervisa) ; gestionar = area in areas.
-- Transaccional. Verificacion comentada al final.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1) Encargado de Ajustes (ejecutor): ve y gestiona SOLO Ajustes.
-- ---------------------------------------------------------------------
insert into public.usuarios_cliente
  (user_id, cliente_id, rol, local, areas, areas_supervisa, activo)
values
  ('<<UUID_AUTH_ENCARGADO_AJUSTES>>', 'grupobaco', 'gestor', null,
   array['ajustes_inventario'], null, true);

-- ---------------------------------------------------------------------
-- 2) Revisor de Caja chica: ve y gestiona SOLO Caja chica (aprueba,
--    marca pagado, sube comprobante).
-- ---------------------------------------------------------------------
insert into public.usuarios_cliente
  (user_id, cliente_id, rol, local, areas, areas_supervisa, activo)
values
  ('<<UUID_AUTH_REVISOR_CAJA_CHICA>>', 'grupobaco', 'gestor', null,
   array['caja_chica'], null, true);

-- ---------------------------------------------------------------------
-- 3) Maria Andrea: pasa a SUPERVISAR Ajustes (solo lectura) y conserva
--    Casos por 'operaciones'. Se le QUITA la ejecucion de ajustes.
--    Ajustar el WHERE al identificador real (user_id conocido de Maria Andrea).
-- ---------------------------------------------------------------------
update public.usuarios_cliente
set areas = array['operaciones'],
    areas_supervisa = array['ajustes_inventario']
where cliente_id = 'grupobaco'
  and user_id = '<<UUID_AUTH_MARIA_ANDREA>>';

commit;

-- =====================================================================
-- VERIFICACION (correr DESPUES del commit)
-- =====================================================================
-- select rol, local, areas, areas_supervisa, activo
-- from public.usuarios_cliente
-- where cliente_id = 'grupobaco'
--   and user_id in (
--     '<<UUID_AUTH_ENCARGADO_AJUSTES>>',
--     '<<UUID_AUTH_REVISOR_CAJA_CHICA>>',
--     '<<UUID_AUTH_MARIA_ANDREA>>'
--   );
--
-- Esperado:
--   encargado ajustes -> areas={ajustes_inventario}, areas_supervisa=null
--   revisor caja chica -> areas={caja_chica}, areas_supervisa=null
--   maria andrea       -> areas={operaciones}, areas_supervisa={ajustes_inventario}

-- =====================================================================
-- BLOQUE PARA lib/auth.ts (NO es SQL; agregar a mano al mapa USUARIOS).
-- Reemplazar email y nombre reales. Sin esto, los correos caen al email.
-- =====================================================================
--   const USUARIOS = {
--     ...
--     '<<email_encargado_ajustes>>':   { nombre: '<<Nombre Encargado Ajustes>>', rol: 'gestor', ... },
--     '<<email_revisor_caja_chica>>':  { nombre: '<<Nombre Revisor Caja Chica>>', rol: 'gestor', ... },
--   }
-- (Confirmar tambien el email de Maria Andrea ya presente en el mapa.)

-- =====================================================================
-- OPCIONAL (si se prefiere por SQL en vez de la UI de Derivaciones):
--   Crear/actualizar responsables de area. Recomendado hacerlo en la app.
-- =====================================================================
-- update public.areas_derivacion set responsable_correo = '<<email_encargado_ajustes>>'
--   where cliente_id='grupobaco' and nombre='ajustes_inventario';
-- insert into public.areas_derivacion (cliente_id, nombre, responsable_correo, activo)
--   values ('grupobaco','caja_chica','<<email_revisor_caja_chica>>', true)
--   on conflict do nothing;

-- =====================================================================
-- FASE 4 - CAJAS PERSONALES DE OFICINA CENTRAL
-- =====================================================================
-- En Oficina Central cada persona tiene su PROPIA caja chica (rendicion
-- personal). El modelo lo resuelve el "dueno de unidad" (SQL 09): cualquier
-- usuario cuyo usuarios_cliente.local coincida con el local de la rendicion
-- puede crear/cargar/enviar SU rendicion. Entonces cada persona de oficina
-- necesita un LOCAL propio asignado.
--
-- CONVENCION CRITICA del string `local` (debe ser IDENTICO en todos lados):
--   locales.codigo + ' — ' + locales.nombre   =>  "codigo — nombre"
--   (mismo formato que usa el dropdown de locales / ajustes / rendiciones).
-- El match es EXACTO: fondos_caja_chica.local, rendiciones.local, el saldo
-- del listado y la rama dueno de la RLS comparan por ese string completo.
-- Si usuarios_cliente.local no calza EXACTO con el "codigo — nombre" del
-- local, la persona no vera su caja ni podra rendir.
--
-- PASO 1 (Cesar, en Configuracion -> Locales): crear los locales personales.
--   Sugerencia de codigos (OC = Oficina Central):
--     OC-CM  Cesar Martinez
--     OC-JU  Julia ...
--     OC-MA  Maria Andrea ...
--     OC-NA  Nayarhet ...
--     OC-MI  Mariela ...
--   El string resultante sera, p. ej.: "OC-MA — Maria Andrea ...".
--
-- PASO 2 (SQL, aqui): asignar ese local a cada persona de oficina.
--   Reemplazar por los user_id reales y el "codigo — nombre" EXACTO creado.
--
-- update public.usuarios_cliente
--   set local = 'OC-CM — Cesar Martinez'
--   where cliente_id='grupobaco' and user_id='<<UUID_AUTH_CESAR>>';
-- update public.usuarios_cliente
--   set local = 'OC-JU — Julia ...'
--   where cliente_id='grupobaco' and user_id='<<UUID_AUTH_JULIA>>';
-- update public.usuarios_cliente
--   set local = 'OC-MA — Maria Andrea ...'
--   where cliente_id='grupobaco' and user_id='<<UUID_AUTH_MARIA_ANDREA>>';
-- update public.usuarios_cliente
--   set local = 'OC-NA — Nayarhet ...'
--   where cliente_id='grupobaco' and user_id='<<UUID_AUTH_NAYARHET>>';
-- update public.usuarios_cliente
--   set local = 'OC-MI — Mariela ...'
--   where cliente_id='grupobaco' and user_id='<<UUID_AUTH_MARIELA>>';
--
-- NOTA sobre Maria Andrea: ya se le fijo areas=['operaciones'],
--   areas_supervisa=['ajustes_inventario'] arriba; el update de arriba le
--   AGREGA su local OC-MA para que sea duena de su caja personal (ve Caja
--   chica de su unidad ademas de Casos y la supervision de Ajustes).
--
-- VERIFICACION:
-- select user_id, rol, local, areas, areas_supervisa
-- from public.usuarios_cliente
-- where cliente_id='grupobaco' and local like 'OC-%';
