#!/usr/bin/env bash
# Быстрые проверки перед первым деплоем (fail-fast)
# Запуск из корня проекта: ./scripts/quick-check.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_ROOT"

echo "=== 1. Checking site artifacts ==="

# Staging — полный deploy artifact
if [[ ! -f site/staging/index.html ]]; then
  echo "ERROR: site/staging/index.html not found."
  echo "site/staging/ must be a complete deploy artifact. See site/README.md"
  exit 1
fi
if [[ ! -f site/staging/clerk/index.html ]]; then
  echo "ERROR: site/staging/clerk/index.html not found."
  echo "Game wrapper must exist in site/staging/clerk/"
  exit 1
fi
if [[ ! -d site/staging/clerk/game/Build ]]; then
  echo "ERROR: site/staging/clerk/game/Build not found."
  echo "Unity WebGL build must be in site/staging/clerk/game/"
  exit 1
fi
echo "OK: site/staging/ complete (index.html, clerk/, clerk/game/Build)"

# Prod — самодостаточный artifact
if [[ ! -f site/prod/index.html ]]; then
  echo "ERROR: site/prod/index.html not found."
  echo "site/prod/ must be a complete deploy artifact. See site/README.md"
  exit 1
fi
if [[ ! -d site/prod/clerk ]]; then
  echo "WARN: site/prod/clerk/ not found — prod может не иметь игру."
  echo "      Если prod — копия staging, clerk/ должен быть."
fi
echo "OK: site/prod/ has index.html"

echo ""
echo "=== 2. Checking Terraform ==="
cd terraform
terraform validate
echo "OK: terraform validate passed"

if terraform fmt -check 2>/dev/null; then
  echo "OK: terraform fmt check passed"
else
  echo "WARN: run 'terraform fmt' to fix formatting"
fi
cd "$REPO_ROOT"

echo ""
echo "=== 3. Checking Ansible playbook ==="
cd ansible
ansible-playbook playbooks/bootstrap.yml --syntax-check -i inventory/hosts.ini.example
echo "OK: playbook syntax check passed"
cd "$REPO_ROOT"

echo ""
echo "=== Done. Ready for deploy. ==="
echo "See docs/RUNBOOK_FIRST_DEPLOY.md for full steps."
