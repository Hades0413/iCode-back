# syntax=docker/dockerfile:1
#
# Un solo Dockerfile para dev y prod — lo que cambia es el "target":
# docker-compose.override.yml (dev, automático) usa "dev",
# docker-compose.prod.yml usa "runtime". Ningún archivo duplicado que
# pueda quedar desincronizado.

# ---- deps: instala TODAS las dependencias (dev incluidas, hacen falta para build) ----
FROM node:24-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ---- dev: código fuente montado como bind mount (ver override), hot-reload real ----
FROM deps AS dev
COPY . .
EXPOSE 3000
CMD ["pnpm", "run", "start:dev"]

# ---- build: compila TypeScript -> dist/ ----
FROM deps AS build
COPY . .
RUN pnpm run build

# ---- prod-deps: solo dependencias de runtime, sin devDependencies ----
FROM node:24-alpine AS prod-deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod

# ---- runtime: imagen final de producción, sin toolchain de build ----
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
USER app
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/health',(r)=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "dist/main.js"]
