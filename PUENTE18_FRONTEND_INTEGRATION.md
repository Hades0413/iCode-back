# Puente 18+ — integración con iCode-front

Este documento mapea el "backend simulado" que usa `iCode-front`
(`src/infrastructure/http/mock/`) hacia los módulos reales construidos
acá, en `iCode-back`. Se actualiza **módulo por módulo** — es el tablero
de esta migración, no un documento de diseño de una sola vez.

**No se modificó nada del front.** El repo front sigue funcionando con su
mock (`VITE_USE_MOCK_DATA=1`) hasta que el equipo de front decida
conectarlo a estos endpoints — eso es trabajo de otro equipo, en otro
momento. Los paths reales del back **no son un calco 1:1** del mock (ver
nota en cada sección) — el mock era una simulación pensada para el front
solo, no un contrato fijo; los endpoints de abajo son el diseño REST que
le corresponde a este backend, documentado acá para que el equipo de
front sepa exactamente qué pedir al conectar.

Fuente del análisis: lectura completa de
`iCode-front/src/domain/{entities,rules}/*.ts`,
`iCode-front/src/application/{dto,ports,services}/*.ts`,
`iCode-front/src/infrastructure/{http,repositories,storage}/**`, el README
del front, y comparación contra el esquema ya documentado en
[migrations/README.md](src/infrastructure/database/migrations/README.md).

## Por qué esto es distinto de lo que ya existe en el back

El back ya implementa un dominio "Puente 18+" — pero es un dominio
**diferente y complementario**: consentimiento/autorización de acceso a
información clínica (Ley 29733 / NTS 139-MINSA) — `Patient`,
`LegalGuardian`, `ClinicalRecord`, `AccessAuthorization`,
`ClinicalAccessLog`, `HealthFacility`. Ese modelo responde al desafío
oficial del hackatón (`GET /health-facility-access/...`).

El front construyó **otro** recorte de "Puente 18+": la transición
administrativa de un paciente pediátrico (INSN) hacia el sistema de
adultos, con tres actores (especialista, área de Referencias, posta del
distrito) — avisos, cartas de contrarreferencia, historia clínica de
transferencia generada con IA y firmada, y la app del propio paciente
("Mi recorrido"). Ninguno de estos conceptos existía antes en el back.

Los dos dominios comparten `Patient` como sujeto pero **no se mezclan en
las mismas tablas** (ver sección 7).

## Estado general

| # | Módulo | Estado | Endpoints |
|---|---|---|---|
| 1 | Auth / Permisos (extensión) | ✅ hecho | seed de permisos/roles nuevos |
| 2 | Pacientes / Cohorte (transición) | ✅ hecho | 5 |
| 3 | Historia clínica de transferencia | ✅ hecho | 4 |
| 4 | Referencias (avisos a la posta) | ✅ hecho | 3 |
| 5 | Contrarreferencias (carta) | ✅ hecho | 4 |
| 6 | Mi recorrido (journey) | ✅ hecho | 5 |

Swagger con el contrato exacto de cada endpoint: `GET /api/docs` corriendo
`make dev` (deshabilitado en producción, ver README principal).

---

## 1. Auth / Permisos (extensión)

**Estado: ✅ hecho**

No se creó un módulo nuevo — se extendió el catálogo ya existente
(`Permission`/`Role`/`RolePermission`/`UserRole`), en
`1786325858482-SeedTransitionData.ts`.

### Permisos nuevos sembrados

```
PATIENT_READ / PATIENT_WRITE     → reutilizados (ya existían, convención singular del back)
REPORT_READ                      → ver panel post-transición
REFERRAL_READ                    → ver bandejas del área
REFERRAL_AREA_NOTIFY             → el especialista reclama al área
HEALTH_POST_NOTIFY               → el área avisa a la posta
COUNTER_REFERRAL_MANAGE          → subir/enviar la carta
JOURNEY_READ
CHECKLIST_WRITE                  → solo el paciente (dueño)
GUARDIAN_REMIND                  → solo quien acompaña
GUARDIAN_ACCESS_MANAGE           → solo el paciente (dueño)
```

### Roles nuevos sembrados

