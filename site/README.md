# site/ — frontend deploy artifacts

Каждая environment-папка — **самодостаточный deploy artifact** для Ansible роли `site`. Корневых shared-папок нет.

## Структура

```
site/
├── README.md
├── staging/     ← полный staging deploy artifact (сайт + Unity WebGL игра)
│   ├── index.html
│   ├── assets/
│   ├── styles/
│   ├── scripts/
│   └── clerk/
│       ├── index.html
│       ├── assets/
│       └── game/
│           ├── Build/
│           └── TemplateData/
└── prod/        ← полный prod deploy artifact
    └── (та же структура)
```

**site/staging/** — полный артефакт: портфолио-сайт + игра в `clerk/game/`.

**site/prod/** — полный prod артефакт. Пока временно является копией staging (AWS MVP). В будущем — отдельный упрощённый prod build.

## Деплой

Ansible роль `site` берёт одну папку целиком:
- `site_environment: prod` → `site/prod/` → `/var/www/clerk-site`
- `site_environment: staging` → `site/staging/` → `/var/www/clerk-site-staging`

По умолчанию деплоится **prod**.

## Игра

Unity WebGL игра в `clerk/game/` (Build/, TemplateData/). Открывается по `http://<elastic_ip>/clerk/`.

## Проверка перед деплоем

```bash
ls site/staging/index.html site/staging/clerk/game/Build
ls site/prod/index.html
```

См. `docs/RUNBOOK_FIRST_DEPLOY.md`, `scripts/quick-check.sh`.
