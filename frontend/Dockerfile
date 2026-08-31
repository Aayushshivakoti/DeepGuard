# Multi-stage Dockerfile for DeepGuard Frontend React/Vite App
# Stage 1: Build
FROM node:20-alpine AS build-stage

WORKDIR /app

COPY package*.json ./
RUN npm ci

# Copy only frontend source files and config files to avoid heavy backend/uploads context
COPY src ./src
COPY public ./public
COPY index.html ./
COPY vite.config.js ./

RUN npm run build

# Stage 2: Serve
FROM nginx:alpine AS production-stage

COPY --from=build-stage /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
