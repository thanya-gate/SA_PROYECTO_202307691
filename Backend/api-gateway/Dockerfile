
FROM node:20-alpine AS build
WORKDIR /app

COPY api-gateway/package*.json ./
RUN npm ci

COPY api-gateway/tsconfig.json ./
COPY proto ./proto
COPY api-gateway/src ./src
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# ffmpeg/ffprobe para detectar la duración real de los videos al subirlos.
RUN apk add --no-cache ffmpeg

COPY api-gateway/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/proto ./proto

EXPOSE 8080

CMD ["node", "dist/index.js"]
