<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ make install
# o: pnpm install
```

## Environment

Las variables de entorno viven en `.env.dev` (desarrollo) y `.env.prod`
(producción) — ninguno de los dos se sube a git. `.env.example` es la única
plantilla versionada.

```bash
$ make env-setup   # crea .env.dev y .env.prod a partir de .env.example
```

Completá los valores reales (host/usuario/password de Postgres, etc.) en
cada archivo. La app elige cuál cargar según `NODE_ENV`: `production` lee
`.env.prod`, cualquier otro valor lee `.env.dev`.

## Compile and run the project

Todos los comandos del proyecto están en el `Makefile` — `make help` los
lista todos.

```bash
# development (watch)
$ make dev

# production (build + start)
$ make prod

# migraciones (ver src/infrastructure/database/migrations/README.md)
$ make migration-run
$ make migration-create NAME=CreateUsersTable
```

Equivalentes directos con pnpm, por si preferís no usar `make`:

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Run tests

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

## Docker

`docker-compose.yml` es la plantilla base (Postgres + la forma común de
"app") — nunca se usa sola. `docker-compose.override.yml` (dev) se suma
automáticamente sin pasar `-f`; `docker-compose.prod.yml` se encadena
explícitamente. Un solo `docker/Dockerfile` con varios stages, elegido por
`target` desde cada overlay — nada duplicado entre ambientes:

```bash
# desarrollo: Postgres + app con hot-reload (bind mount, sin nginx/SSL)
$ make docker-up
$ make docker-logs
$ make docker-down

