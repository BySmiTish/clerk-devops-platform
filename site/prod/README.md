# site/prod — prod deploy artifact

Эта папка — **production**-артефакт, который по умолчанию отдаёт Nginx.

Как развертывается (Terraform + Ansible):
- Ansible роль `site` копирует содержимое `site/prod/` на сервер
- `site_environment: prod` → `/var/www/clerk-site`
- затем роль `nginx` настраивает static hosting с `root /var/www/clerk-site`

Важно:
- Деплой делается **Ansible**, поэтому на сервере править вручную не нужно — повторный `bootstrap` перезальёт статику.
- Если в prod артефакте есть папка `clerk/`, то игра будет открываться по `http://<ip>/clerk/`. Если `clerk/` отсутствует — игра не загрузится.
- В `index.html` и `clerk/index.html` используются **относительные** пути к статике/игре, чтобы ссылки работали внутри выбранного артефакта.
