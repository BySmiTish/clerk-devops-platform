# Ansible — конфигурация сервера Clerk DevOps Platform

## Зачем нужна эта папка

**Terraform** создаёт инфраструктуру в AWS (VPC, EC2, Security Group и т.д.).

**Ansible** настраивает операционную систему и сервисы *внутри* уже созданного EC2-сервера.

Зоны ответственности не пересекаются: Terraform = облако, Ansible = содержимое сервера.

## DevOps-цепочка проекта

```
Terraform → EC2 server → Ansible bootstrap → Docker → Site deploy → Nginx (static) → Monitoring
```

Текущий этап: static site hosting. Backend (FastAPI) — далее.

**bootstrap.yml** включает роли: **common**, **docker**, **site**, **nginx**. Nginx работает как static hosting (не proxy на backend).

## Структура

```
ansible/
├── ansible.cfg              # Конфиг Ansible
├── .ansible-lint             # Конфиг ansible-lint
├── inventory/
│   ├── hosts.ini            # Инвентарь (генерируется скриптом, не в git)
│   ├── hosts.ini.template   # Шаблон для render-ansible-inventory
│   └── hosts.ini.example    # Резервный шаблон для ручной настройки
├── group_vars/
│   └── all.yml              # Переменные для всех хостов
├── playbooks/
│   └── bootstrap.yml       # Bootstrap playbook (common + docker + site + nginx)
├── roles/
│   ├── common/              # Роль базовой подготовки
│   ├── docker/              # Роль установки Docker
│   ├── site/                # Роль деплоя статического сайта
│   └── nginx/               # Роль Nginx static hosting
│       ├── tasks/
│       ├── handlers/
│       ├── templates/
│       ├── defaults/
│       ├── vars/
│       └── files/
└── README.md
```

## ansible.cfg — что за настройки

| Параметр | Назначение |
|----------|------------|
| `inventory` | Путь к файлу инвентаря |
| `host_key_checking = False` | Отключено для dev convenience; в production включить проверку host key |
| `retry_files_enabled = False` | Не создавать .retry файлы после неудачных запусков |
| `stdout_callback = yaml` | Читаемый вывод в формате YAML |
| `interpreter_python = auto` | Автоопределение Python на хосте (без лишних warning) |
| `become = True` | По умолчанию выполнять задачи с sudo |

## Inventory

Файл `inventory/hosts.ini` не хранится в git (содержит IP и пути к ключам).

**Два шаблона:**

| Файл | Назначение |
|------|------------|
| `hosts.ini.template` | Шаблон для скрипта `render-ansible-inventory.sh` (placeholders `__PUBLIC_IP__`, `__SSH_KEY_PATH__`) |
| `hosts.ini.example` | Пример для ручного копирования, если не используете скрипт |

### Генерация из Terraform output (рекомендуется)

После `terraform apply` сгенерируй inventory одной командой:

```bash
# Из корня проекта (clerk-devops-platform)
./scripts/render-ansible-inventory.sh
./scripts/render-ansible-inventory.sh /path/to/your/key.pem  # свой путь к ключу
```

**PowerShell (Windows):** (запускать из корня проекта)

```powershell
.\scripts\render-ansible-inventory.ps1
.\scripts\render-ansible-inventory.ps1 -SshKeyPath "C:\path\to\key.pem"
```

Требуется Terraform в PATH. Если `terraform` не найден — установите и добавьте в PATH.

Скрипт берёт `public_ip` из `terraform output` и записывает в `ansible/inventory/hosts.ini`. Путь к .pem ключу передаётся аргументом или используется по умолчанию: `~/.ssh/clerk-devops-key.pem`.

Проверка сгенерированного inventory: `ansible-inventory -i inventory/hosts.ini --list`

### Ручная настройка

```bash
cp inventory/hosts.ini.example inventory/hosts.ini
```

Заполни вручную: `ansible_host` (Elastic IP из `terraform output -raw public_ip`) и `ansible_ssh_private_key_file`.

## Роль common

Делает базовую подготовку сервера:

1. Проверка подключения (ping)
2. Обновление apt cache
3. Установка пакетов: curl, git, unzip, ca-certificates, apt-transport-https, software-properties-common
4. Создание директорий: `/opt/clerk`, `/opt/clerk/app`, `/opt/clerk/monitoring`, `/opt/clerk/releases` (owner: ubuntu)

Роль **идемпотентна** — повторный запуск безопасен, лишних изменений не вносит.

## Роль docker

Устанавливает Docker Engine и Docker Compose plugin.