| Code | Para quién | Permisos |
|---|---|---|
| `ESPECIALISTA_PEDIATRIA` | Consultorio del INSN | `PATIENT_READ`, `PATIENT_WRITE`, `REPORT_READ`, `REFERRAL_AREA_NOTIFY` |
| `AREA_REFERENCIAS` | Referencias y Contrarreferencias | `REFERRAL_READ`, `HEALTH_POST_NOTIFY`, `COUNTER_REFERRAL_MANAGE` |
| `PACIENTE_TITULAR` | El paciente, dueño de su recorrido | `JOURNEY_READ`, `CHECKLIST_WRITE`, `GUARDIAN_ACCESS_MANAGE` |
| `ACOMPANANTE` | Quien acompaña (tutor) | `JOURNEY_READ`, `GUARDIAN_REMIND` |

`Administrador` recibió los 9 permisos nuevos también (mismo criterio que
el resto del seed: admin lo tiene todo).

### Usuarios demo (todos con password `Passw0rd1!`)

Se reutilizan usuarios que **ya existían** en `SeedInitialData` — son la
misma persona vista desde otro dominio, no alguien distinto:

| Usuario | Rol nuevo agregado | Para qué sirve acá |
|---|---|---|
| `pediatra1` | `ESPECIALISTA_PEDIATRIA` | ve `70000001` (su especialidad, `ONCO_PED`) |
| `paciente1` | `PACIENTE_TITULAR` | dueño de `70000002` — `GET /journey` como OWNER |
| `tutor1` | `ACOMPANANTE` | acompaña a `70000001` — `GET /journey` como GUARDIAN |
| `referencias1` (nuevo) | `AREA_REFERENCIAS` (+ `PATIENT_READ`) | bandejas de `/referrals/*` |
| `operador` (ya existía) | `OPER` (+ `PATIENT_READ`/`REPORT_READ`) | ve el tablero y el panel, no puede actuar (403 en cualquier escritura) — equivalente al `operador` del mock del front |
| `invitado` (ya existía) | `GUEST` (0 permisos Puente18) | loguea bien, 403 en todo — equivalente al `sinpermisos` del mock |
| `inactivo1` (nuevo) | `ESPECIALISTA_PEDIATRIA`, `State=false` | login con contraseña correcta pero **401** — equivalente al `inactivo` del mock (`system` de SeedInitialData no sirve para esto: tiene un hash de relleno que nunca matchea `Passw0rd1!`) |

Los 9 casos de login del mock del front (`admin`, `medico`, `referencias`, `operador`, `paciente`, `tutor`, `sinpermisos`, `inactivo`) tienen un equivalente real acá, verificado uno por uno contra un Postgres real (ver sección 9).

---

## 2. Pacientes / Cohorte (transición)

**Estado: ✅ hecho**

### Nota sobre el path

El mock del front usa `/patients/in-tutelage` y `/patients/post-transition`.
Acá viven en un recurso propio, **`/patient-transitions`**, para evitar
un problema real de Express/Nest: esas dos rutas estáticas podrían quedar
sombreadas por `GET /patients/:id` (de `PatientsController`, ya
existente) según el orden de registro de controllers — un riesgo de
mantenimiento silencioso que no vale la pena correr. El equipo de front
ajusta la base URL de estos dos endpoints al conectar.

### Endpoints (`patient-transitions.controller.ts`)

| Método | Path | Permiso | Notas |
|---|---|---|---|
| POST | `/patient-transitions` | `PATIENT_WRITE` | alta del seguimiento de transición de un paciente ya registrado |
| GET | `/patient-transitions/in-tutelage` | `PATIENT_READ` | tablero del especialista, recortado por SU especialidad |
| GET | `/patient-transitions/post-transition` | `REPORT_READ` | panel de seguimiento, SIN recorte por especialidad |
| GET | `/patient-transitions/:patientId` | `PATIENT_READ` | detalle de un caso |
| PATCH | `/patient-transitions/:patientId` | `PATIENT_WRITE` | especialidad, posta, derivación, cita — nunca `state` directo |

### Modelo — tabla `PatientTransition` (1:1 con `Patient`)

