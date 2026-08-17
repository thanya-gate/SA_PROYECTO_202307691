#build stage
FROM node:20-alpine AS build
WORKDIR /app

COPY services/notificaciones-service/package*.json ./
RUN npm ci

COPY services/notificaciones-service/tsconfig.json ./
COPY proto ./proto
COPY services/notificaciones-service/src ./src
RUN npm run build

#runtime stage
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY services/notificaciones-service/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/proto ./proto

# Solo gRPC (east-west). El notificaciones-service no expone HTTP: el API Gateway
# es el punto de entrada único hacia el cliente web.
EXPOSE 50056

CMD ["node", "dist/index.js"]
