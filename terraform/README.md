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
| public_ip | публичный IP сервера |
| public_dns | DNS имя EC2 |
| instance_id | ID инстанса |
| ssh_command | готовая команда SSH |
| vpc_id | ID созданной сети |

## Подключение к серверу

Пример подключения:

```bash
ssh -i key.pem ubuntu@<public_ip>
```

Или используйте команду из `terraform output`.

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
├── terraform/
│   ├── README.md
│   ├── versions.tf
│   ├── provider.tf
│   ├── variables.tf
│   ├── main.tf
│   ├── outputs.tf
│   └── terraform.tfvars.example
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
- Состояние Terraform (`terraform.tfstate`) также не хранится в репозитории.

В следующих версиях проекта планируется добавить:

- remote state (S3 backend)
- Elastic IP
- CI/CD pipeline
- автоматическую интеграцию Terraform и Ansible

---

**Автор:** Pet-проект для изучения DevOps практик и построения production-подобной инфраструктуры.