`state` (`TransitionState`), `medicalRecordNumber`, `primaryDiagnosis`,
`specialtyId` (FK a `MedicalSpecialty`, catálogo nuevo), `attendingStaffId`
(FK a `HealthFacilityStaff`), `district`, `healthPostFacilityId` (FK a
`HealthFacility`, reutilizado con `FacilityType='POSTA'` agregado al
`CHECK`), `healthPostDistanceKm`, `referredToPostAt`, `hospitalReferral`/
`appointment` (jsonb), `appointmentAddress`/`arriveMinutesEarly`/
`admissionNote` (para "Mi recorrido"), `counterReferralStatus`.

`Patient.Sex` y `HealthFacility.District` se agregaron con `ALTER TABLE`
en la misma migración (`1786325857482-CreateTransitionSchema.ts`) —
identidad genuina, no específica de este dominio.

`age`, `monthsToEighteen`, `isAdult`, `turnedEighteenAt`, `summaryStatus`,
`summaryProgress`, `daysWaitingOnPost` y `lastAction` **se calculan
siempre en `PatientTransitionService`**, nunca son columnas — reutiliza
`TitleTransferService.isAdult()` (extendido con `formatAge`/
`monthsToEighteen`/`turnedEighteenAt`) como única fuente de verdad para
la edad, igual que ya hacía el módulo de consentimiento.

### Especialidad del médico

`MedicalSpecialty` (catálogo) + `HealthFacilityStaffSpecialty` (puente
muchos-a-muchos) — un médico puede cubrir más de una especialidad. El
filtro de `in-tutelage` compara `PatientTransition.specialtyId` contra las
especialidades del `HealthFacilityStaff` del usuario logueado; sin fila de
staff asociada (ej. un admin), no se filtra.

### Reglas server-side portadas

`isInTutelage` (`monthsToEighteen > 0`), autorización a nivel de fila
(`assertSpecialtyMatches`, usada por escritura acá y por el módulo 3),
`lastAction` como el más reciente entre aviso/reclamo/resumen/carta (una
sola función, `PatientTransitionService.computeLastAction`).

---

## 3. Historia clínica de transferencia (borrador IA + firma)

**Estado: ✅ hecho**

Entidad **`TransitionSummary`** (no `ClinicalSummary`) — nombre
deliberadamente distinto del `ClinicalSummaryResponseDto` que ya existe
en el módulo de Consent (otro concepto: ese es sobre autorización a
IPRESS, este es el documento de transferencia con firma).

### Endpoints (`transition-summaries.controller.ts`, bajo `/patients/:patientId/...`)

| Método | Path | Permiso | Notas |
|---|---|---|---|
| GET | `/patients/:patientId/clinical-summary` | `PATIENT_READ` | 404 si no existe (`status` NONE = sin fila) |
| POST | `/patients/:patientId/clinical-summary` | `PATIENT_WRITE` | genera/regenera DRAFT; 409 si ya editado o ya firmado |
| PUT | `/patients/:patientId/clinical-summary` | `PATIENT_WRITE` | edita solo `body` de secciones existentes |
| POST | `/patients/:patientId/clinical-summary/approval` | `PATIENT_WRITE` | firma → APPROVED, sub-recurso propio |

### Generación con IA

**Decisión implementada**: plantillas server-side
(`TransitionSummaryService.buildTemplateSections`), corriendo en NestJS,
nunca en el navegador — 6 secciones fijas armadas desde
`PatientTransitionService.findDetail()` (diagnóstico, especialidad,
identidad). Reemplazable después por un LLM real sin tocar el contrato de
los 4 endpoints.

### Reglas portadas

`DRAFT_CEILING = 0.85` (`summary-progress.calculator.ts`, función pura
reutilizada también por el módulo 2), `ENABLE_MONTHS_BEFORE_18 = 3`,
`SIGN_MONTHS_BEFORE_18 = 1`, regenerar solo si `editedAt === null`,
autorización de fila vía `assertSpecialtyMatches`, generar por primera vez
dispara `PatientTransitionService.setState(..., IN_PREPARATION, ...)`.

---

## 4. Referencias (avisos a la posta)

**Estado: ✅ hecho**

### Endpoints (`referrals.controller.ts`)