**Задачи роли:**
1. Обновление apt cache
2. Установка зависимостей (ca-certificates, curl, gnupg, lsb-release)
3. Добавление Docker apt repository (официальный репозиторий)
4. Установка пакетов: docker-ce, docker-ce-cli, containerd.io, docker-buildx-plugin, docker-compose-plugin
5. Запуск и включение сервиса docker
6. Создание группы docker и добавление пользователя ubuntu

После выполнения можно запускать контейнеры. Пользователь ubuntu сможет запускать `docker` без sudo **только после повторного входа** в систему (re-login или `newgrp docker`).

**Роль идемпотентна** — повторный запуск безопасен.

## Роль site

Копирует статический сайт из `site/prod/` или `site/staging/` на сервер.

**Переменная:** `site_environment` (по умолчанию `prod`). Поддерживаются `prod` и `staging`.

**Задачи роли:**
1. Проверка существования `site/{{ site_environment }}/` и `index.html`
2. Создание директории назначения: prod → `/var/www/clerk-site`, staging → `/var/www/clerk-site-staging`
3. Копирование содержимого (owner: www-data)
4. При изменении файлов — notify reload nginx

По умолчанию деплоится **prod**. **site/staging** содержит полный сайт + Unity WebGL игру, зарезервирован для переключения через переменные.

**Роль идемпотентна** — повторный запуск безопасен.

## Роль nginx

Устанавливает Nginx и настраивает **static hosting** (не reverse proxy). Отдаёт файлы из `/var/www/clerk-site` (prod) или `/var/www/clerk-site-staging` (staging).

**Переменная:** `nginx_site_environment` (по умолчанию `prod`). Должна соответствовать `site_environment`.

**Задачи роли:**
1. Установка Nginx
2. Запуск и включение сервиса nginx
3. Генерация конфига: `root`, `index index.html`, `try_files $uri $uri/ /index.html`
4. Включение сайта через symlink (sites-enabled)
5. Отключение default site
6. Проверка конфига (`nginx -t`) и reload (через handler)

Nginx слушает порт 80. Сайт: `http://<elastic_ip>`. Игра: `http://<elastic_ip>/clerk/`.

**Роль идемпотентна** — повторный запуск безопасен.

## Проверки перед запуском

| Проверка | Команда |
|----------|---------|
| **Site artifact** | `ls site/prod/index.html` — если нет → ошибка, см. site/README.md |
| **SSH доступ** | `ssh -i key.pem ubuntu@<IP>` — **критично перед Ansible** |
| **Inventory** | `ansible-inventory -i inventory/hosts.ini --list` — группа clerk_servers |
| **Playbook** | `ansible-playbook playbooks/bootstrap.yml --syntax-check -i inventory/hosts.ini` |

Пример правильного inventory:
```ini
[clerk_servers]
clerk_dev ansible_host=1.2.3.4 ansible_user=ubuntu ansible_ssh_private_key_file=~/.ssh/key.pem ansible_python_interpreter=/usr/bin/python3
```

## Как запускать

### 1. Подготовка inventory

```bash
# Из корня проекта — автогенерация из Terraform
./scripts/render-ansible-inventory.sh [путь/к/key.pem]
```

Или вручную: `cp inventory/hosts.ini.example inventory/hosts.ini` и подставь Elastic IP и путь к ключу.

### 2. Проверка синтаксиса

```bash
# До создания hosts.ini используй example
ansible-playbook playbooks/bootstrap.yml --syntax-check -i inventory/hosts.ini.example
```

### 3. Проверка inventory

```bash
ansible-inventory -i inventory/hosts.ini --list
# или с example: ansible-inventory -i inventory/hosts.ini.example --list
```

### 4. Запуск bootstrap

```bash
ansible-playbook playbooks/bootstrap.yml
```

Для проверки без применения изменений (dry-run):

```bash
ansible-playbook playbooks/bootstrap.yml --check
```

## Планируется дальше

- **Деплой приложения** — FastAPI
- **Мониторинг** — Prometheus, Grafana, Loki

## Проверка качества Ansible

Установка ansible-lint (опционально):

```bash
pip install ansible-lint
# или: pipx install ansible-lint
```

Запуск:

```bash
cd ansible
ansible-lint playbooks/bootstrap.yml
```

Конфигурация — `.ansible-lint` (profile: moderate). Профиль production может быть слишком строгим для учебного проекта.

## Проверки после деплоя

На сервере (`ssh ubuntu@<IP>`):

```bash
ls -la /var/www/clerk-site
nginx -t
systemctl status nginx
```

С локальной машины:

```bash
curl -I http://<IP>           # ожидается HTTP/1.1 200 OK
```

В браузере:
- Сайт: `http://<IP>`
- Игра (Unity WebGL): `http://<IP>/clerk/`

## Требования

- Ansible ≥ 2.14
- SSH-доступ к EC2 (ключ и Elastic IP из Terraform output)
