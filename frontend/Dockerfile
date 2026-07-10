# syntax=docker/dockerfile:1.7

# The Vite bundle is architecture-independent. Build it on the native runner so
# multi-platform releases do not run npm under slow QEMU emulation.
FROM --platform=$BUILDPLATFORM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
