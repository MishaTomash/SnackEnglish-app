FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_APP_ENV=production
ARG VITE_BOT_USERNAME=snackEnglish_bot
ARG VITE_API_URL=/api
ARG VITE_APP_URL=https://snack-english.smartekua.store
ARG VITE_USE_MOCKS=false

ENV VITE_APP_ENV=$VITE_APP_ENV
ENV VITE_BOT_USERNAME=$VITE_BOT_USERNAME
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_APP_URL=$VITE_APP_URL
ENV VITE_USE_MOCKS=$VITE_USE_MOCKS

RUN npm run build

FROM nginx:alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]