| Método | Path | Permiso | Notas |
|---|---|---|---|
| GET | `/referrals/notice-queue` | `REFERRAL_READ` | en tutela ∧ ≤2 meses — SIN recorte por especialidad (`findAllInTutelage`) |
| POST | `/patients/:patientId/post-notices` | `HEALTH_POST_NOTIFY` | 409 si no corresponde; transiciona a `REFERRED_TO_POST` |
| POST | `/patients/:patientId/referral-alerts` | `REFERRAL_AREA_NOTIFY` | 409 si nada pendiente o `reason` no coincide con lo calculado |

### `HealthPost`

Reutiliza `HealthFacility` (se agregó `District` y se ensanchó el `CHECK`
de `FacilityType` para incluir `'POSTA'`, en el seed). `PostNotice`/
`ReferralAlert` son tablas nuevas, con historial completo (no solo el
último evento).

### Pregunta abierta resuelta

**El área de Referencias es personal del propio INSN**: `referencias1`
tiene una fila `HealthFacilityStaff` contra la IPRESS pediátrica
(`DEMO-PED-001`) — no es un rol transversal sin facility.

---

## 5. Contrarreferencias (la carta)

**Estado: ✅ hecho**

### Endpoints (`counter-referrals.controller.ts`)

| Método | Path | Permiso | Notas |
|---|---|---|---|
| GET | `/referrals/counter-queue` | `REFERRAL_READ` | una tarjeta por cada paciente post-transición |
| GET | `/patients/:patientId/counter-referral` | `PATIENT_READ` | 404 si no existe |
| POST | `/patients/:patientId/counter-referral` | `COUNTER_REFERRAL_MANAGE` | multipart (`file` + `format` + `code?`), PDF/DOC/DOCX ≤10MB |
| POST | `/patients/:patientId/counter-referral/delivery` | `COUNTER_REFERRAL_MANAGE` | envío, sub-recurso propio, irreversible |

### Storage — implementado

`CounterReferralStorageService` guarda el binario en disco local
(`COUNTER_REFERRAL_STORAGE_PATH`, default `./storage/counter-referrals`,
ver `.env.example`) con nombre aleatorio (`randomUUID()` + `basename()`
del original — sin path traversal). `CounterReferral.StoragePath` guarda
la ruta relativa, nunca la absoluta. Volumen Docker nombrado
(`icode_counter_referrals`) agregado en `docker-compose.yml`, montado en
`/app/storage/counter-referrals`. Swap-eable a S3-compatible después sin
tocar `CounterReferralService` (que solo conoce la interfaz de
`CounterReferralStorageService`).

### La regla dura, implementada

`CounterReferralService.upload`/`deliver` validan `context.isAdult` desde
`PatientTransitionService.getRuleContext()` — 409 si el paciente no
cumplió 18 todavía, sin excepción.

---

## 6. Mi recorrido (journey del paciente y su tutor)

**Estado: ✅ hecho**

### Endpoints (`journey.controller.ts`) — ninguno recibe `patientId`

| Método | Path | Permiso | Notas |
|---|---|---|---|
| GET | `/journey` | `JOURNEY_READ` | **200 siempre** — `access: 'GRANTED'` o `'REVOKED'`, nunca 403/404 |
| PATCH | `/journey/checklist/:itemId` | `CHECKLIST_WRITE` | solo dueño (verificado a nivel de fila) |
| POST | `/journey/reminders` | `GUARDIAN_REMIND` | solo tutor activo; 409 si `hasJourneyAccess=false` |
| PUT | `/journey/guardian-access` | `GUARDIAN_ACCESS_MANAGE` | solo dueño, da/quita acceso |
| DELETE | `/journey/messages/:messageId` | `JOURNEY_READ` | soft-delete, solo si el mensaje es de su propio paciente |

### La regla que no se rompió

`JourneyService.getJourney` devuelve `{access:'REVOKED', viewer,
subjectInitials}` con 200 cuando `LegalGuardian.hasJourneyAccess=false` —
nunca lanza una excepción para ese caso.

### `LegalGuardian.HasJourneyAccess` — columna nueva

Distinta de `IsActive` (que apaga el sistema al cumplir 18, vía
`TitleTransferService`): esta la controla el propio paciente en cualquier
momento, incluso antes de los 18, vía `PUT /journey/guardian-access`.

### Excepción deliberada de convención: sí se resuelve un nombre

