# Clerk DevOps Platform

Pet-проект для практики DevOps: инфраструктура в AWS и деплой статического сайта/игры.

## 📋 Первый деплой

**Полный пошаговый сценарий:** [docs/RUNBOOK_FIRST_DEPLOY.md](docs/RUNBOOK_FIRST_DEPLOY.md)

**Быстрая проверка перед деплоем:**
```bash
./scripts/quick-check.sh
```

**Проблемы?** → [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)

## Workflow

1. **Terraform** — создаёт EC2, VPC, Elastic IP
2. **Ansible bootstrap** — подготовка сервера, Docker, деплой сайта, Nginx

После выполнения сайт открывается по Elastic IP в браузере.

## Структура

```
clerk-devops-platform/
├── site/
│   ├── prod/      # Production static artifact (по умолчанию отдаётся nginx)
│   └── staging/   # Staging artifact (сайт + игра), зарезервировано для будущего
├── terraform/     # AWS инфраструктура
├── ansible/       # Конфигурация сервера (common, docker, site, nginx)
├── scripts/       # render-ansible-inventory, quick-check
├── docs/          # RUNBOOK_FIRST_DEPLOY.md, TROUBLESHOOTING.md
├── app/
└── monitoring/
```

**site/staging** — основной полный сайт + Unity WebGL игра (импортирован из legacy Clerk).

**site/prod** — упрощённый production-артефакт, зарезервирован для будущего prod workflow.

Bootstrap включает роли: **common**, **docker**, **site**, **nginx**. Nginx работает как **static hosting** (не reverse proxy).

## Быстрый старт

```bash
# 1. Terraform
cd terraform && terraform init && terraform apply

# 2. Если site/ пустой — артефакты уже должны быть импортированы (см. site/README.md)

# 3. Ansible
./scripts/render-ansible-inventory.sh
cd ansible && ansible-playbook playbooks/bootstrap.yml
```

Сайт доступен по `http://<elastic_ip>`. Игра — `http://<elastic_ip>/clerk/`.

---

## ✅ Чеклист проверок

| Этап | Команда | Ожидание |
|------|---------|----------|
| Site | `ls site/prod/index.html` | Файл существует |
| Terraform | `cd terraform && terraform validate` | Success |
| Terraform | `terraform plan` | План без ошибок |
| SSH | `ssh -i key.pem ubuntu@<IP>` | Подключение успешно |
| Inventory | `ansible-inventory -i inventory/hosts.ini --list` | Группа clerk_servers |
| Ansible | `ansible-playbook ... --syntax-check` | playbook OK |
| Nginx | `nginx -t` (на сервере) | syntax is ok |
| HTTP | `curl -I http://<IP>` | HTTP/1.1 200 OK |
| Игра | `http://<IP>/clerk/` в браузере | Загружается |
