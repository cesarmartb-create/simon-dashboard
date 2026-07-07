-- =====================================================================
-- Provisioning - 10: ALTA de 11 QF en el PANEL (solo panel).
--   NO toca el bot ni la whitelist. NO toca lib/auth.ts (el gate es de BD
--   via perfil_actual(); el nombre cae al email, igual que Maria Paz hoy).
--
-- ORDEN DE EJECUCION (importa):
--   1) MANUAL en Supabase Auth: crear las 11 cuentas (Add user -> Auto
--      Confirm User activado). El email de cada local ES la cuenta.
--      Sin la cuenta Auth, la fila NO se inserta (el join por email no
--      encuentra user_id) -> lo veras en la VERIFICACION de abajo.
--   2) Correr este archivo (transaccional).
--   3) Correr la VERIFICACION comentada al final.
--
-- IDEMPOTENTE:
--   - user_id se resuelve por join contra auth.users (email).
--   - local se COMPONE desde public.locales via join por codigo:
--     'codigo — nombre' (guion largo em dash, con espacios). Esa es la
--     convencion real de usuarios_cliente.local en produccion (ej.
--     FTEST = 'FTEST — Local Pruebas') y lo que el bot escribe en
--     casos.local. NUNCA se hardcodea el nombre.
--   - 'where not exists' por user_id: re-correr no duplica; una fila QF
--     ya existente (incluida F0313 Maria Paz, que NO esta en esta lista)
--     no se toca.
--
-- EXCEPCION LEGADA CONOCIDA (NO corregir): F0313 Maria Paz tiene
--   uc.local = 'F0313 — Maipú 3' (con tilde) pero locales.nombre dice
--   'Maipu 3' (sin tilde). Se deja intacta. Las 11 nuevas van con la
--   composicion desde locales TAL CUAL (sin tildes). Por eso el
--   PRE-CHECK valida la convencion contra FTEST y NO contra F0313.
--
-- Los NOMBRES de personas de abajo son SOLO referencia para Cesar; el SQL
-- no los usa (el local sale del join por codigo).
--   F0006 Wilbert Chancy | F0024 Rony Condena / Cristian Schaaf
--   F0090 Camila Huaquifil / Carolina Ponce | F0160 Catalina Venegas
--   F0171 Nicolas Vielma | F0234 Benjamin Farias / Jaime Pastor
--   F0287 Nicolas Carrasco | F0383 Kimberly Castro | F0437 Luz Verdugo
--   F0521 Juan Diego Marquez | F0544 Constanza Bustamante
--   (F0578 Castro 2 queda FUERA: aun no opera.)
-- =====================================================================

begin;

with entrada(codigo, email) as (
  values
    ('F0006', 'f0006maipu1@gmail.com'),
    ('F0024', 'f0024chillan@gmail.com'),
    ('F0090', 'f0090castro@gmail.com'),
    ('F0160', 'f0160talagante@gmail.com'),
    ('F0171', 'f0171pedroaguirrecerda@gmail.com'),
    ('F0234', 'f0234metrofranklin@gmail.com'),
    ('F0287', 'f0287chillan3@gmail.com'),
    ('F0383', 'f0383rancagua8@gmail.com'),
    ('F0437', 'f0437talagante2@gmail.com'),
    ('F0521', 'f0521maipuchacabuco@gmail.com'),
    ('F0544', 'f0544chillan6@gmail.com')
),
resuelto as (
  select
    e.codigo,
    e.email,
    au.id as user_id,                        -- null si la cuenta Auth aun no existe
    loc.codigo || ' — ' || loc.nombre as local  -- convencion 'codigo — nombre' (em dash); null si el codigo no matchea
  from entrada e
  left join auth.users au
    on lower(au.email) = lower(e.email)
  left join public.locales loc
    on loc.codigo = e.codigo
   and loc.cliente_id = 'grupobaco'
)
insert into public.usuarios_cliente
  (user_id, cliente_id, rol, local, areas, areas_supervisa, activo)
