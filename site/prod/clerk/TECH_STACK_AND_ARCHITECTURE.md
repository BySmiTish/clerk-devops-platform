# Clerk Platform — Стек и архитектура

Документация по используемым технологиям и взаимосвязям компонентов платформы.

---

## Схема архитектуры

*(При необходимости добавить `docs/architecture-diagram.svg` или ссылку на внешнюю схему.)*

---

## Что реально используется

| Компонент | Технология | Назначение |
|-----------|------------|------------|
| **ОС** | Linux (Ubuntu 22.04) | Хост-система |
| **Edge / Reverse Proxy** | Nginx | Единая точка входа, TLS, статика, проксирование |
| **Backend API** | FastAPI (Python) | REST API, health, events |
| **БД (persistent)** | PostgreSQL 14 | Таблица `events`, аудит платформы |
| **Кэш / ephemeral** | Redis 7 | Кэш, rate limiting (подключён в API) |
| **Контейнеризация** | Docker, Docker Compose | API + DB + Redis; мониторинг |
| **Frontend (landing)** | HTML, CSS, JS | Одностраничник в `deploy/staging/` |
| **Продукт** | Unity WebGL (Clerk) | 2D-игра; на prod — `/clerk/game/`, на staging — относительные пути (`game/`), чтобы грузилась своя сборка |
| **Метрики** | Prometheus | Node, Nginx (stub_status), алерты |
| **Визуализация** | Grafana | Дашборды, Loki |
| **Логи** | Loki + Promtail | Централизованные логи Nginx |
| **Алерты** | Alertmanager | TargetDown, CPU, диск |
| **Сервисы** | systemd | Опционально: API на хосте |
| **CI/CD** | GitLab / GitHub | Планируется |
| **Automation** | Ansible | Планируется |

---

## Поток трафика

```
                    ┌─────────────────────────────────────────────────────────────┐
                    │                     NGINX (host, :80/:443)                  │
                    │              /api/  │  /clerk/api/  │  /  │  /staging/      │
                    └──────────────┬──────┴───────┬───────┴──┬──┴────────┬────────┘
                                   │              │         │           │
                    ┌──────────────▼──────────────▼─────────▼───────────▼────────┐
                    │                                                             │
    /api/            │  FastAPI (systemd, 127.0.0.1:9000)                         │
    /clerk/api/      │  FastAPI (Docker, 127.0.0.1:8181)  ◄─── /clerk/api/*       │
                     │       │                                 │                   │
                     │       │  DATABASE_URL                   │  /, /staging/     │
                     │       ▼                                 ▼                   │
                     │  PostgreSQL (Docker, :5432)         Статика:                │
                     │  Redis (Docker, :6379)              /var/www/resume-site    │
                     │                                    /var/www/resume-site-    │
                     │                                    staging                  │
                     └─────────────────────────────────────────────────────────────┘
```

---

## Схема взаимосвязей (Mermaid)

```mermaid
flowchart TB
    subgraph Internet
        User[Пользователь]
    end

    subgraph Host["Linux Host (Ubuntu)"]
        subgraph Nginx["Nginx (Edge)"]
            N80[":80 / :443"]
        end

        subgraph AppRuntime["Приложение"]
            API9000["FastAPI :9000\n(systemd)"]
            API8181["FastAPI :8181\n(Docker)"]
        end

        subgraph DockerCompose["Docker Compose"]
            PG[(PostgreSQL)]
            Redis[(Redis)]
        end

        subgraph Monitoring["Мониторинг (Docker)"]
            Prometheus[Prometheus]
            Grafana[Grafana]
            Loki[Loki]
            Promtail[Promtail]
            NodeExporter[node-exporter]
            NginxExporter[nginx-exporter]
            Alertmanager[Alertmanager]
        end

        Static["/var/www\n(статика)"]
    end

    User -->|HTTP/HTTPS| N80
    N80 -->|"/api/*"| API9000
    N80 -->|"/clerk/api/*"| API8181
    N80 -->|"/", "/staging/"| Static

    API9000 -.->|опционально| PG
    API8181 -->|DATABASE_URL| PG
    API8181 -->|REDIS_URL| Redis

    NodeExporter -->|metrics| Prometheus
    NginxExporter -->|stub_status :8080| Prometheus
    Prometheus --> Alertmanager
    Prometheus --> Grafana

    Promtail -->|/var/log/nginx/*| Loki
    Loki --> Grafana
```

