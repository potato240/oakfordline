# ---- build ----
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- serve ----
FROM nginx:1.27-alpine AS serve

# Coolify's default health check shells into the container and runs curl,
# which the nginx alpine image does not ship. Without this the container is
# permanently "unhealthy" and the deploy never goes live.
RUN apk add --no-cache curl

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
