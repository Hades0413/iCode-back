#!/bin/sh
# Postgres corre TODO lo que hay en /docker-entrypoint-initdb.d/ una sola
# vez, la primera vez que inicializa un volumen vacío — nunca en un
# restart normal. $POSTGRES_USER acá es el superusuario de bootstrap
# (DATABASE_ADMIN_USERNAME), no el usuario que usa la app.
#
# Por qué existe esto: POSTGRES_USER siempre nace superusuario en la
# imagen oficial — no hay variable de entorno que lo evite. Si la app se
# conectara con ese mismo usuario, cualquier bug o inyección SQL que
# lograra ejecutar algo tendría acceso a TODO el servidor de Postgres
# (crear/borrar otras bases, leer cualquier tabla de cualquier base,
# alterar roles). Este script crea un rol aparte, dueño únicamente de SU
# base de datos, y a partir de acá la app nunca vuelve a usar el
# superusuario.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  DO
  \$\$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '$DATABASE_USERNAME') THEN
      CREATE ROLE "$DATABASE_USERNAME" LOGIN PASSWORD '$DATABASE_PASSWORD';
    END IF;
  END
  \$\$;

  ALTER DATABASE "$POSTGRES_DB" OWNER TO "$DATABASE_USERNAME";
  ALTER SCHEMA public OWNER TO "$DATABASE_USERNAME";
EOSQL
