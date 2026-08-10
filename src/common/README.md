# common/

Piezas reutilizables para no reinventarlas cada vez que se agrega un
controller o servicio nuevo. Nada de acá se aplica solo por importarlo:
donde hace falta, cada sección dice cómo conectarlo.

## base/

- **`base.controller.ts`** — `BaseController`, una clase abstracta con
  `this.logger` ya armado (`new Logger(NombreController.name)`). Extendela
  en vez de instanciar tu propio logger en cada controller.
- **`example.controller.ts`** — PLANTILLA, no registrada en ningún módulo
  (no expone ninguna ruta real). Copiala como punto de partida: muestra
  `BaseController` + paginación + Swagger juntos. Instrucciones en el
  encabezado del archivo.

## dto/

- **`pagination-query.dto.ts`** — `PaginationQueryDto` (`page`, `limit`,
  `order`) para cualquier endpoint de listado. Usalo con `@Query()`.
- **`paginated-response.dto.ts`** — shape para documentar en Swagger la
  forma de una respuesta paginada (`data` + `meta`).

## utils/

- **`paginate.util.ts`** — `paginate(data, total, query)` arma
  `{ data, meta }` a partir de un `PaginationQueryDto`. Única fórmula de
  `totalPages` en todo el proyecto.
- **`sanitize.util.ts`** — `sanitizeValue(value)` recorta espacios y saca
  tags HTML de strings, recursivamente en arrays/objetos. La usa
  `SanitizeMiddleware`, pero también sirve suelta si necesitás sanitizar
  algo fuera del ciclo de request (ej. un job).
- **`encryption.util.ts`** — `encryptPayload`/`decryptPayload` (AES-256-GCM)
  y `isValidEncryptionKey`. Los usa `EncryptResponseInterceptor`.

## middlewares/

- **`sanitize.middleware.ts`** — `SanitizeMiddleware`, aplicado
  globalmente en `AppModule.configure()`, sanitiza `req.body`. No
  reemplaza la validación por DTO (`class-validator`): es una red
  adicional para lo que todavía no tiene una DTO estricta, o para texto
  que puede terminar mostrándose en un frontend.

  **No sanitiza query params** — en Express 5, `req.query` es un getter
  que reparsea la URL en cada acceso (sin cachear, sin setter real):
  reasignarlo no tira error pero tampoco tiene ningún efecto, confirmado
  contra un server real antes de asumirlo. Para sanitizar un query param,
  usá `@SanitizedQuery()` (ver `decorators/`) en vez de `@Query()`.

## interceptors/ y decorators/

- **`sanitized-query.decorator.ts`** — `@SanitizedQuery()`, el reemplazo
  de `@Query()` que sí sanitiza (ver la nota de arriba sobre por qué el
  middleware no puede). `@SanitizedQuery('nombre')` para un solo campo,
  `@SanitizedQuery()` para todo el objeto.

- **`encrypt-response.interceptor.ts`** + **`encrypt-response.decorator.ts`**
  — `EncryptResponseInterceptor` está registrado globalmente pero es
  inerte: solo cifra la respuesta de un handler que tenga `@EncryptResponse()`.

  ```ts
  import { EncryptResponse } from 'src/common/decorators/encrypt-response.decorator';

  @Get('datos-sensibles')
  @EncryptResponse()
  getDatosSensibles() {
    return { ... };
  }
  ```

  **Por qué es opt-in y no global:** HTTPS (nginx, ver
  `docker/nginx/nginx.conf`) ya cifra todo el tráfico en tránsito — eso
  alcanza para el 99% de los endpoints. Cifrar el body ADEMÁS de TLS solo
  tiene sentido para datos puntuales muy sensibles (un requisito
  regulatorio, un proxy intermedio en el que no confiás del todo), y
  aplicado a todo rompería "Try it out" de Swagger y cualquier cliente
  HTTP estándar sin descifrar a mano. Requiere `RESPONSE_ENCRYPTION_KEY`
  en el `.env` correspondiente (`openssl rand -hex 32` para generarla) — si
  falta o no tiene el formato correcto, el endpoint responde 500 en vez de
  filtrar el dato sin cifrar.

## constants/

- **`security.constants.ts`** — `HELMET_OPTIONS` (usado en `main.ts`, en
  vez de un `helmet()` a secas sin que quede claro qué se está pidiendo),
  `PASSWORD_POLICY` (para cuando exista el primer DTO de contraseña) y
  `PAGINATION_DEFAULTS`.