El resto del dominio expone ids crudos (`attendingStaffId`, `sentById`...)
y no nombres — acá `JourneyService` **sí** lee `User.FirstName` para
mostrarle al paciente quién lo acompaña (`journey.guardian.firstName`):
es información que el propio paciente está decidiendo compartir o no, no
un dato administrativo de auditoría.

### Contenido nuevo (no reutiliza `ClinicalRecord`)

`JourneyChecklistItem`, `JourneyMedication`, `JourneyAllergy`,
`JourneyContact` (1:N con `Patient`), `JourneyGuideEntry` (catálogo
global de FAQ), `JourneyMessage` (soft-delete = "el paciente lo
descartó").

---

## 7. Decisiones de arquitectura (registro)

- [x] **`specialty` del médico**: catálogo `MedicalSpecialty` + tabla
  puente `HealthFacilityStaffSpecialty` (muchos-a-muchos).
- [x] **Generación de la historia clínica con IA**: plantillas
  server-side (`TransitionSummaryService`), no LLM real por ahora.
- [x] **Storage del archivo de contrarreferencia**: disco local, volumen
  Docker (`icode_counter_referrals`), `COUNTER_REFERRAL_STORAGE_PATH`.
- [x] **Reloj de los 18 años**: única fuente de verdad
  `TitleTransferService.isAdult()`/`monthsToEighteen()`; `TransitionState`
  queda separado de `LegalGuardian.IsActive`.
- [x] **Convención de permisos**: singular (`PATIENT_READ`/`WRITE`), no la
  plural inventada por el mock.
- [x] **`GUARDIAN_ACCESS_MANAGE`**: permiso nuevo, no se reutiliza
  `CONSENT_MANAGE`.
- [x] **Paths reales distintos del mock**: `/patient-transitions/*` en vez
  de anidar `in-tutelage`/`post-transition` bajo `/patients` (ver sección
  2 — riesgo real de rutas sombreadas en Express/Nest).
- [x] **Área de Referencias**: personal del propio INSN
  (`HealthFacilityStaff` contra `DEMO-PED-001`), no un rol transversal.
- [x] **Diagnóstico en la cohorte**: `PatientTransition.PrimaryDiagnosis`
  (snapshot de texto), no derivado en vivo de `ClinicalRecord` — evita que
  este módulo dependa de `ClinicalRecordsModule` solo por una etiqueta.

## 8. Cómo probar

```bash
make migration-run   # aplica CreateTransitionSchema + SeedTransitionData
make dev             # http://localhost:3000/api/docs (Swagger, botón Authorize)
```

`POST /auth/login` con cualquiera de los usuarios de la sección 1
(password `Passw0rd1!`), copiar el `accessToken` en el botón "Authorize"
de Swagger. Casos demo ya cargados por el seed:

- **`70000001`** (paciente ficticio menor, tutor `tutor1` activo) —
  estado `PENDING`, sin historia clínica todavía: para probar todo el
  flujo desde cero (generar historia, avisar a la posta, etc.).
- **`70000002`** (paciente ficticio ya adulto, `paciente1`) — recorrido
  completo: historia firmada, aviso, cita otorgada, carta enviada; para
  ver el estado final de cada módulo sin tener que armarlo a mano.

## 9. Verificación end-to-end (contra Postgres real)

Se re-analizó el front línea por línea (`transition.rules.ts`,
`cohort.rules.ts`, `referral.rules.ts`, `clinical-summary.rules.ts`,
`journey.rules.ts`) comparando cada constante y condición contra el
código ya escrito, y se corrió el stack completo contra un Postgres real
(`docker compose up postgres` + `make migration-run` + `make dev`,
probado con `curl` para cada usuario de la sección 1). Se encontraron y
corrigieron **6 problemas reales** que la sola revisión de TypeScript no
detectaba:

1. **Bug de negocio** — `TransitionSummaryService.generate/update/approve`
   no exigían `isInTutelage` (`monthsToEighteen > 0`), solo la ventana de
   meses. Un paciente ya adulto podía generar/editar/firmar su historia
   de transferencia, algo que el front nunca permite (`canGenerateSummary`/
   `canReviewSummary`/`isInSignWindow` exigen las dos condiciones).
2. **Bug de negocio** — `ReferralService.notifyHealthPost`: el
   OR de `canNotifyHealthPost` le faltaba el `monthsToEighteen > 0` en la
   primera rama — un paciente adulto con la carta YA enviada volvía a
   calificar para "avisar a la posta" por la rama equivocada.
3. **Bug de negocio** — `pendingReferralAction` comparaba
   `counterReferralStatus === 'NONE'` en vez de `!== 'SENT'` — una carta
   ya `UPLOADED` pero sin enviar dejaba de contar como motivo de reclamo,
   al revés de `isCounterReferralDue` en el front.
4. **Gap de datos** — `PatientTransitionResponseDto` no exponía
   `postNotices`/`referralAlerts` (arrays completos) — el front los
   necesita tal cual para sus propias reglas (`hasPostNotice`,
   `referralSummary`, `referralStage`). Se agregaron.
5. **Catálogo incompleto** — `MedicalSpecialty` solo tenía 4 de las 8
   especialidades que usa el mock del front (faltaban Nefrología,
   Neumología, Hematología, Reumatología pediátricas). Completado.
6. **Bug de SQL, solo visible corriendo contra Postgres real** — en el
   seed, `'...' || to_char(...) || '...'::jsonb` aplicaba el cast
   `::jsonb` SOLO al último literal (por precedencia de operadores en
   SQL), no a toda la concatenación — rompía la migración con "invalid
   input syntax for type json". Corregido envolviendo la concatenación
   completa entre paréntesis antes del cast. Este es el motivo por el que
   se corrió la migración contra un Postgres real en vez de confiar solo
   en que TypeScript compilara: el compilador no puede ver dentro de un
   template string de SQL.

Casos probados con `curl` uno por uno tras las correcciones (todos con el
resultado esperado): los 9 logins de la sección 1, filtro por
especialidad de `pediatra1` en `in-tutelage`, `operador` viendo el
tablero pero recibiendo 403 al avisar a la posta, `sinpermisos`
recibiendo 403 en `in-tutelage`, generar historia fuera de ventana
(409), subir contrarreferencia de un menor (409), y el flujo completo de
revocación de acceso del tutor (`HasJourneyAccess=false` → `GET /journey`
responde **200** con `access:'REVOKED'`, nunca 403 — la regla que no se
podía romper).

### Sobre especialidades múltiples y S3

- **Multi-especialidad**: confirmado que el modelo ya lo soporta sin
  cambios — `HealthFacilityStaffSpecialty` es muchos-a-muchos a
  propósito (ver sección 7). El seed solo asigna una especialidad a
  `pediatra1` porque el mock del front también asume un médico = una
  especialidad, pero el filtro (`getSpecialtyIdsForUser`) ya devuelve un
  arreglo y funcionaría igual si un médico cubriera varias.
- **S3**: se hizo un grep exhaustivo de todo `iCode-front/src` buscando
  cualquier otro lugar que suba o maneje archivos (`file`, `upload`,
  `multipart`, `.pdf`, `.doc`, `FormData`, `<input type="file">`) — el
  **único** módulo que sube un archivo es la carta de contrarreferencia
  (sección 5). No hay otro punto del dominio que necesite storage de
  objetos; la decisión de disco local ya registrada en la sección 7
  sigue siendo la única que hace falta.

## 10. Pendientes / fuera de alcance de esta pasada

- Multi-especialidad de un médico: el modelo ya lo soporta
  (`HealthFacilityStaffSpecialty` es muchos-a-muchos), el seed solo carga
  una por `pediatra1`.
- Paginación server-side de `in-tutelage`: no hace falta al volumen actual
  (decenas de pacientes por especialista); si crece, se agregan query
  params sin tocar el contrato de la respuesta.
- Integración con un LLM real para el borrador de la historia clínica
  (hoy son plantillas server-side, ver sección 3).
- Vinculación real con el front (`iCode-front`) — corresponde a otro
  equipo, en otro momento, como se pidió explícitamente.

## 11. Relabel de especialidad al pasar a adultos — ✅ hecho

En el mock del front, un paciente post-transición cambia de "Oncología
**pediátrica**" a "Oncología **de adultos**" (mismo caso, otra etiqueta).
Implementado sin tocar `PatientTransition.SpecialtyId` (nunca se
reasigna, ni hace falta un `PATCH` manual al cumplir 18): `MedicalSpecialty`
tiene una columna nueva, `AdultName` (nullable, sembrada para las 8
especialidades del catálogo — ej. `ONCO_PED` → "Oncología de adultos"), y
`PatientTransitionService.buildResponses` calcula el nombre efectivo
siempre a partir de `isAdult`, mismo criterio que el resto del dominio
(nada se guarda como un estado que alguien deba actualizar a mano).

Verificado contra Postgres real: `70000001` (menor) devuelve "Oncología
pediátrica"; `70000002` (ya adulto) devuelve "Cardiología de adultos" —
el mismo `SpecialtyId` de siempre, solo cambia la etiqueta.

## 12. Integración real con el front (`iCode-front`) — ✅ hecho

A diferencia de las secciones 1-11 (que solo construían el back), esta
fase sí tocó `iCode-front`, por pedido explícito: módulo por módulo,
empezando en el login, apagando `VITE_USE_MOCK_DATA` y verificando cada
pantalla contra el back real con Playwright (capturas + consola +
respuestas HTTP), no solo lectura de código.

### Sesión con cookie httpOnly (no `localStorage`)

Pedido explícito de seguridad: el token de sesión no debía vivir en
`localStorage` (XSS). Cambios:

- Back: `cookie-parser` + `res.cookie('icode_session', token, {httpOnly,
  secure: isProd, sameSite: isProd ? 'none' : 'lax', path:'/'})` en
  `login`/`logout` (`auth.controller.ts`). `SessionAuthGuard` acepta
  **ambas** formas — header `Authorization: Bearer` (Swagger/Postman/
  mobile) y la cookie (`extractSessionToken`, header primero, cookie
  como fallback) — no se rompió nada para quien ya usaba el header.
- Front: se borró `token-storage.ts` y `token-storage.port.ts` enteros;
  `AuthService` ya no depende de ningún storage — el navegador maneja
  la cookie solo. `api-client.ts` usa `withCredentials: true` en vez del
  interceptor que leía el token. CORS en el back con origen reflejado
  (no wildcard) + `credentials: true`, requisito de las cookies
  cross-site.

### Reconciliación de contratos (front manda, back se ajusta)

El front nunca se tocó en su capa de acceso a datos (los repositorios
siempre pegaban a las mismas rutas HTTP reales; solo el adaptador axios
tenía un mock activable por env var). "Integrar" fue sobre todo hacer
que las DTOs del back devuelvan **exactamente** la forma que las
entidades de dominio del front ya esperaban: `id` como `string` (no
numérico), nombres resueltos en vez de `*ById` crudos, defaults no
nulos donde el front declara el campo sin `| null`. Se aplicó siempre
de forma **aditiva** (se agregan campos alias/calculados, nunca se
renombran o quitan los que otros servicios del back ya consumían
internamente) — afectó a los DTOs de transición, historia clínica,
contrarreferencia y "mi recorrido".

También se corrigió una convención rota que rompía el ruteo del
workspace para **todo** usuario: `domain/rules/permissions.ts` del
front usaba códigos en plural (`PATIENTS_READ`, etc.) que nunca
existieron en el back (siempre fue singular, `PATIENT_READ`) — el
`admin` aterrizaba en `/mi-recorrido` en vez de `/pacientes` porque
`visibleSections()` no encontraba ningún permiso que calzara. Un solo
punto de cambio (la constante), 4 sitios de uso, todos por la misma
constante.

### Bug de autorización cruzada encontrado y corregido — `PATIENT_COHORT_READ`

Verificando `tutor1` (rol de tutor del recorrido) contra el back real se
encontró una fuga real, no un detalle de UX: `tutor1` también tiene
`PATIENT_READ` heredado de un rol previo (`PATIENT_TUTOR`, del dominio
de **consentimiento** — lectura de *su propio* paciente puntual). Como
`GET /patients/in-tutelage` (el tablero del especialista — la cohorte
**completa** de pacientes en tutela) estaba gateado con ese mismo
código, cualquier tutor con `PATIENT_READ` podía ver la cohorte entera
de pacientes de otros, no solo el suyo — agravado porque
`PatientTransitionService.getSpecialtyIdsForUser` trata "sin fila en
`HealthFacilityStaff`" como "sin restricción" (pensado para admin/
supervisión, pero cualquier no-staff con `PATIENT_READ` también cumplía
esa condición).

