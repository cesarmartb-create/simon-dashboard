-- =====================================================================
-- Provisioning - 11: ALTA en public.colaboradores de las QF reportantes
--   de los 11 locales nuevos (14 personas). Complemento de 10_alta_qfs.sql:
--   sin estas filas, el select "¿Quien reporta?" de casos/nuevo y
--   ajustes/nuevo aparece VACIO para la QF del local.
--
-- CONVENCION (confirmada en produccion, fila viva de Maria Paz):
--   - local  = CODIGO a secas ('F0313', 'OFICINA'). NO el nombre, NO
--     'codigo — nombre'. El form filtra .eq('local', codigo).
--   - cargo  = 'jefe_de_local_quimico_farmaceutico' (slug EXACTO que
--     filtra el form; en OFICINA seria 'gerente_comercial').
--   - activo = true, cliente_id = 'grupobaco'.
--   - rol_portal = 'sin acceso' (asi esta la fila viva de Maria Paz,
--     la QF que opera el panel hoy). rol_portal NO gobierna nada en el
--     dashboard (solo se lee/edita en Configuracion -> Colaboradores);
--     el acceso real lo da usuarios_cliente via perfil_actual(). El
--     select "quien reporta" filtra por local+cargo+activo y no lo usa.
--
-- DESACOPLE CONOCIDO DE cargo (documentado, NO se corrige aqui):
--   El catalogo public.cargos usa NOMBRES LEGIBLES ('Químico
--   Farmacéutico', 'Gerente Comercial', ...). La UI de Configuracion ->
--   Colaboradores guarda cargos.nombre, pero el form de casos/ajustes
--   filtra por el SLUG 'jefe_de_local_quimico_farmaceutico'. O sea:
--   un colaborador dado de alta por la UI queda con cargo legible y NO
--   aparece en "quien reporta". Las filas vivas con slug (Maria Paz,
--   Cesar) no salieron de esa UI. Este script inserta el SLUG directo,
--   que es lo que el form necesita. Fix pendiente por separado.
--
-- SOBRE numero (NOT NULL + UNIQUE por cliente, constraint real de BD):
--   Estas QF NO entran a la whitelist del bot todavia, asi que no tienen
--   numero de WhatsApp asignado aqui. Se usa placeholder sintetico unico
--   'PANEL-<codigo>-<n>' que jamas colisiona con un numero telefonico
--   real. Cuando se les de de alta en el bot, ACTUALIZAR numero con el
--   real (update por cliente_id + local + nombre).
--
-- ORDEN: independiente de 10_alta_qfs.sql (tablas distintas). Correr
--   PRE-CHECK -> script -> VERIFICACION.
--
-- IDEMPOTENTE por (cliente_id, local, nombre) via where not exists:
--   re-correr no duplica. NO toca filas existentes (corporativo, F0313
--   Maria Paz / Paloma Atenas, OFICINA Cesar).
--
-- NOTA SQL Editor de Supabase: correr el bloque begin..commit COMPLETO
--   en una sola ejecucion (el editor autocommitea sentencias sueltas).
-- =====================================================================

-- =====================================================================
-- PRE-CHECK (correr ANTES; no escribe nada).
-- Valida la convencion contra la fila viva de Maria Paz (F0313):
-- esperado >= 1 fila (Maria Paz; puede aparecer tambien Paloma Atenas).
-- Si devuelve 0 filas, la convencion NO calza: DETENERSE.
-- =====================================================================
-- select nombre, local, cargo, rol_portal, activo
-- from public.colaboradores
-- where cliente_id = 'grupobaco'
--   and local = 'F0313'
--   and cargo = 'jefe_de_local_quimico_farmaceutico'
--   and activo = true;

begin;

with entrada(local, nombre, numero) as (
  values
    ('F0006', 'Wilbert Chancy',       'PANEL-F0006-01'),
    ('F0024', 'Rony Condena',         'PANEL-F0024-01'),
    ('F0024', 'Cristian Schaaf',      'PANEL-F0024-02'),
    ('F0090', 'Camila Huaquifil',     'PANEL-F0090-01'),
    ('F0090', 'Carolina Ponce',       'PANEL-F0090-02'),
    ('F0160', 'Catalina Venegas',     'PANEL-F0160-01'),
    ('F0171', 'Nicolas Vielma',       'PANEL-F0171-01'),
    ('F0234', 'Benjamin Farias',      'PANEL-F0234-01'),
    ('F0234', 'Jaime Pastor',         'PANEL-F0234-02'),
    ('F0287', 'Nicolas Carrasco',     'PANEL-F0287-01'),
    ('F0383', 'Kimberly Castro',      'PANEL-F0383-01'),
    ('F0437', 'Luz Verdugo',          'PANEL-F0437-01'),
    ('F0521', 'Juan Diego Marquez',   'PANEL-F0521-01'),
    ('F0544', 'Constanza Bustamante', 'PANEL-F0544-01')
)
insert into public.colaboradores
  (cliente_id, nombre, numero, cargo, local, rol_portal, activo)
select
  'grupobaco',
  e.nombre,
  e.numero,
  'jefe_de_local_quimico_farmaceutico',
  e.local,
  'sin acceso',
  true
from entrada e
where not exists (           -- idempotencia: no duplica ni pisa existentes
  select 1 from public.colaboradores c
  where c.cliente_id = 'grupobaco'
    and c.local = e.local
    and c.nombre = e.nombre
);

commit;

-- =====================================================================
-- VERIFICACION (correr DESPUES del commit).
-- Esperado: 14 filas, todas estado = 'OK'.
-- =====================================================================
-- with entrada(local, nombre) as (
--   values
--     ('F0006','Wilbert Chancy'), ('F0024','Rony Condena'),
--     ('F0024','Cristian Schaaf'), ('F0090','Camila Huaquifil'),
--     ('F0090','Carolina Ponce'), ('F0160','Catalina Venegas'),
--     ('F0171','Nicolas Vielma'), ('F0234','Benjamin Farias'),
--     ('F0234','Jaime Pastor'), ('F0287','Nicolas Carrasco'),
--     ('F0383','Kimberly Castro'), ('F0437','Luz Verdugo'),
--     ('F0521','Juan Diego Marquez'), ('F0544','Constanza Bustamante')
-- )
-- select
--   e.local,
--   e.nombre,
--   c.numero,
--   c.cargo,
--   c.rol_portal,
--   c.activo,
--   case
--     when c.id is null then 'NO insertado (revisar)'
--     when c.cargo <> 'jefe_de_local_quimico_farmaceutico' then 'CARGO inesperado'
--     when not c.activo then 'INACTIVO'
--     else 'OK'
--   end as estado
-- from entrada e
-- left join public.colaboradores c
--   on c.cliente_id = 'grupobaco'
--  and c.local = e.local
--  and c.nombre = e.nombre
-- order by e.local, e.nombre;
--
-- Chequeo de no-regresion (filas previas intactas; esperado: Maria Paz
-- y Paloma Atenas en F0313 + Cesar en OFICINA, sin cambios):
-- select nombre, local, cargo, activo from public.colaboradores
-- where cliente_id = 'grupobaco' and local in ('F0313','OFICINA')
-- order by local, nombre;
-- =====================================================================
