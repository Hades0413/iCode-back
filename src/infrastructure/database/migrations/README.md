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
nunca se re-ejecutan por error. Nunca edites una migración ya aplicada en otro
ambiente: crea una nueva que corrija lo necesario.

## Esquema inicial

`1786325855482-CreateInitialSchema.ts` crea el esquema base y
`1786325856482-SeedInitialData.ts` los datos de arranque (admin, roles,
permisos, menú de navegación).
`1786339134332-AddSessionActivityTracking.ts` agrega
`UserSession.LastActivityAt` (para `GET /admin/sessions/online`, ver
README raíz) y el permiso `ADMIN_VIEW_SESSIONS`.

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
  (`USR_WRITE`, `BILL_MGMT`...). No dice quién puede hacerlas, solo que
  existen. `MenuId` es metadata (a qué pantalla pertenece, para agruparlas
  en una UI de administración) — **no participa en la autorización**.
- **`Role`**: una etiqueta con la que se agrupan permisos para asignarlos
  en bloque (`Administrador`, `Ventas`...). `Code` es la clave estable para
  chequear roles en código (`role.Code === 'ADMIN'`); `Name` es editable
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
