# ---- Etapa de compilación ----
FROM golang:1.24-alpine AS build
WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /out/server ./cmd/server

# ---- Etapa de runtime ----
FROM alpine:3.20
RUN addgroup -S yousac && adduser -S yousac -G yousac
WORKDIR /app
COPY --from=build /out/server /app/server
USER yousac

EXPOSE 50053

ENTRYPOINT ["/app/server"]
