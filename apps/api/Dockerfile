# syntax=docker/dockerfile:1

# Um unico Dockerfile serve os dois binarios do monorepo. Selecione com:
#   docker build --build-arg APP=api    (padrao)
#   docker build --build-arg APP=worker
# O contexto de build e apps/api/ (ver docker-compose.yml).

FROM golang:1.27-alpine AS builder
WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .

ARG APP=api
RUN go vet ./... \
 && CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags='-s -w' \
      -o /out/service ./cmd/${APP}

FROM alpine:3.20 AS runtime
RUN apk add --no-cache ca-certificates \
 && adduser -D -u 10001 appuser
USER appuser

COPY --from=builder /out/service /usr/local/bin/service

# Porta canonica da API (o worker nao expoe porta). Sobrescrevivel via env PORT.
ARG PORT=3001
ENV PORT=${PORT}
EXPOSE ${PORT}

ENTRYPOINT ["/usr/local/bin/service"]
