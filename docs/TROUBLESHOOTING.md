# ⚠️ TROUBLESHOOTING

Типичные проблемы при первом деплое и их решение.

---

## ❌ Terraform apply не работает

### AWS credentials

**Симптом:** `Error: NoCredentialProviders` или `Unable to locate credentials`

**Решение:**
```bash
aws configure
# или экспорт переменных: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
```

### Region / quotas

**Симптом:** `Could not create instance` или лимиты

**Решение:**
- Проверить `aws_region` в terraform.tfvars (например, `eu-north-1`)
- Проверить лимиты EC2 в AWS Console
- Проверить `allowed_ssh_cidr` — ваш IP в формате `1.2.3.4/32`

### Переменные не заданы

**Симптом:** `Error: No value for required variable`

**Решение:** Скопировать `terraform.tfvars.example` в `terraform.tfvars` и заполнить `ssh_key_name`, `allowed_ssh_cidr`.

---

## ❌ SSH не работает

### Security Group

**Симптом:** `Connection timed out` при `ssh -i key.pem ubuntu@IP`

**Решение:**
- Проверить `allowed_ssh_cidr` в terraform.tfvars — там должен быть **ваш текущий публичный IP**
- Узнать IP: `curl ifconfig.me`
- Пересоздать: изменить tfvars, `terraform apply`

### Ключ

**Симптом:** `Permission denied (publickey)`

**Решение:**
- Проверить путь: `ssh -i /полный/путь/к/key.pem`
- Права на ключ: `chmod 400 key.pem`
- Имя ключа в AWS должно совпадать с `ssh_key_name` в tfvars

### User

**Симптом:** `Permission denied` при попытке входа не под ubuntu

**Решение:** Использовать `ubuntu@` — стандартный пользователь для Ubuntu AMI в AWS.

---

## ❌ render-ansible-inventory: terraform не найден

**Симптом:** `Имя "terraform" не распознано`

**Решение:**
- Установить Terraform: https://developer.hashicorp.com/terraform/install
- Добавить папку с `terraform.exe` в переменную PATH
- Запускать скрипт из корня проекта: `.\scripts\render-ansible-inventory.ps1`

## ❌ Ansible не подключается

### Inventory

**Симптом:** `No hosts matched` или `UNREACHABLE`

**Решение:**
- Проверить `ansible-inventory -i inventory/hosts.ini --list`
- Убедиться, что `ansible_host` = Elastic IP из `terraform output`
- Перегенерировать: `./scripts/render-ansible-inventory.sh key.pem`

### Путь к ключу

**Симптом:** `UNREACHABLE! => {"msg": "Failed to connect to the host..."}`

**Решение:**
- В inventory `ansible_ssh_private_key_file` должен указывать на существующий .pem файл
- Использовать абсолютный путь: `/home/user/.ssh/clerk-devops-key.pem`

### ansible_user

**Решение:** Должен быть `ubuntu` для Ubuntu AMI.

---

## ❌ Nginx не работает

### Логи

```bash
journalctl -u nginx -n 50
tail -f /var/log/nginx/error.log
```

### Конфиг

```bash
nginx -t
```

Если ошибка — проверить синтаксис в `/etc/nginx/sites-available/clerk`.

### Сервис не запущен

```bash
systemctl start nginx
systemctl status nginx
```

---

## ❌ Сайт не открывается

### Порт 80 закрыт

**Симптом:** `curl` зависает или connection refused

**Решение:**
- Проверить Security Group — порт 80 должен быть открыт (0.0.0.0/0)
- В Terraform: ingress 80 уже есть в main.tf

### Nginx config

**Решение:** `nginx -t`, перезапуск `systemctl reload nginx`

### Нет index.html

**Симптом:** 403 Forbidden

**Решение:**
- Проверить: `ls /var/www/clerk-site/index.html`
- Проверить права: `www-data` должен читать файлы
- Перезапустить Ansible: `ansible-playbook playbooks/bootstrap.yml`

---

## ❌ Игра не работает

### Пути к clerk/

**Симптом:** 404 на `/clerk/`

**Решение:**
- Игра в staging: убедиться, что деплоится staging или что prod содержит `clerk/`
- Проверить на сервере: `ls /var/www/clerk-site/clerk/`

### Отсутствуют Build файлы

**Решение:** Unity WebGL требует полный билд в `site/staging/clerk/` (Build/, TemplateData/). Убедитесь, что артефакты импортированы. См. `site/README.md`.

### MIME types

**Симптом:** .data, .wasm не загружаются

**Решение:** Nginx по умолчанию отдаёт правильные MIME. Если нет — добавить в location:

```nginx
types {
    application/wasm wasm;
}
```