---

## Компоненты по слоям

### 1. Edge (Nginx)

- **Файлы:** `infra/nginx/sites/resume-site`, `infra/nginx/snippets/clerk-platform.conf`
- **Роутинг:**
  - `/api/` → `http://127.0.0.1:9000` (FastAPI systemd)
  - `/clerk/api/` → `http://127.0.0.1:8181` (FastAPI Docker)
  - `/` → статика из `/var/www/resume-site`
  - `/staging/` → статика из `/var/www/resume-site-staging` (Basic Auth)
- **stub_status:** `127.0.0.1:8080/stub_status` для nginx-exporter

### 2. Backend (FastAPI)

- **Код:** `backend/app/main.py`
- **Эндпоинты:**
  - `GET /` — информация о сервисе
  - `GET /health` — проверка PostgreSQL и Redis
  - `GET /events` — последние события из БД (limit 1–200)
- **Зависимости:** PostgreSQL (asyncpg), Redis (redis-py)
- **Миграции:** `backend/migrations/001_create_events.sql` — таблица `events`

### 3. Data (PostgreSQL + Redis)

- **PostgreSQL:** образ `postgres:14-alpine`, БД `clerk`, пользователь `clerk`
- **Redis:** образ `redis:7-alpine`, appendonly для персистентности
- **Docker Compose:** `infra/docker-compose/docker-compose.yml`

### 4. Frontend

- **Landing (staging):** `apps/site/deploy/staging/index.html`, `styles/landing.css`
- **Портфолио (Clerk):** `apps/site/deploy/staging/clerk/index.html`
- **Unity WebGL:** `apps/site/deploy/staging/clerk/game/` — Build + TemplateData

### 5. Observability

| Сервис | Порт | Роль |
|--------|------|------|
| Prometheus | 9090 | Сбор метрик (node, nginx), алерты |
| Grafana | 3000 | Дашборды, Loki |
| Loki | 3100 | Хранение логов |
| Promtail | — | Читает `/var/log/nginx/*`, шлёт в Loki |
| node-exporter | 9100 | Метрики хоста (CPU, диск и т.д.) |
| nginx-exporter | 9113 | Метрики Nginx из stub_status |
| Alertmanager | 9093 | Обработка алертов |

- **Алерты:** TargetDown, HighCPUUsage, DiskUsageHigh/Critical

---

## Файловая структура (ключевые пути)

```
clerk-platform/
├── apps/site/deploy/staging/     # Landing + Clerk
│   ├── index.html                # Главная (End-to-End DevOps)
│   ├── styles/landing.css
│   └── clerk/
│       ├── index.html            # Портфолио (API health/events)
│       ├── game/                 # Unity WebGL build
│       └── assets/clerk.css, clerk.js
├── backend/
│   ├── app/main.py               # FastAPI
│   ├── migrations/001_create_events.sql
│   └── requirements.txt
├── infra/
│   ├── docker-compose/           # API + DB + Redis + monitoring
│   ├── nginx/sites/              # Конфиг Nginx
│   └── nginx/snippets/           # clerk-platform.conf
└── docs/                         # ARCHITECTURE, DECISIONS, NGINX_EDGE
```

---

## Два режима запуска API

1. **systemd (host-native):** FastAPI через uvicorn на `127.0.0.1:9000`, путь `/api/`
2. **Docker Compose:** FastAPI в контейнере, порт `8181`, путь `/clerk/api/`

Оба варианта могут сосуществовать; Nginx маршрутизирует по путям.

---

## Ссылки

- **Health API:** `/clerk/api/health` или `/api/health`
- **Events API:** `/clerk/api/events`
- **Swagger:** `/clerk/api/docs` (под Basic Auth)
- **Grafana:** `http://127.0.0.1:3000`
- **Prometheus:** `http://127.0.0.1:9090`