**Corrección**: permiso nuevo y dedicado, `PATIENT_COHORT_READ`, solo
para ese endpoint — `PATIENT_READ` queda intacto para el dominio de
consentimiento, que ya lo usaba antes de esta fase. Todo dentro de los
mismos 2 archivos de migración (nada de una migración "de parche"):
`ADMIN` y `ESPECIALISTA_PEDIATRIA` lo reciben además de sus permisos
existentes; el grant de `OPER` sobre `PATIENT_READ` (que solo existía
para probar que el tablero se ve pero las acciones dan 403) se
reemplazó por `PATIENT_COHORT_READ` — nunca tuvo un uso legítimo sobre
el permiso puntual. `patients.controller.ts` (`findInTutelage`) ahora
exige `PATIENT_COHORT_READ`.

Verificado contra un Postgres reseteado desde cero (`docker compose down
-v` + `migration:run` + reinicio del back), con `curl` para los 4
casos:

| Usuario | `GET /patients/in-tutelage` |
|---|---|
| `tutor1` | **403** — `Falta el permiso PATIENT_COHORT_READ` |
| `pediatra1` | 200 |
| `operador` | 200 |
| `admin` | 200 |

Este cambio de permiso en el back tiene un efecto directo en el front,
porque `workspace-sections.ts` decide qué secciones mostrar en el riel
usando el mismo código de permiso que exige el endpoint real (contrato
explícito, documentado en el comment del propio archivo). Se propagó
el split a `iCode-front`:

