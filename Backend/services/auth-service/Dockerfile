#build stage
FROM node:20-alpine AS build
WORKDIR /app

COPY services/auth-service/package*.json ./
RUN npm ci

COPY services/auth-service/tsconfig.json ./
COPY proto ./proto
COPY services/auth-service/src ./src
RUN npm run build

#runtime stage
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY services/auth-service/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/proto ./proto

EXPOSE 3000 50051

CMD ["node", "dist/index.js"]