# producción: nginx (SSL + headers + rate limit de borde) -> app -> Postgres
$ make docker-up-prod
$ make docker-logs-prod
$ make docker-down-prod
```

`docker-up-prod` genera un certificado self-signed en `docker/ssl/` si
todavía no existe (`make ssl-generate`), así el stack levanta sin pasos
manuales — reemplazalo por uno real antes de exponer esto a internet (ver
[docker/ssl/README.md](docker/ssl/README.md)). La configuración de nginx
está en [docker/nginx/nginx.conf](docker/nginx/nginx.conf).

## Autenticación

`POST /auth/login` → `GET /auth/me` → `POST /auth/logout`
([Postman](postman/README.md) o `/api/docs` con el botón "Authorize").

No es JWT — es un token opaco guardado (hasheado con sha256) en
`UserSession`. La razón: con un JWT stateless no hay forma de invalidar
una sesión sin infraestructura extra (blocklist) — acá, logout marca
`RevokedAt` y el token deja de servir en la siguiente request, no cuando
expira solo. Contraseñas con PBKDF2-HMAC-SHA256 (`bytea` hash+salt
separados, no un string autocontenido como bcrypt/argon2 — ver
`src/common/utils/password-hashing.util.ts`).

La sesión expira de forma **deslizante**: cada request autenticado empuja
`ExpiresAt` otros `SESSION_IDLE_TTL_DAYS` días (30 por defecto), pensado
para el cliente móvil (React Native) con soporte offline — un usuario sin
internet por días no pierde la sesión, solo si el dispositivo queda sin
usarse ese tiempo entero. Desactivar un usuario (`User.State = false`)
invalida todas sus sesiones activas al instante, sin esperar a un logout.

Todo endpoint requiere sesión por defecto (`SessionAuthGuard`, global) —
usá `@Public()` para los que no. `@RequirePermission('CODE')` protege por
permiso puntual contra la vista `UserPermission` (ver
[migrations/README.md](src/infrastructure/database/migrations/README.md)).

Usuarios de prueba del seed: `admin`, `supervisor`, `auditor1`, etc., todos
con password `Passw0rd1!` — ver la advertencia en
`SeedInitialData...ts` antes de usar este seed fuera de dev.

### Usuarios en línea (admin)

`GET /admin/sessions/online` — requiere el permiso `ADMIN_VIEW_SESSIONS`
(solo `Administrador` por defecto). "En línea" es actividad dentro de
`ONLINE_THRESHOLD_MINUTES` (15 por defecto) — no es lo mismo que "sesión
activa": con la expiración deslizante de 30 días, una sesión válida no
significa que alguien esté usando la app ahora mismo, por eso existe
`UserSession.LastActivityAt` aparte de `ExpiresAt`.

Devuelve `onlineUserCount` (usuarios distintos) y `onlineSessionCount`
(sesiones — un usuario con el celular y la web abiertos cuenta una vez en
lo primero, dos en lo segundo), más la ubicación aproximada por IP
(`geoip-lite`, offline, sin llamadas externas). Aproximada de verdad: geolocaliza
el gateway del proveedor de internet, no al usuario — en datos móviles
puede marcar una ciudad distinta a la real. Es `null` en IPs
privadas/locales (`127.0.0.1`, `10.x`, etc.), el caso normal en dev.

## Puente 18+ (dominio clínico)

Backend del desafío "Puente 18+" — Hackatón Niño San Borja 2026 (ver
[prompt_contexto_backend_puente18.md](prompt_contexto_backend_puente18.md)).
Portal de continuidad de información clínica para pacientes en transición
pediátrico→adulto: acceso de solo lectura al historial resumido, con
traspaso de titularidad al cumplir 18 y consentimiento explícito
diferenciando información básica de sensible. Detalle completo del
modelo en
[migrations/README.md](src/infrastructure/database/migrations/README.md#puente-18-dominio-clínico).

**Todos los datos (pacientes, tutores, IPRESS, historial) son
ficticios/sintéticos — condición obligatoria de las bases del hackatón,
nunca se carga información real.**

Endpoints principales (todos requieren sesión + el permiso indicado):

- `POST /patients`, `GET /patients/:id`, `POST /patients/:id/guardians`,
  `POST /patients/:id/transfer-title` — datos del paciente/tutor y el
  traspaso de titularidad a los 18.
- `POST|GET /patients/:id/clinical-records`,
  `GET /patients/:id/clinical-records/transition-file` — historial
  clínico y la "ficha de transición" portable (requisito #6).
- `POST /patients/:id/access-authorizations`,
  `PATCH /patients/:id/access-authorizations/:authId/revoke`,
  `GET /patients/:id/access-authorizations`,
  `GET /patients/:id/access-log` — consentimiento y bitácora de accesos.
- `GET /health-facility-access/patients/:documentNumber/clinical-summary?scope=BASICA|SENSIBLE|TODA&isEmergency=` —
  el endpoint simulado de una IPRESS consultando a un paciente (requisito
  #4); respeta la autorización vigente y la excepción de emergencia solo
  para `BASICA`.

Usuarios demo del seed (misma contraseña `Passw0rd1!` que el resto):
`tutor1` (tutor activo de un paciente menor), `paciente1` (paciente ya
adulto, titular de sí mismo), `pediatra1`/`internista1` (personal de
salud, cada uno vinculado a una IPRESS ficticia distinta).

## Seguridad

- **Cabeceras**: Helmet (`src/common/constants/security.constants.ts`) +
  las mismas cabeceras reforzadas a nivel de nginx en producción.
- **Rate limit**: `@nestjs/throttler` en la app, más un `limit_req` de
  borde en nginx — dos capas, no una sola.
- **Sanitización de input**: `SanitizeMiddleware` (ver
  [src/common/README.md](src/common/README.md)), aplicado globalmente.
- **Cifrado de datos en tránsito**: HTTPS/TLS en nginx (producción).
- **Cifrado de payload a nivel de aplicación**: opt-in vía
  `@EncryptResponse()`, ver `src/common/README.md` — no es el default
  porque HTTPS ya alcanza en el 99% de los casos.
- **CreatedBy/UpdatedBy/DeletedBy como FK a `User.Id`**, roles y permisos,
  auditoría automática de cambios de autorización: ver
  [src/infrastructure/database/migrations/README.md](src/infrastructure/database/migrations/README.md).
- **La app nunca se conecta a Postgres como superusuario**: un rol aparte,
  sin `SUPERUSER`/`CREATEDB`, dueño solo de su propia base — ver
  [docker/postgres/README.md](docker/postgres/README.md).

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ pnpm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