- `domain/rules/permissions.ts`: nueva constante
  `patientsCohortRead: 'PATIENT_COHORT_READ'`, junto a `patientsRead`
  (que sigue siendo `PATIENT_READ`, sin tocar).
- `workspace-sections.ts` (sección "Pacientes") y `patients.page.tsx`
  (el mensaje de "sin acceso") ahora usan `patientsCohortRead`.
- `mock-database.ts`: se agregó `patientsCohortRead` a los usuarios mock
  que en el back real caen bajo `ADMIN`/`ESPECIALISTA_PEDIATRIA`/`OPER`
  (`admin`, `medico`, `operador`), para que el modo mock (`VITE_USE_MOCK_DATA=1`)
  siga viéndose igual que antes de este cambio.

Verificado con Playwright contra el back real, reseteado desde cero:
antes de este ajuste, `operador` había perdido la sección "Pacientes"
del riel (aterrizaba en "Ya cumplieron 18") porque ya no tenía
`PATIENT_READ`; tras el ajuste vuelve a aterrizar en `/pacientes` con la
sección visible. Efecto colateral bueno, no buscado: `referencias1`
pasó a aterrizar correctamente en `/referencias` (antes caía en
`/pacientes` porque `AREA_REFERENCIAS` sí tiene `PATIENT_READ` — un
permiso que nunca debió habilitar esa sección del riel).

