# Migraciones

Aquí vive el historial versionado del esquema de la base de datos. Cada archivo es
un cambio (crear tabla, agregar columna, índice, etc.) con fecha en el nombre, así
cualquier colaborador puede ver en orden qué se creó y cuándo, y ejecutarlo o
revertirlo contra su propia base de datos.

## Crear una migración con tu propio SQL

```bash
pnpm migration:create src/infrastructure/database/migrations/CreateUsersTable
```

Esto genera un archivo `<timestamp>-CreateUsersTable.ts` con esta forma. Dentro
escribes tu SQL tal cual lo tengas, en `up` (aplicar) y `down` (revertir):

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsersTable1699999999999 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" SERIAL PRIMARY KEY,
        "email" VARCHAR(255) NOT NULL UNIQUE,
        "created_at" TIMESTAMP NOT NULL DEFAULT now()
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "users";`);
  }
}
```

## Alternativa: generar la migración a partir de tus entidades

Si defines tus entidades en `src/domain/entities` con decoradores de TypeORM,
puedes dejar que TypeORM compare el esquema y genere el SQL automáticamente:

```bash
pnpm migration:generate src/infrastructure/database/migrations/CreateUsersTable
```

## Ejecutar / revertir

```bash
pnpm migration:run      # aplica las migraciones pendientes
pnpm migration:revert   # revierte la última migración aplicada
```

TypeORM guarda en la tabla `migrations` de Postgres cuáles ya corrieron, así que
nunca se re-ejecutan por error. Esta regla rige desde el primer despliegue real
a un ambiente compartido: **nunca edites una migración ya aplicada ahí — crea
una nueva que corrija lo necesario.** Antes de ese primer despliegue (como
ahora: el proyecto todavía no corrió en ningún ambiente compartido) vale lo
contrario — mejor consolidar en una migración limpia que ir arrastrando
parches que nadie más ejecutó todavía.

## Esquema inicial

Todo el esquema (identidad/RBAC + el dominio "Puente 18+", ver
`prompt_contexto_backend_puente18.md` en la raíz) vive en exactamente dos
migraciones:

- `1786325855482-CreateInitialSchema.ts` — crea todas las tablas, triggers y
  vistas, en el orden que piden las FK.
- `1786325856482-SeedInitialData.ts` — todos los datos de arranque (admin,
  roles, permisos, menú de navegación, IPRESS ficticias, pacientes/tutores de
  ejemplo).

Quien clone el repo hoy corre `make migration-run` una vez y queda con el
esquema completo — no hay una segunda o tercera migración "parche" que
modifique con `ALTER TABLE` algo que la primera ya creó. La sección "Puente
18+" más abajo documenta ese dominio en detalle; que comparta archivo de
migración con identidad es solo un detalle de cómo se aplica el esquema, no
un acoplamiento entre los módulos de Nest (que siguen totalmente separados en
el código — ver esa sección).

El menú de navegación es un único árbol recursivo en la tabla `Menu`
(`ParentMenuId`), no un par `Menu`/`SubMenu` de dos niveles fijos: un nodo sin
padre es un grupo (ej. "Usuarios"), un nodo con padre y `Url` es un enlace (ej.
"Gestión Usuarios"), y se puede anidar a cualquier profundidad sin tocar el
esquema.

Consultas de referencia (no se ejecutan solas, son para explorar el árbol):

El ícono de cada ítem NO vive aquí: es una decisión del front (mapea su
propio `Record<Code, IconComponent>` usando `Menu.Code`), así el backend no
cambia cada vez que diseño ajusta un ícono.

