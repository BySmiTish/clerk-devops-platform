# 🚀 FIRST DEPLOY — STEP BY STEP

Пошаговый сценарий первого деплоя Clerk DevOps Platform на AWS.

## Предварительные требования

- Terraform ≥ 1.5
- Ansible ≥ 2.14
- AWS CLI + настроенные credentials (`aws configure`)
- EC2 Key Pair создан в AWS
- site/prod и site/staging содержат артефакты (импортированы из legacy Clerk repo)

---

## 1. Проверка site artifact

**Fail-fast:** если артефактов нет, Ansible упадёт. Проверьте заранее:

```bash
# Из корня проекта
ls site/prod/index.html
ls site/staging/index.html
```

Если нет — артефакты должны быть импортированы. → см. `site/README.md`

---

## 2. Terraform

```bash
cd terraform
terraform init
terraform fmt -check     # проверка форматирования (или terraform fmt для автоисправления)
terraform validate      # валидация конфигурации
terraform plan          # просмотр плана
terraform apply         # создать инфраструктуру
```

Проверяется: синтаксис .tf, provider, variables.

---

## 3. Получить IP

```bash
terraform output -raw public_ip
```

Сохраните IP — понадобится для SSH и проверок.

---

## 4. Проверить SSH (критично!)

**Перед Ansible обязательно проверьте SSH:**

```bash
ssh -i /path/to/key.pem ubuntu@<IP>
```

Если не подключается → см. `docs/TROUBLESHOOTING.md` (SSH не работает).

---

## 5. Сгенерировать inventory

```bash
# Из корня проекта
./scripts/render-ansible-inventory.sh /path/to/key.pem
```

---

## 6. Проверить inventory

```bash
cd ansible
ansible-inventory -i inventory/hosts.ini --list
```

Должна быть группа `clerk_servers` с хостом. Пример правильного inventory:

```ini
[clerk_servers]
clerk_dev ansible_host=1.2.3.4 ansible_user=ubuntu ansible_ssh_private_key_file=~/.ssh/key.pem ansible_python_interpreter=/usr/bin/python3
```

---

## 7. Проверить playbook

```bash
ansible-playbook playbooks/bootstrap.yml --syntax-check -i inventory/hosts.ini
```

Ожидается: `playbook: playbooks/bootstrap.yml`

---

## 8. Запустить Ansible

```bash
ansible-playbook playbooks/bootstrap.yml -i inventory/hosts.ini
```

---

## 9. Проверить сервер

```bash
ssh -i /path/to/key.pem ubuntu@<IP>
```

На сервере:

```bash
ls -la /var/www/clerk-site
nginx -t
systemctl status nginx
```

---

## 10. Проверить сайт

```bash
curl -I http://<IP>
```

Ожидается: `HTTP/1.1 200 OK`

В браузере: `http://<IP>`

---

## 11. Проверить игру (Unity WebGL)

Открыть в браузере:

```
http://<IP>/clerk/
```

---

## Быстрая проверка перед деплоем

```bash
./scripts/quick-check.sh
```

См. также: `docs/TROUBLESHOOTING.md`
