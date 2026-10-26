# syntax=docker/dockerfile:1

# ---- deps: install packages (uses the lockfile once one exists) ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# ---- dev: Vite dev server with hot reload (source is bind-mounted by docker compose) ----
FROM deps AS dev
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev"]

# ---- build: type-check and produce the static bundle ----
FROM deps AS build
COPY . .
RUN npm run build

# ---- prod: serve the static bundle with nginx ----
FROM nginx:stable-alpine AS prod
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