```sql
-- Árbol completo: cada grupo raíz con sus enlaces hijos
SELECT
    padre."Id"          AS "MenuId",
    padre."Code"        AS "MenuCode",
    padre."Name"        AS "MenuName",
    padre."DisplayOrder" AS "MenuOrder",
    hijo."Id"           AS "SubMenuId",
    hijo."Code"         AS "SubMenuCode",
    hijo."Name"         AS "SubMenuName",
    hijo."Url"          AS "SubMenuUrl"
FROM "Menu" padre
LEFT JOIN "Menu" hijo
    ON hijo."ParentMenuId" = padre."Id"
   AND hijo."State" = true
   AND hijo."DeletedAt" IS NULL
WHERE padre."ParentMenuId" IS NULL
  AND padre."State" = true
  AND padre."DeletedAt" IS NULL
ORDER BY padre."DisplayOrder", padre."Name", hijo."Name";

-- Enlaces de menú permitidos para un rol (cambia 1 por el RoleId a consultar)
SELECT
    padre."Id"          AS "MenuId",
    padre."Code"        AS "MenuCode",
    padre."Name"        AS "MenuName",
    padre."DisplayOrder" AS "MenuOrder",
    hijo."Id"           AS "SubMenuId",
    hijo."Code"         AS "SubMenuCode",
    hijo."Name"         AS "SubMenuName",
    hijo."Url"          AS "SubMenuUrl"
FROM "Menu" padre
JOIN "Menu" hijo
    ON hijo."ParentMenuId" = padre."Id"
   AND hijo."State" = true
   AND hijo."DeletedAt" IS NULL
JOIN "RoleMenu" rm
    ON rm."MenuId" = hijo."Id"
   AND rm."RoleId" = 1
   AND rm."DeletedAt" IS NULL
WHERE padre."State" = true
  AND padre."DeletedAt" IS NULL
ORDER BY padre."DisplayOrder", padre."Name", hijo."Name";
```

## Autoría: CreatedBy/UpdatedBy/DeletedBy

En las 12 tablas, estas columnas son `CreatedById`/`UpdatedById`/`DeletedById`:
FK reales a `User.Id`, no un `varchar` con el username pegado como texto. Si
un usuario cambia de `UserName`, el historial de qué creó/modificó/borró
sigue apuntando al mismo Id — con texto libre, se hubiera quedado apuntando
a un nombre que ya no existe.

Por eso `User` se crea antes que cualquier otra tabla del esquema: todo lo
demás necesita poder apuntarle. Esas FK de autoría no tienen `ON DELETE
CASCADE` (a propósito, a diferencia de las FK "de relación" como
`RoleMenu -> Role`): no se puede borrar de verdad a un usuario que quedó
registrado como autor de algo — hay que darlo de baja con `DeletedAt`, como
todo lo demás en este esquema. Como efecto colateral, esto protege sin
esfuerzo extra a la cuenta `system` del seed: en la práctica siempre hay
algo que la referencia como `CreatedById`, así que la base de datos misma
impide borrarla.

La única excepción documentada es `User.CreatedById`, que si es nullable:
el primer usuario que existe en toda la base (`system`, ver seed) no puede
tener un autor porque todavía no hay nadie más — `NULL` ahí significa "el
origen, sin autor previo", no un dato faltante.

## Roles y permisos

### Para qué existe cada tabla

- **`Permission`**: el catálogo de acciones que existen en el sistema
  (`USR_WRITE`, `PATIENT_WRITE`...). No dice quién puede hacerlas, solo que
  existen. `MenuId` es metadata (a qué pantalla pertenece, para agruparlas
  en una UI de administración) — **no participa en la autorización**.
- **`Role`**: una etiqueta con la que se agrupan permisos para asignarlos
  en bloque (`Administrador`, `Personal de Salud`...). `Code` es la clave
  estable para chequear roles en código (`role.Code === 'ADMIN'`); `Name` es editable
  por un admin y nunca debería usarse en lógica de negocio, porque
  renombrarlo no debe romper permisos. `IsSystemRole` marca roles
  protegidos (hoy solo `Administrador`): la aplicación debe bloquear su
  borrado y evitar quedarse sin ningún usuario con ese rol.
- **`RolePermission`**: qué permisos tiene cada rol. Es la única tabla que
  debe consultar un guard/middleware en el servidor para autorizar una
  acción (a través de la vista `UserPermission`, ver abajo).
- **`RoleMenu`**: qué aparece en el sidebar para un rol. Es puramente de
  navegación/UX. **Nunca autorices en base a `RoleMenu`**: ocultar un ítem
  del menú no impide que alguien llame al endpoint directamente (OWASP
  A01: Broken Access Control — la autorización siempre se decide en el
  servidor, no ocultando botones).

