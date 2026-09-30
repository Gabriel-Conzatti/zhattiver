# syntax=docker/dockerfile:1.7
# Build multi-stage: constrói o frontend e serve pelo Caddy.
FROM node:20-alpine AS build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY frontend/ ./
RUN npm run build

FROM caddy:2.8-alpine AS runtime
COPY infra/caddy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv

EXPOSE 80 443
