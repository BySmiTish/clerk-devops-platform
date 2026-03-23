# Clerk DevOps Platform — Terraform инфраструктура

## Описание проекта

Этот проект содержит инфраструктуру, описанную с помощью Terraform, для развёртывания среды приложения Clerk DevOps Platform.

Clerk DevOps Platform — это pet-проект, в котором используется небольшая веб-игра в жанре point-and-click про клерка как демонстрационный продукт для практики production-подходов в DevOps.

Инфраструктура создаётся в AWS и служит базой для дальнейшей настройки сервера через Ansible, деплоя приложения и подключения системы мониторинга.

## Архитектура инфраструктуры

Terraform создаёт следующие ресурсы в AWS:

| Ресурс | Назначение |
|--------|------------|
| VPC | Отдельная виртуальная сеть для инфраструктуры |
| Public Subnet | Публичная подсеть для размещения сервера |
| Internet Gateway | Обеспечивает выход VPC в интернет |
| Route Table | Управляет маршрутизацией сети |
| Security Group | Firewall для управления входящим и исходящим трафиком |
| EC2 Instance | Виртуальный сервер (Ubuntu) |
| Elastic IP | Постоянный публичный IP (не меняется при stop/start) |
| EBS Volume | Зашифрованный диск для операционной системы |
| Tags | Автоматическая маркировка всех ресурсов |

### Схема инфраструктуры

```
Internet
   │
   ▼
Internet Gateway
   │
   ▼
VPC (10.10.0.0/16)
   │
   ▼
Public Subnet (10.10.1.0/24)
   │
   ▼
EC2 Instance (Ubuntu)
   │
   ├─ Docker
   ├─ Nginx
   ├─ FastAPI приложение
   └─ Monitoring stack
```

## Требования

Перед запуском проекта необходимо установить:

- Terraform ≥ 1.5
- AWS CLI
- аккаунт AWS
- созданный EC2 Key Pair
- настроенные AWS credentials (`aws configure`)

## Подготовка переменных

В репозитории присутствует файл-шаблон:

```
terraform.tfvars.example
```

Создайте рабочий файл переменных:

```bash
# Linux / macOS / Git Bash
cp terraform.tfvars.example terraform.tfvars

# PowerShell
Copy-Item terraform.tfvars.example terraform.tfvars
```

Затем заполните значения:

| Переменная | Назначение |
|------------|------------|
| aws_region | регион AWS |
| availability_zone | зона доступности |
| instance_type | тип EC2 инстанса |
| ssh_key_name | имя ключа SSH |
| allowed_ssh_cidr | IP-адрес, которому разрешён SSH доступ |

Пример:

```hcl
allowed_ssh_cidr = "1.2.3.4/32"
```

## Проверка Terraform

Перед apply выполните:

```bash
cd terraform
terraform fmt -check      # проверка форматирования (terraform fmt — автоисправление)
terraform validate       # валидность конфигурации, provider, variables
terraform plan           # просмотр плана
```

## Запуск инфраструктуры

Перейдите в директорию Terraform:

```bash
cd terraform
```

Инициализация Terraform:

```bash
terraform init
```

Проверка конфигурации:

```bash
terraform validate
```

Просмотр плана создания инфраструктуры:

```bash
terraform plan
```

Создание инфраструктуры:

```bash
terraform apply
```

После подтверждения Terraform создаст все необходимые ресурсы.

## Outputs

После успешного выполнения `terraform apply` будут выведены:

| Output | Описание |
|--------|----------|
| public_ip | Elastic IP сервера (стабильный, основной адрес для доступа) |
| public_dns | DNS имя EC2 (резолвится в Elastic IP) |
| instance_id | ID инстанса |
| ssh_command | готовая команда SSH |
| vpc_id | ID созданной сети |

**Основной адрес для SSH, Nginx и Ansible — Elastic IP** (`public_ip`). Он не меняется при stop/start инстанса.

## Подключение к серверу

Пример подключения:

```bash
ssh -i key.pem ubuntu@<public_ip>
```

Или используйте команду из `terraform output ssh_command`.

## Генерация Ansible inventory

IP для Ansible можно взять из Terraform и сгенерировать inventory:

```bash
# Из корня проекта
./scripts/render-ansible-inventory.sh [путь/к/key.pem]
```

См. `ansible/README.md` для деталей.

## Следующие шаги

После создания инфраструктуры планируется:

- настройка сервера через Ansible
- установка Docker
- настройка Nginx
- деплой FastAPI приложения
- установка системы мониторинга:
  - Prometheus
  - Grafana
  - Loki

## Структура проекта

```
clerk-devops-platform
│
├── site/                   # Статический сайт (источник для deploy)
│   └── README.md
├── terraform/
│   ├── README.md
│   ├── versions.tf
│   ├── provider.tf
│   ├── variables.tf
│   ├── main.tf
│   ├── outputs.tf
│   └── terraform.tfvars.example
│
├── scripts/
│   ├── render-ansible-inventory.sh
│   └── render-ansible-inventory.ps1
│
├── ansible/
│
├── monitoring/
│
├── app/
│
└── docs/
```

## Цели проекта

Этот проект используется для практики следующих DevOps технологий:

- Infrastructure as Code (Terraform)
- Configuration management (Ansible)
- Cloud infrastructure (AWS)
- CI/CD
- Monitoring и Observability
- Контейнеризация (Docker)

## Примечания

- Файл `terraform.tfvars` не добавляется в git и используется только локально.
- Состояние Terraform (`terraform.tfstate`) не хранится в репозитории.
- Файл `.terraform.lock.hcl` **может коммититься** — фиксирует версии провайдеров для воспроизводимых прогонов.

В следующих версиях проекта планируется добавить:

- remote state (S3 backend)
- CI/CD pipeline
- автоматическую интеграцию Terraform и Ansible

---

**Автор:** Pet-проект для изучения DevOps практик и построения production-подобной инфраструктуры.