select
  r.user_id, 'grupobaco', 'qf', r.local, null, null, true
from resuelto r
where r.user_id is not null       -- salta filas sin cuenta Auth
  and r.local  is not null        -- salta codigos que no matchean locales
  and not exists (                -- no duplica ni pisa filas existentes (p.ej. F0313)
    select 1 from public.usuarios_cliente uc
    where uc.user_id = r.user_id
  );

commit;

-- =====================================================================
-- VERIFICACION (correr DESPUES del commit).
-- Lista las 11: estado de la cuenta Auth, el local resuelto y si ya
-- tienen fila qf. 'estado' debe quedar OK en las 11.
-- =====================================================================
-- with entrada(codigo, email) as (
--   values
--     ('F0006','f0006maipu1@gmail.com'),
--     ('F0024','f0024chillan@gmail.com'),
--     ('F0090','f0090castro@gmail.com'),
--     ('F0160','f0160talagante@gmail.com'),
--     ('F0171','f0171pedroaguirrecerda@gmail.com'),
--     ('F0234','f0234metrofranklin@gmail.com'),
--     ('F0287','f0287chillan3@gmail.com'),
--     ('F0383','f0383rancagua8@gmail.com'),
--     ('F0437','f0437talagante2@gmail.com'),
--     ('F0521','f0521maipuchacabuco@gmail.com'),
--     ('F0544','f0544chillan6@gmail.com')
-- )
-- select
--   e.codigo,
--   e.email,
--   au.id                                as user_id_auth,
--   loc.codigo || ' — ' || loc.nombre    as local_resuelto,
--   uc.rol                               as rol_en_panel,
--   uc.local                             as local_en_panel,
--   uc.activo,
--   case
--     when au.id is null       then 'FALTA cuenta Auth'
--     when loc.nombre is null  then 'FALTA local (codigo no matchea)'
--     when uc.user_id is null  then 'NO insertado (revisar)'
--     when uc.rol <> 'qf'      then 'ROL inesperado'
--     when uc.local <> loc.codigo || ' — ' || loc.nombre
--                              then 'LOCAL no coincide'
--     else 'OK'
--   end as estado
-- from entrada e
-- left join auth.users au        on lower(au.email) = lower(e.email)
-- left join public.locales loc   on loc.codigo = e.codigo and loc.cliente_id = 'grupobaco'
-- left join public.usuarios_cliente uc
--        on uc.user_id = au.id and uc.cliente_id = 'grupobaco'
-- order by e.codigo;
--
-- Esperado: 11 filas, todas estado = 'OK', rol_en_panel = 'qf',
--           local_en_panel = local_resuelto (= 'codigo — nombre').
--
-- =====================================================================
-- PRE-CHECK (correr ANTES del begin; no escribe nada). Dos partes:
--
-- (a) Convencion de composicion, validada contra FTEST: la composicion
--     'codigo — nombre' desde locales debe ser IGUAL a su uc.local
--     existente. NO validar contra F0313 (excepcion legada por tilde,
--     ver encabezado). Esperado: 1 fila con convencion_ok = true.
--
-- select
--   uc.local                              as local_en_panel,
--   loc.codigo || ' — ' || loc.nombre     as composicion,
--   uc.local = loc.codigo || ' — ' || loc.nombre as convencion_ok
-- from public.locales loc
-- join public.usuarios_cliente uc
--   on uc.cliente_id = loc.cliente_id
--  and uc.local = loc.codigo || ' — ' || loc.nombre
-- where loc.cliente_id = 'grupobaco'
--   and loc.codigo = 'FTEST';
--
--     Si devuelve 0 filas, la convencion NO calza con produccion:
--     DETENERSE y revisar antes de correr el insert.
--
-- (b) Insumos de las 11: la misma consulta de VERIFICACION de arriba
--     sirve tal cual; antes del insert lo esperado es
--     'NO insertado (revisar)' en las 11 (significa Auth y local OK,
--     falta solo la fila). Si algun estado dice FALTA, resolver antes.
-- =====================================================================
