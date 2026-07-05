# Pauta de pruebas — Módulo Caja Chica (preview)

Checklist por rol para validar el módulo en preview antes de mergear a `main`.
Requisito: SQL `01`–`06` aplicados; provisioning `07` ejecutado (usuarios y
áreas); Derivaciones configuradas (área `caja_chica` con correo del revisor).

Marca cada casilla al verificar. Donde diga **REST directo**, probar con la
anon key + token del usuario contra `…/rest/v1/…` (no solo la UI).

---

## 1. QF (responsable de un local con fondo, p. ej. local A)

- [ ] Ve el ítem **Caja chica** en el sidebar; ve **Casos** y **Ajustes** de su local.
- [ ] "Nueva rendición" abre un borrador; una segunda vez **reabre el mismo** (no crea otro).
- [ ] Agrega gastos (fecha, monto, tipo, forma de pago, N° doc) con **boleta**; la boleta queda visible en la fila.
- [ ] Editar un gasto in-place conserva su boleta; eliminar un gasto recalcula el **total**.
- [ ] El **saldo disponible** aparece (fondo − aprobado no pagado).
- [ ] Al superar el fondo: **badge/alerta "Excede fondo"** (blanda, NO bloquea el envío).
- [ ] "Enviar a revisión" exige ≥1 gasto; congela el fondo, marca `excede_fondo`, dispara correo.
- [ ] Tras enviar, **no puede** agregar/editar/eliminar gastos (ni por UI ni por REST).
- [ ] No ve botones de revisión/cierre/pago.
- [ ] Tras el pago, ve el **comprobante** (solo lectura, sin poder subir/eliminar).
- [ ] **REST directo:** `GET /rest/v1/rendiciones_caja_chica?select=*` → solo su local A.

## 2. Gestor solo Caja chica (`areas = ['caja_chica']`)

- [ ] Sidebar muestra **solo Caja chica** (NO Ajustes, NO Casos).
- [ ] Ve rendiciones de todos los locales; puede filtrar por local.
- [ ] Revisa **gasto por gasto**: aprobar / rechazar (rechazo exige observación).
- [ ] "Cerrar revisión" exige que no queden gastos pendientes; resultado correcto
      (aprobada / aprobada_parcial / rechazada) y `total` = suma de **aprobados**.
- [ ] **Arrastre:** los gastos rechazados aparecen `pendiente` en el borrador de la unidad,
      conservando datos, boleta y la observación de rechazo.
- [ ] Sube el **comprobante** y marca **Pagada**; sin comprobante, el pago se rechaza (400).
- [ ] Correos de enviada y resuelta llegan con los datos correctos.
- [ ] **REST directo:** puede leer rendiciones del cliente; NO puede tocar ajustes ni casos.

## 3. Gestor solo Ajustes (`areas = ['ajustes_inventario']`)

- [ ] Sidebar muestra **solo Ajustes** (NO Caja chica, NO Casos).
- [ ] Entrar a `/caja-chica` manualmente → "No tienes acceso".
- [ ] Gestiona ajustes normalmente.

## 4. María Andrea — supervisión (`areas=['operaciones']`, `areas_supervisa=['ajustes_inventario']`)

- [ ] Sidebar muestra **Casos** (por `operaciones`) y **Ajustes** (por supervisión); NO Caja chica.
- [ ] Ve **todos** los ajustes (control), pero **sin botones** de realizar/anular.
- [ ] `/api/ajustes/[id]` (PATCH) le responde 403 (supervisar ≠ gestionar).
- [ ] **REST directo:** `GET /rest/v1/ajustes_inventario?select=*` devuelve todos (lectura), pero UPDATE es rechazado por RLS.

## 5. FTEST — aislamiento multi-cliente

- [ ] Usuario de otro cliente NO ve ninguna rendición/gasto/tipo/fondo de grupobaco (UI y REST).
- [ ] `GET /rest/v1/rendiciones_caja_chica?select=*` como FTEST → solo su cliente (o vacío).
- [ ] `GET /rest/v1/adjuntos?select=*` → no expone boletas/comprobantes de grupobaco.

## 6. Admin

- [ ] Configuración → **Tipos de gasto**: alta/edición/baja se refleja al cargar gastos.
- [ ] Configuración → **Caja chica**: edita `monto_asignado` y `correo` por local; instrucciones se guardan.
- [ ] Las **instrucciones** aparecen como panel en el listado y en el detalle de rendición.
- [ ] Métricas: sección **Caja chica** (total del periodo, por revisar, por pagar, alertas de exceso).
- [ ] Puede ejecutar todas las acciones (crear, enviar, revisar, cerrar, pagar).

## 7. Cron de recordatorio

- [ ] `GET /api/caja-chica/recordatorio` sin secreto → 401.
- [ ] Con `Authorization: Bearer <CRON_SECRET>` pero **no** último día → `{ skipped }`.
- [ ] Con secreto + `?force=1` → envía a cada unidad con fondo o borrador abierto.
- [ ] Destinatario: `locales.correo` → si falta, `local_correo` de la última rendición → si falta, César (con aviso).
- [ ] Cron-job.org configurado al último día del mes apuntando a la ruta con el secreto.

---

**Regresión:** casos y ajustes siguen funcionando igual (crear/cerrar, adjuntos,
correos). Si algo dejó de verse, revisar una política o gate de más.
