# 1. Етап збірки Vite + React
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
# Змінні для підключення до API через відносний шлях у Nginx
ENV VITE_API_URL=/api
RUN npm run build

# 2. Етап роздачі через Nginx
FROM nginx:alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]