### Cómo funciona realmente (multi-rol)

Un usuario puede tener **varios roles a la vez** (`UserRole` es muchos-a-
muchos). Sus permisos reales no son los de "su rol actual" — no existe tal
cosa — son la **unión** de los permisos de *todos* sus roles activos. El
modelo es solo de concesión (no hay "deny" explícito) y niega por defecto:
sin roles, o con el rol/permiso desactivado (`State = false`) o dado de
baja (`DeletedAt`), el acceso se pierde de inmediato sin tocar una sola
fila de `RolePermission` (fail-closed).

Esa unión está resuelta en dos vistas creadas junto con el esquema, para
que nadie tenga que reimplementar el join (y arriesgarse a olvidar filtrar
un rol desactivado):

```sql
-- Todos los permisos que tiene un usuario, sumando sus roles activos
SELECT * FROM "UserPermission" WHERE "UserId" = 1;

-- Lo mismo, pero para saber si un usuario puede hacer algo puntual
SELECT EXISTS (
  SELECT 1 FROM "UserPermission"
  WHERE "UserId" = 1 AND "PermissionCode" = 'USR_WRITE'
);

-- Menú de navegación que le corresponde ver a un usuario
SELECT * FROM "UserMenu" WHERE "UserId" = 1;
```

Un guard de NestJS para proteger un endpoint debería, en esencia, ejecutar
la segunda consulta — nunca revisar `req.user.role` como si solo pudiera
tener uno.

### Auditoría de cambios de autorización

Cada INSERT/UPDATE/DELETE en `UserRole` y `RolePermission` (dar o quitar un
rol a un usuario, dar o quitar un permiso a un rol) se registra solo en
`Audit` vía trigger — no hace falta que cada endpoint de administración se
acuerde de loguearlo (OWASP A09: Security Logging and Monitoring
Failures). `RoleMenu` no se audita ahí porque no es una frontera de
seguridad, solo de UX.

## Puente 18+ (dominio clínico)

Todo lo de esta sección responde a `prompt_contexto_backend_puente18.md`
(hackatón "Niño San Borja 2026", desafío de transición pediátrico→adulto).
Vive en tablas y módulos de Nest separados del dominio de identidad
(`User`/`Role`/`Permission`...) a propósito: modificar el historial
clínico de un paciente nunca debería poder romper el login o el RBAC, ni
al revés. Los tres módulos (`PatientsModule`, `ClinicalRecordsModule`,
`ConsentModule`) importan uno del otro en UN solo sentido — Consent
depende de Clinical y de Patients, ninguno de los otros dos sabe que
Consent existe.

### Tablas

- **`HealthFacility`**: catálogo de IPRESS simuladas (no hay integración
  real con RENHICE en este prototipo).
- **`HealthFacilityStaff`**: a qué IPRESS pertenece un usuario de personal
  de salud (`UserId` único). Es una tabla de unión propia, no una columna
  en `User`: como toda tabla de este esquema necesita que `User` ya
  exista para su `CreatedById`, y `HealthFacility` a su vez necesita que
  `User` exista para lo mismo, no hay forma de que `User` tenga una FK a
  `HealthFacility` sin crear una dependencia circular — la única salida
  limpia (sin `ALTER TABLE "User"` después de creada) era no tocar `User`
  en absoluto.
- **`Patient`**: el sujeto clínico, no una cuenta de acceso. Puede no
  tener `UserId` (típico mientras es menor y nunca inició sesión él
  mismo).
- **`LegalGuardian`**: vincula el `User` de un tutor con el `Patient` que
  representa. `IsActive` es la mitad "semi-automática" del traspaso de
  titularidad (ver abajo) — al cumplir el paciente 18, sus tutores pasan
  a `IsActive = false` sin borrar el vínculo histórico.
