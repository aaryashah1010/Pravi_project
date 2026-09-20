# 20 — Deployment and Docker

## Technology

Frontend: React + TypeScript + Vite

Backend: Node.js + TypeScript

Database: PostgreSQL

Cache/queue: Redis

Storage: MinIO locally; S3-compatible production object storage

Reverse proxy: Nginx

Container runtime: Docker

Orchestration for prototype/single server: Docker Compose

## Container layout

```text
infraflow/
├── frontend
├── backend
├── postgres
├── redis
├── minio
└── nginx
```

## Development compose

```yaml
services:
  frontend:
    build: ./apps/web
    ports:
      - "5173:5173"
    depends_on:
      - backend

  backend:
    build: ./apps/api
    environment:
      DATABASE_URL: postgresql://infraflow:${POSTGRES_PASSWORD}@postgres:5432/infraflow
      REDIS_URL: redis://redis:6379
      S3_ENDPOINT: http://minio:9000
    depends_on:
      - postgres
      - redis
      - minio

  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: infraflow
      POSTGRES_USER: infraflow
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    volumes:
      - miniodata:/data

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - frontend
      - backend

volumes:
  pgdata:
  miniodata:
```

The exact image versions should be pinned to tested versions before production.

## Production principles

- pin image versions;
- use secrets, not hard-coded passwords;
- use managed PostgreSQL when practical;
- use external object storage when practical;
- terminate TLS at Nginx/load balancer;
- disable database exposure to the public network;
- persistent encrypted backups;
- health checks;
- resource limits;
- structured logging;
- migrations run as a controlled release step;
- database restore tested regularly.

## Environment variables

```text
NODE_ENV
DATABASE_URL
REDIS_URL
JWT_PRIVATE_KEY
JWT_PUBLIC_KEY
S3_ENDPOINT
S3_ACCESS_KEY
S3_SECRET_KEY
S3_BUCKET
AI_PROVIDER
AI_API_KEY
EMBEDDING_MODEL
CORS_ORIGINS
```

## Deployment target

The prototype can be deployed to a Linux VPS using Docker Compose.

For higher-scale government deployment, migrate to managed database/object storage and an orchestrator according to department infrastructure policy.