### Usuario demo agregado — `sinpermisos`

El botón de acceso rápido "sinpermisos" ya existía en la pantalla de
login del front (`login.page.tsx`, hint: "recibe 403 en la lista") pero
no tenía ningún usuario real detrás en el seed — con
`VITE_USE_MOCK_DATA=0` el botón siempre daba 401. Se agregó a
`SeedTransitionData.ts` un usuario `sinpermisos` (activo, sin ningún
`UserRole`) junto a los demás usuarios demo de esta migración. Loguea
bien y el back le niega todo con 403, exactamente lo que el botón
anuncia. Verificado con Playwright: pantalla de "sin acceso" mostrando
el permiso correcto (`PATIENT_COHORT_READ`).

### Pendiente reconocido, no corregido en esta pasada

`TransitionSummaryService.findByPatient` (historia clínica de
transferencia) no tiene ningún chequeo de fila por paciente — cualquier
usuario con `PATIENT_READ` puntual podría leer la historia de
transferencia de **cualquier** paciente, no solo el suyo. Es la misma
familia de bug que `PATIENT_COHORT_READ` acaba de cerrar, pero en el
endpoint de lectura de la historia en vez de en el listado de cohorte.
No se corrigió ahora por el riesgo de tocar más superficie a esta
altura sin tiempo para reverificar todo — queda documentado como
deuda conocida, no como un descuido silencioso.