- **`ClinicalRecord`**: un ítem del historial (diagnóstico, medicación,
  alergia, cirugía o examen — `RecordType`). `SensitivityLevel` es POR
  REGISTRO, no por tipo ni por paciente: un mismo paciente puede tener un
  diagnóstico `BASICA` (ej. asma) y otro `SENSIBLE` (ej. VIH) al mismo
  tiempo. `Details` (jsonb) guarda lo específico de cada tipo en vez de
  usar una tabla por tipo — 5 CRUDs casi idénticos hubiera sido
  sobre-diseño para un prototipo de hackatón.
- **`AccessAuthorization`**: el consentimiento explícito de la Ley 29733
  — un titular autoriza a UNA IPRESS a ver su información `BASICA`,
  `SENSIBLE` o `TODA` (ambas). Nunca modela la excepción de emergencia
  (ver abajo): eso no es una fila de esta tabla.
- **`ClinicalAccessLog`**: bitácora de accesos append-only (trazabilidad
  exigida por la NTS 139-MINSA) — se escribe SIEMPRE que un centro de
  salud consulta a un paciente, se conceda o se deniegue el acceso.
  Deliberadamente separada de `Audit` (esa es para cambios
  administrativos de rol/permiso vía trigger; esto es lectura de datos de
  salud, un requisito legal propio).

### Traspaso de titularidad a los 18 (`TitleTransferService`)

Nunca se guarda un flag "es adulto" en `Patient`: se calcula siempre
desde `DateOfBirth` (`TitleTransferService.isAdult`), así nunca puede
quedar desactualizado por falta de un cron que lo actualice — es el
cálculo, no un flag, el que decide quién es el titular vigente
(`getCurrentTitleholderUserId`): el paciente mismo si ya es adulto, su
tutor activo (el marcado `IsPrimary`, o el primero activo que haya) si
sigue siendo menor.

`transferIfEligible` es la mitad explícita/auditable: desactiva a todos
los tutores activos de un paciente que ya cumplió 18 (`POST
/patients/:id/transfer-title`). No hay scheduler en este prototipo — se
dispara a mano o antes de una acción sensible; en producción real sería
un job diario. Si el paciente adulto todavía no tiene su propio `User`
para iniciar sesión, la respuesta lo marca (`patientNeedsOwnAccount:
true`) — no se auto-provisiona una cuenta, requiere que se registre.

### Básico vs. sensible, con y sin emergencia (`AccessDecisionService`)

El único lugar que decide si una IPRESS puede ver la información de un
paciente. Implementa la regla legal tal cual:

- `BASICA` (alergias, diagnósticos, medicación, cirugías, grupo
  sanguíneo): requiere `AccessAuthorization` vigente, SALVO que la
  consulta se declare de emergencia (`isEmergency=true`) — en ese caso se
  concede sin autorización previa, pero queda marcado
  `WasEmergencyOverride = true` en la bitácora.
- `SENSIBLE` (VIH, salud sexual, genética...): SIEMPRE requiere
  autorización vigente explícita. La excepción de emergencia nunca aplica
  acá, sin importar el flag.

`GET /health-facility-access/patients/:documentNumber/clinical-summary`
(requisito #4 del hackatón) es el endpoint simulado que junta todo: busca
al paciente por documento (una IPRESS real no conoce el Id interno),
pide la decisión, la registra en `ClinicalAccessLog` sin importar el
resultado, y solo si se concede trae los `ClinicalRecord` dentro del
alcance efectivamente otorgado.

Simplificación deliberada: el permiso `IPRESS_QUERY` alcanza para poder
declarar una consulta como emergencia — no hay un segundo chequeo de
`IPRESS_EMERGENCY_ACCESS` a nivel de código. Cada emergencia declarada
queda igual en la bitácora para poder auditarla después.

### Datos de arranque

`SeedPuente18Data` deja listos los dos estados de la transición para que
se puedan mostrar sin cargar nada a mano: un paciente ficticio menor de
edad con tutor activo (`70000001`), y uno ya adulto con titularidad
propia y su ex-tutor ya desactivado (`70000002`) — las fechas de
nacimiento se calculan desde `CURRENT_DATE`, así el seed sigue siendo
válido sin importar cuándo se corra. Todos los nombres, documentos e
IPRESS son ficticios (condición obligatoria de las bases del hackatón).
