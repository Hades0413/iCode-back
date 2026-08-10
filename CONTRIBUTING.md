# Cómo trabajamos con Git

## Ramas

```
production/main ──────●───────────────●──────────────●───────►  siempre desplegable
                        \             / \            /
                         release/1.2.0   hotfix/fix-login
                        /             \ /            \
develop ───●───●───●───●───●───●───●───●──●───●───●───●──────►  integración
            \     /         \     /
             feature/login   feature/reportes
```

- **`main`** — es la rama de producción (lo que en otros equipos se llama
  `production`; acá no separamos las dos para no tener dos ramas que
  signifiquen lo mismo). Siempre desplegable. Nadie commitea directo acá:
  solo llegan merges desde `release/*` o `hotfix/*`, y cada merge se taggea
  con la versión (`v1.2.0`).
- **`develop`** — rama de integración. Es la base por defecto para
  ramificar y el destino de casi todos los PRs. Refleja "lo próximo a
  liberar", no necesariamente lo que está en producción ahora mismo.
- **`feature/<nombre-corto>`** — una funcionalidad o fix no urgente. Sale de
  `develop`, vuelve a `develop` por PR. Ejemplos: `feature/login-jwt`,
  `feature/reportes-ventas`.
- **`release/<version>`** — se abre desde `develop` cuando se junta lo
  suficiente para liberar. Acá solo entran fixes de última hora (no
  features nuevas). Al cerrar: merge a `main` (tag `vX.Y.Z`) **y** a
  `develop`, para que `develop` no pierda esos fixes.
- **`hotfix/<nombre-corto>`** — un bug urgente ya en producción, no puede
  esperar al próximo release. Sale de `main`, y al cerrar hace merge a
  `main` (tag de patch, ej. `v1.2.1`) **y** a `develop`.

Si el equipo es chico y el ritmo de releases es alto, `release/*` es
opcional — se puede ir directo de `develop` a `main` cuando se decide
liberar. `hotfix/*` sí conviene mantenerlo siempre: es la única rama que
sale de `main` en vez de `develop`.

## Pull Requests

- Un PR por feature/fix, chico y enfocado — más fácil de revisar, más fácil
  de revertir si algo sale mal.
- El título describe el cambio en imperativo ("Agrega login con JWT", no
  "Login" ni "cambios varios").
- CI (`.github/workflows/ci.yml`) tiene que estar en verde antes de mergear:
  lint, build, tests unitarios y e2e contra un Postgres real.
- Antes de abrir el PR, corré localmente lo mismo que corre CI:
  ```bash
  make lint
  make build
  make test
  make test-e2e
  ```
- Mergear con **squash** hacia `develop`/`main` mantiene el historial de esas
  ramas legible (un commit por PR); dentro de tu `feature/*` commiteá como
  te resulte más cómodo mientras trabajás.

## Mensajes de commit

Usamos [Conventional Commits](https://www.conventionalcommits.org/) —
`tipo(alcance opcional): descripción`. No hay tooling que lo fuerce todavía,
pero es lo que se espera:

- `feat: agrega endpoint de login`
- `fix: corrige validación de email en registro`
- `docs: actualiza README con setup de Docker`
- `chore: sube versión de typeorm`
- `refactor: extrae PermissionGuard a su propio archivo`
- `test: cubre HealthController con Postgres caído`

## Migraciones

Una migración ya mergeada a `develop` o `main` **no se edita** — ver
[src/infrastructure/database/migrations/README.md](src/infrastructure/database/migrations/README.md).
Si algo quedó mal, se corrige con una migración nueva.

## Variables de entorno

`.env.dev`/`.env.prod` nunca se commitean (ver `.gitignore`). Si agregás una
variable nueva, actualizá `.env.example` en el mismo PR — es la única
plantilla versionada y de ahí sale `make env-setup`.
