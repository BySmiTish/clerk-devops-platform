#!/usr/bin/env bash
# Генерирует ansible/inventory/hosts.ini из Terraform output.
#
# Использование:
#   ./scripts/render-ansible-inventory.sh
#   ./scripts/render-ansible-inventory.sh /path/to/key.pem
#
# Переменные окружения:
#   ANSIBLE_SSH_KEY — путь к .pem ключу (если не передан аргументом)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ANSIBLE_INVENTORY="$REPO_ROOT/ansible/inventory/hosts.ini"
TEMPLATE="$REPO_ROOT/ansible/inventory/hosts.ini.template"

SSH_KEY="${1:-${ANSIBLE_SSH_KEY:-$HOME/.ssh/clerk-devops-key.pem}}"

if [[ ! -f "$TEMPLATE" ]]; then
  echo "Error: template not found: $TEMPLATE" >&2
  exit 1
fi

cd "$REPO_ROOT/terraform"
PUBLIC_IP=$(terraform output -raw public_ip 2>/dev/null) || true
if [[ -z "$PUBLIC_IP" ]]; then
  echo "Error: could not get public_ip. Run 'terraform apply' first." >&2
  exit 1
fi

sed -e "s|__PUBLIC_IP__|$PUBLIC_IP|g" \
  -e "s|__SSH_KEY_PATH__|$SSH_KEY|g" \
  "$TEMPLATE" > "$ANSIBLE_INVENTORY"

echo "Generated $ANSIBLE_INVENTORY (public_ip=$PUBLIC_IP)"
