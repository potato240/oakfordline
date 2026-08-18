# Build the Vite bundle.
FROM node:22-alpine AS build

WORKDIR /app

# Copy manifests first so this layer caches until dependencies actually change.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Serve the built output only. Nothing else from the repo ships.
FROM nginx:1.27-alpine AS serve

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# No Docker HEALTHCHECK here on purpose. Coolify runs its own check, and a
# container-level check that fails will stop the deploy from going live.

CMD ["nginx", "-g", "daemon off;"]
