.DEFAULT_GOAL := help
.PHONY: help install env-setup dev start build prod debug lint format \
        test test-watch test-cov test-e2e \
        migration-create migration-generate migration-run migration-revert \
        migration-run-prod migration-revert-prod clean \
        docker-up docker-restart docker-down docker-build docker-logs docker-ps docker-reset \
        docker-up-prod docker-down-prod docker-build-prod docker-logs-prod \
        docker-ps-prod ssl-generate docker-nuke \
        db-backup db-restore db-reset

## help: lista todos los comandos disponibles
help:
	@echo "Uso: make <comando>"
	@echo ""
	@grep -E '^## [a-zA-Z0-9_-]+:' Makefile | sed 's/## /  /'

## install: instala las dependencias del proyecto
install:
	pnpm install

## env-setup: crea .env.dev y .env.prod a partir de .env.example si no existen
env-setup:
	@test -f .env.dev || (cp .env.example .env.dev && echo "Creado .env.dev — revisá sus valores")
	@test -f .env.prod || (cp .env.example .env.prod && echo "Creado .env.prod — completá los CHANGE_ME antes de desplegar")

## dev: levanta el proyecto en modo desarrollo (watch, .env.dev)
dev:
	pnpm run start:dev

## start: levanta el proyecto sin watch (.env.dev)
start:
	pnpm run start

## debug: levanta el proyecto en modo debug + watch (.env.dev)
debug:
	pnpm run start:debug

## build: compila el proyecto a dist/
build:
	pnpm run build

## prod: compila y levanta el build de producción (.env.prod)
prod: build
	pnpm run start:prod

## lint: corre ESLint y corrige lo que pueda
lint:
	pnpm run lint

## format: formatea src/ y test/ con Prettier
format:
	pnpm run format

## test: corre los tests unitarios
test:
	pnpm run test

## test-watch: corre los tests unitarios en modo watch
test-watch:
	pnpm run test:watch

## test-cov: corre los tests unitarios con reporte de cobertura
test-cov:
	pnpm run test:cov

## test-e2e: corre los tests end-to-end
test-e2e:
	pnpm run test:e2e

## migration-create: crea una migración vacía. Uso: make migration-create NAME=CreateUsersTable
migration-create:
	@test -n "$(NAME)" || (echo "Falta NAME, ej: make migration-create NAME=CreateUsersTable" && exit 1)
	pnpm run migration:create src/infrastructure/database/migrations/$(NAME)

## migration-generate: genera una migración a partir de las entidades. Uso: make migration-generate NAME=CreateUsersTable
migration-generate:
	@test -n "$(NAME)" || (echo "Falta NAME, ej: make migration-generate NAME=CreateUsersTable" && exit 1)
	pnpm run migration:generate src/infrastructure/database/migrations/$(NAME)

## migration-run: aplica las migraciones pendientes contra .env.dev
migration-run:
	pnpm run migration:run

## migration-revert: revierte la última migración aplicada en .env.dev
migration-revert:
	pnpm run migration:revert

## migration-run-prod: aplica las migraciones pendientes contra .env.prod
migration-run-prod:
	NODE_ENV=production pnpm run migration:run

## migration-revert-prod: revierte la última migración aplicada en .env.prod
migration-revert-prod:
	NODE_ENV=production pnpm run migration:revert

## clean: borra dist/ y coverage/
clean:
	rm -rf dist coverage

# docker-compose.yml es la plantilla base. docker-compose.override.yml
# (dev) se suma solo sin -f — es el comportamiento estándar de Compose
# para ese nombre de archivo. Producción encadena el prod.yml a mano. Cada
# stack usa su propio nombre de proyecto (-p) para no compartir por
# accidente contenedores/volúmenes entre dev y prod en la misma máquina.
DEV_COMPOSE := docker compose -p icode-back-dev --env-file .env.dev
PROD_COMPOSE := docker compose -p icode-back-prod --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml

## docker-up: DEV — levanta Postgres + la app con hot-reload (NO reconstruye la imagen si ya existe)
docker-up:
	$(DEV_COMPOSE) up -d

## docker-restart: DEV — recrea el contenedor de la app para que relea .env.dev (sin rebuild de imagen). Los cambios de código NO necesitan esto: ya recargan solos.
docker-restart:
	$(DEV_COMPOSE) up -d --force-recreate --no-build app

## docker-down: DEV — baja los contenedores (conserva el volumen de datos)
docker-down:
	$(DEV_COMPOSE) down

