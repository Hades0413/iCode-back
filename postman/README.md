# Postman

Colección de todos los endpoints de la API, versionada junto con el código
para que quede sincronizada con lo que existe de verdad (no un doc aparte
que nadie actualiza).

## Postman vs. Swagger

Desde que existe `@nestjs/swagger`, la **fuente primaria** de qué endpoints
existen y qué reciben/devuelven es Swagger — se genera del código
(`@ApiTags`/`@ApiOperation`/DTOs), así que nunca puede quedar desactualizado
como sí le puede pasar a este JSON armado a mano. Corriendo `make dev`,
entrá a `http://localhost:3000/api/docs` (deshabilitado en producción a
propósito). Esta colección de Postman sigue teniendo su lugar para pruebas
manuales rápidas, requests guardados con datos de ejemplo, y para quien
prefiera Postman a la UI de Swagger — pero si hay una duda de qué campos
acepta un endpoint, Swagger manda.

## Importar

1. Postman → **Import** → arrastrá `iCode-back.postman_collection.json`.
2. Import también el/los entorno(s) que uses:
   `iCode-back.postman_environment.dev.json` (contra `make dev`, local) y/o
   `iCode-back.postman_environment.prod.json` (completá `baseUrl` real antes
   de usarlo).
3. Seleccioná el entorno arriba a la derecha en Postman y listo — todos los
   requests usan `{{baseUrl}}`, nunca una URL hardcodeada.

## Qué hay ahora

- **App / Root** — `GET /` — endpoint de ejemplo del scaffold de Nest.
- **Health / Health check** — `GET /health` — vía `@nestjs/terminus`,
  confirma que la conexión a Postgres está viva.

Todavía no hay endpoints de negocio (`src/presentation/controllers` está
vacío salvo `health.controller.ts`) — a medida que se agreguen, se suman acá.

## Convención para agregar un endpoint nuevo

Cuando un PR agrega o cambia un controller, ese mismo PR actualiza la
colección:

1. Un folder por módulo/recurso (ej. "Users", "Roles"), igual que las
   carpetas bajo `src/presentation/controllers`.
2. Cada request usa `{{baseUrl}}`, nunca `http://localhost:3000` a mano.
3. La `description` del request dice: qué hace, qué devuelve en el caso
   feliz, y los errores esperables (404, 403, etc.) — no hace falta que sea
   larga, pero alguien que nunca tocó ese endpoint debería poder probarlo
   sin leer el código.
4. Si el endpoint necesita auth, el request hereda el auth del folder/
   colección (no lo repitas request por request) — cuando se agregue login,
   este README se actualiza con cómo obtener y setear el token.
5. Exportá la colección actualizada desde Postman (**...** → Export →
   Collection v2.1) pisando este mismo archivo, para que el JSON versionado
   sea siempre el que Postman realmente exportó (evita diffs raros por
   edición manual).
