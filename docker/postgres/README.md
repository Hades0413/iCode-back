# postgres/

## Por qué dos usuarios (admin vs app)

La imagen oficial de `postgres` siempre crea a `POSTGRES_USER` como
**superusuario** — no hay ninguna variable de entorno que lo evite. Si la
app se conectara con ese mismo usuario, cualquier bug (o una inyección SQL
que lograra ejecutar algo) tendría acceso a **todo** el servidor: crear o
borrar cualquier base, leer tablas de otras bases, alterar roles, etc. —
no solo a los datos de esta app.

`init-app-user.sh` corre automáticamente la primera vez que Postgres
inicializa un volumen vacío (mecanismo estándar de
`/docker-entrypoint-initdb.d/`, no es nada nuestro) y crea un segundo rol:

- **`DATABASE_ADMIN_USERNAME`/`DATABASE_ADMIN_PASSWORD`** → el superusuario
  de bootstrap. Solo lo usa el contenedor para arrancar y para los
  `make db-backup`/`db-restore`/`db-reset`. La app **nunca** se conecta
  con esto.
- **`DATABASE_USERNAME`/`DATABASE_PASSWORD`** → un rol normal, sin
  `SUPERUSER`/`CREATEDB`/`CREATEROLE`, dueño únicamente de su propia base
  de datos (`ALTER DATABASE ... OWNER TO`). La app y las migraciones se
  conectan con esto.

Verificado a mano que ese rol puede hacer todo lo que las migraciones
necesitan (`CREATE EXTENSION pgcrypto` —es una extensión "trusted", no
requiere superusuario—, `CREATE TABLE`/`FUNCTION`/`TRIGGER`/`VIEW`), pero
si intenta `CREATE DATABASE` para tocar otra base, Postgres lo rechaza con
`permission denied`. Esa es la frontera de seguridad real, no cosmética.

## Si ya tenías un volumen de Postgres de antes de esto

`/docker-entrypoint-initdb.d/` solo corre en un volumen **vacío**. Si tu
Postgres ya estaba inicializado (con el usuario viejo), agregar esto no
hace nada hasta que reinicialices:

```bash
make docker-reset   # baja los contenedores y borra el volumen de datos
make docker-up      # levanta de cero — ahora sí corre init-app-user.sh
make migration-run
```

## Postgres gestionado (RDS, Render, Supabase...)

`docker-compose.prod.yml` con Postgres containerizado es para quien
despliega su propia base. Si usás un proveedor gestionado, no hay
`docker-entrypoint-initdb.d/` — creá el rol de la app vos mismo,
conectado como el admin que te dio el proveedor:

```sql
CREATE ROLE icode_app LOGIN PASSWORD 'una-contraseña-real';
ALTER DATABASE tu_base OWNER TO icode_app;
ALTER SCHEMA public OWNER TO icode_app;
```

Y poné esas credenciales en `DATABASE_USERNAME`/`DATABASE_PASSWORD` de
`.env.prod` — `DATABASE_ADMIN_*` no aplica en ese caso.