## docker-reset: DEV — baja los contenedores y borra también el volumen de datos de Postgres
docker-reset:
	$(DEV_COMPOSE) down -v

## docker-build: DEV — reconstruye la imagen de la app a mano (solo hace falta si cambiaste package.json/pnpm-lock.yaml o el Dockerfile)
docker-build:
	$(DEV_COMPOSE) build

## docker-logs: DEV — sigue los logs de todos los servicios
docker-logs:
	$(DEV_COMPOSE) logs -f

## docker-ps: DEV — estado de los contenedores del proyecto
docker-ps:
	$(DEV_COMPOSE) ps

## ssl-generate: crea un certificado self-signed en docker/ssl/ si no existe (ver docker/ssl/README.md)
ssl-generate:
	@test -f docker/ssl/fullchain.pem || openssl req -x509 -nodes -newkey rsa:2048 \
		-keyout docker/ssl/privkey.pem -out docker/ssl/fullchain.pem \
		-days 365 -subj "/C=PE/ST=Lima/L=Lima/O=iCode/OU=Dev/CN=localhost" \
		-addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

## docker-up-prod: PROD — levanta nginx (SSL) + app + Postgres
docker-up-prod: ssl-generate
	$(PROD_COMPOSE) up --build -d

## docker-down-prod: PROD — baja los contenedores (conserva el volumen de datos)
docker-down-prod:
	$(PROD_COMPOSE) down

## docker-build-prod: PROD — reconstruye las imágenes sin levantar nada
docker-build-prod:
	$(PROD_COMPOSE) build

## docker-logs-prod: PROD — sigue los logs de todos los servicios (nginx, app, postgres)
docker-logs-prod:
	$(PROD_COMPOSE) logs -f

## docker-ps-prod: PROD — estado de los contenedores
docker-ps-prod:
	$(PROD_COMPOSE) ps

## docker-nuke: borra contenedores, imágenes Y VOLÚMENES (datos) de icode-back-dev e icode-back-prod. No toca nada de otros proyectos.
docker-nuke:
	@echo "Esto borra TODO lo de icode-back-dev e icode-back-prod: contenedores, imágenes y volúmenes (pierde los datos de Postgres). No afecta a otros proyectos Docker de esta máquina."
	@echo "Ctrl+C en los próximos 5s para cancelar."
	@sleep 5
	$(DEV_COMPOSE) down -v --rmi all --remove-orphans
	$(PROD_COMPOSE) down -v --rmi all --remove-orphans

# db-backup/db-restore/db-reset son DEV-only a propósito: son destructivos,
# y volar la base de producción con un comando de una línea es justamente
# el tipo de error que no queremos facilitar. Leen POSTGRES_USER/DB de
# adentro del contenedor (los define docker-compose.yml a partir de tu
# .env.dev) en vez de volver a parsear el .env acá.

## db-backup: DEV — vuelca la base a backups/icode-<fecha>.sql (pg_dump)
db-backup:
	@mkdir -p backups
	$(DEV_COMPOSE) exec -T postgres sh -c 'pg_dump -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"' > backups/icode-$$(date +%Y%m%d-%H%M%S).sql
	@echo "Backup guardado en backups/"

## db-restore: DEV — restaura desde un .sql, BORRANDO los datos actuales. Uso: make db-restore FILE=backups/icode-20260810-120000.sql (sin FILE, usa el backup más reciente en backups/)
db-restore:
	$(eval FILE ?= $(shell ls -t backups/*.sql 2>/dev/null | head -n 1))
	@test -n "$(FILE)" || (echo "No hay ningún .sql en backups/ y no pasaste FILE=. Ej: make db-restore FILE=backups/icode-20260810-120000.sql" && exit 1)
	@test -f "$(FILE)" || (echo "No existe $(FILE)" && exit 1)
	@echo "Esto borra TODOS los datos actuales de la base de dev y los reemplaza por $(FILE)."
	@echo "Ctrl+C en los próximos 5s para cancelar."
	@sleep 5
	$(DEV_COMPOSE) exec -T postgres sh -c 'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"'
	$(DEV_COMPOSE) exec -T postgres sh -c 'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"' < "$(FILE)"

## db-reset: DEV — borra el esquema y vuelve a crear todo desde las migraciones (no desde un backup)
db-reset:
	@echo "Esto borra TODOS los datos actuales de la base de dev y la deja como recién migrada."
	@echo "Ctrl+C en los próximos 5s para cancelar."
	@sleep 5
	$(DEV_COMPOSE) exec -T postgres sh -c 'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"'
	pnpm run migration:run
