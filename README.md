<div align="center">

# Clerk DevOps Platform

<p>
  <img src="https://img.shields.io/badge/Terraform-≥1.5-7B42BC?style=flat-square&logo=terraform&logoColor=white" alt="Terraform"/>
  <img src="https://img.shields.io/badge/Ansible-≥2.14-EE0000?style=flat-square&logo=ansible&logoColor=white" alt="Ansible"/>
  <img src="https://img.shields.io/badge/AWS-EC2%20%7C%20VPC%20%7C%20EIP-FF9900?style=flat-square&logo=amazonwebservices&logoColor=white" alt="AWS"/>
  <img src="https://img.shields.io/badge/Ubuntu-24.04%20LTS-E95420?style=flat-square&logo=ubuntu&logoColor=white" alt="Ubuntu"/>
  <img src="https://img.shields.io/badge/Nginx-static%20hosting-009639?style=flat-square&logo=nginx&logoColor=white" alt="Nginx"/>
  <img src="https://img.shields.io/badge/Docker-Engine%20%2B%20Compose-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker"/>
  <img src="https://img.shields.io/badge/region-eu--north--1-232F3E?style=flat-square&logo=amazonwebservices&logoColor=white" alt="Region"/>
</p>

**End-to-end DevOps pipeline: infrastructure provisioning, server configuration,
and deployment of a portfolio site with an embedded Unity WebGL game.**

[Quick Start](#quick-start) · [Architecture](#architecture) · [How It Works](#how-it-works) · [Runbook](docs/RUNBOOK_FIRST_DEPLOY.md) · [Troubleshooting](docs/TROUBLESHOOTING.md)

</div>

---

## Overview

This project demonstrates a complete, production-approach DevOps workflow built entirely from scratch:

- **Infrastructure as Code** — AWS resources defined in Terraform, reproducible in a single command
- **Configuration Management** — idempotent Ansible roles that configure a bare Ubuntu server from zero
- **Automated Inventory** — scripts bridge Terraform outputs directly into Ansible inventory
- **Static Hosting** — Nginx serves a portfolio landing page with an embedded Unity WebGL game
- **Operational Readiness** — runbook, troubleshooting guide, and pre-deploy validation scripts included

The deployed product is a personal portfolio site (**Clerk CYCLE-12**) — a landing page wrapping a Unity point-and-click game — used as the demonstration workload for all infrastructure operations.

---

## Architecture

```
                        INTERNET
                            │
                    ┌───────▼────────┐
                    │ Internet Gateway│
                    └───────┬────────┘
                            │
              ┌─────────────▼──────────────┐
              │     VPC  10.10.0.0/16       │
              │                             │
              │  ┌──────────────────────┐   │
              │  │  Public Subnet        │   │
              │  │  10.10.1.0/24        │   │
              │  │                      │   │
              │  │  ┌────────────────┐  │   │
              │  │  │  EC2 t3.micro  │  │   │
              │  │  │  Ubuntu 24.04  │  │   │
              │  │  │                │  │   │
              │  │  │  ├ Docker      │  │   │
              │  │  │  ├ Nginx :80   │  │   │
              │  │  │  └ /opt/clerk  │  │   │
              │  │  └───────┬────────┘  │   │
              │  │          │           │   │
              │  │  ┌───────▼────────┐  │   │
              │  │  │  Elastic IP    │  │   │
              │  │  │  (static, VPC) │  │   │
              │  │  └────────────────┘  │   │
              │  │                      │   │
              │  │  Security Group      │   │
              │  │  ├ :22  → your IP   │   │
              │  │  ├ :80  → 0.0.0.0/0 │   │
              │  │  └ :443 → 0.0.0.0/0 │   │
              │  └──────────────────────┘   │
              └─────────────────────────────┘
```

**AWS Resources provisioned by Terraform:**

| Resource | Name pattern | Purpose |
|----------|-------------|---------|
| VPC | `{project}-{env}-vpc` | Isolated network |
| Internet Gateway | `{project}-{env}-igw` | Internet access for VPC |
| Public Subnet | `{project}-{env}-public-subnet` | EC2 placement |
| Route Table | `{project}-{env}-public-rt` | Route `0.0.0.0/0` → IGW |
| Security Group | `{project}-{env}-sg` | Firewall: SSH restricted by IP |
| EC2 Instance | `{project}-{env}-ec2` | Ubuntu 24.04 server |
| EBS Volume | gp3, 20 GB, encrypted | Root disk |
| Elastic IP | `{project}-{env}-eip` | Stable public IP across stop/start |

---

## Tech Stack

| Layer | Technology | Version | Role |
|-------|-----------|---------|------|
| Infrastructure | Terraform | ≥ 1.5 | AWS resource provisioning |
| Cloud | AWS | — | EC2, VPC, EIP, EBS |
| OS | Ubuntu | 24.04 LTS | Server operating system |
| Config Management | Ansible | ≥ 2.14 | Server configuration and deploy |
| Runtime | Docker Engine | latest stable | Container runtime (prepared for backend) |
| Compose | Docker Compose Plugin | latest stable | Multi-container orchestration |
| Web Server | Nginx | latest stable | Static file hosting |
| Game Engine | Unity WebGL | — | Embedded browser game |
| Scripting | Bash / PowerShell | — | Automation and inventory generation |

---

## Project Structure

```
clerk-devops-platform/
│
├── terraform/                    # Infrastructure as Code (AWS)
│   ├── main.tf                   # VPC, Subnet, SG, EC2, Elastic IP
│   ├── variables.tf              # All input variables with validation
│   ├── outputs.tf                # Public IP, SSH command, instance ID
│   ├── provider.tf               # AWS provider + default_tags for all resources
│   ├── versions.tf               # Terraform and provider version constraints
│   ├── terraform.tfvars.example  # Template — copy to terraform.tfvars
│   └── README.md
│
├── ansible/                      # Server configuration and deployment
│   ├── ansible.cfg               # Ansible settings (inventory, callbacks)
│   ├── .ansible-lint             # Lint profile: moderate
│   ├── playbooks/
│   │   └── bootstrap.yml         # Main playbook: common → docker → site → nginx
│   ├── inventory/
│   │   ├── hosts.ini             # Generated by script (gitignored)
│   │   ├── hosts.ini.template    # Placeholder template for render script
│   │   ├── hosts.ini.example     # Manual setup reference
│   │   └── group_vars/
│   │       └── all.yml           # Shared variables: project, packages, directories
│   ├── roles/
│   │   ├── common/               # apt cache, base packages, project directories
│   │   ├── docker/               # Docker Engine + Compose Plugin (modern GPG method)
│   │   ├── site/                 # Copy static artifact to /var/www/clerk-site
│   │   └── nginx/                # Install, configure, validate and reload Nginx
│   └── README.md
│
├── site/                         # Frontend deploy artifacts
│   ├── prod/                     # Production artifact (index.html + clerk/ game)
│   ├── staging/                  # Staging artifact (same structure, separate copy)
│   └── README.md
│
├── scripts/
│   ├── render-ansible-inventory.sh   # Bash: Terraform output → hosts.ini
│   ├── render-ansible-inventory.ps1  # PowerShell equivalent (Windows)
│   └── quick-check.sh                # Pre-deploy validation (fail-fast)
│
├── docs/
│   ├── RUNBOOK_FIRST_DEPLOY.md   # Step-by-step first deploy guide
│   └── TROUBLESHOOTING.md        # Common failure scenarios and fixes
│
├── app/                          # Reserved: FastAPI backend (next phase)
├── monitoring/                   # Reserved: Prometheus + Grafana + Loki (next phase)
└── README.md
```

---

## How It Works

The deployment follows a two-phase pipeline: **Terraform** provisions infrastructure, **Ansible** configures the server.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DEPLOYMENT PIPELINE                          │
│                                                                     │
│  1. terraform apply          Creates EC2, VPC, Elastic IP in AWS   │
│         │                                                           │
│         ▼                                                           │
│  2. render-ansible-inventory.sh                                     │
│         │   Reads Terraform output (public_ip)                      │
│         │   Writes ansible/inventory/hosts.ini                      │
│         ▼                                                           │
│  3. ansible-playbook bootstrap.yml                                  │
│         │                                                           │
│         ├── role: common   → update apt, install packages,          │
│         │                    create /opt/clerk directories           │
│         ├── role: docker   → Docker Engine + Compose Plugin         │
│         │                    (official repo, signed-by keyring)      │
│         ├── role: site     → copy site/prod/ → /var/www/clerk-site  │
│         └── role: nginx    → install, deploy config template,       │
│                              enable site, validate (nginx -t),       │
│                              reload                                  │
│                                                                     │
│  Result: http://<elastic-ip>         → portfolio landing page       │
│          http://<elastic-ip>/clerk/  → Unity WebGL game             │
└─────────────────────────────────────────────────────────────────────┘
```

### Ansible Roles in Detail

| Role | What it does | Idempotent |
|------|-------------|-----------|
| `common` | Updates apt cache, installs base packages (curl, git, unzip, ca-certificates), creates `/opt/clerk` project directories with correct ownership | Yes |
| `docker` | Adds official Docker apt repository using the modern `get_url` + `signed-by` method (Ubuntu 24.04 compatible), installs docker-ce + docker-compose-plugin, starts and enables the service, adds `ubuntu` user to docker group | Yes |
| `site` | Validates that `site/{env}/index.html` exists before proceeding (fail-fast), creates web root, copies static artifact with correct `www-data` ownership and permissions | Yes |
| `nginx` | Installs Nginx, deploys `clerk.conf.j2` template with correct `root` and `try_files`, enables site via symlink, removes default site, validates config with `nginx -t` before reload (safe handler) | Yes |

---

## Quick Start

### Prerequisites

- Terraform ≥ 1.5
- Ansible ≥ 2.14
- AWS CLI with configured credentials (`aws configure`)
- EC2 Key Pair created in AWS console (region: `eu-north-1`)

### 1. Clone and prepare variables

```bash
git clone https://github.com/BySmiTish/clerk-devops-platform.git
cd clerk-devops-platform/terraform

cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars`:
```hcl
ssh_key_name     = "your-key-pair-name"
allowed_ssh_cidr = "YOUR_PUBLIC_IP/32"   # curl ifconfig.me
```

### 2. Provision infrastructure

```bash
cd terraform
terraform init
terraform validate
terraform plan
terraform apply
```

Get the server IP:
```bash
terraform output -raw public_ip
```

### 3. Pre-deploy check (optional but recommended)

```bash
cd ..
./scripts/quick-check.sh
```

### 4. Generate Ansible inventory

```bash
# Linux / macOS
./scripts/render-ansible-inventory.sh /path/to/your-key.pem

# Windows (PowerShell)
.\scripts\render-ansible-inventory.ps1 -SshKeyPath "C:\path\to\key.pem"
```

### 5. Verify SSH access

```bash
ssh -i /path/to/your-key.pem ubuntu@$(cd terraform && terraform output -raw public_ip)
```

### 6. Run Ansible bootstrap

```bash
cd ansible
ansible-playbook playbooks/bootstrap.yml
```

### 7. Verify deployment

```bash
curl -I http://$(cd ../terraform && terraform output -raw public_ip)
# Expected: HTTP/1.1 200 OK
```

Open in browser:
- **Portfolio site:** `http://<elastic-ip>`
- **Clerk CYCLE-12 game:** `http://<elastic-ip>/clerk/`

---

## Validation Checklist

| Step | Command | Expected |
|------|---------|----------|
| Site artifact | `ls site/prod/index.html` | File exists |
| Terraform syntax | `cd terraform && terraform validate` | Success |
| Terraform plan | `terraform plan` | No errors |
| SSH connectivity | `ssh -i key.pem ubuntu@<IP>` | Connected |
| Ansible inventory | `ansible-inventory -i inventory/hosts.ini --list` | Group `clerk_servers` present |
| Playbook syntax | `ansible-playbook bootstrap.yml --syntax-check` | `playbook: bootstrap.yml` |
| Nginx config | `nginx -t` (on server) | `syntax is ok` |
| HTTP response | `curl -I http://<IP>` | `HTTP/1.1 200 OK` |
| Game route | `http://<IP>/clerk/` in browser | Game loads |

---

## Security Design

| Control | Implementation |
|---------|---------------|
| SSH access | Restricted to a single IP via `allowed_ssh_cidr` variable in Security Group |
| EBS disk | Encrypted at rest (`encrypted = true` in root block device) |
| Grafana port | Port 3000 restricted to owner IP only (not public) |
| Secrets management | `terraform.tfvars` and `hosts.ini` are gitignored — never committed |
| Resource tagging | All AWS resources tagged via `provider.default_tags` (`Project`, `Environment`, `ManagedBy`) |
| Terraform state | Local state gitignored; S3 remote backend planned for next phase |

---

## Operational Notes

**Inventory regeneration** after EC2 restart (Elastic IP never changes, but if you recreate infrastructure):
```bash
./scripts/render-ansible-inventory.sh /path/to/key.pem
```

**Re-running Ansible** is safe — all roles are fully idempotent:
```bash
cd ansible && ansible-playbook playbooks/bootstrap.yml
```

**Switch to staging environment:**
```bash
cd ansible
ansible-playbook playbooks/bootstrap.yml -e "site_environment=staging nginx_site_environment=staging"
```

**Tear down infrastructure:**
```bash
cd terraform && terraform destroy
```

---

## Roadmap

The project is being built incrementally. Completed phases are marked.

- [x] **Phase 1 — Infrastructure Foundation**
  - [x] VPC, Subnet, IGW, Route Table, Security Group
  - [x] EC2 (Ubuntu 24.04) with encrypted EBS
  - [x] Elastic IP
  - [x] Terraform variables with validation

- [x] **Phase 2 — Server Configuration**
  - [x] Ansible roles: common, docker, site, nginx
  - [x] Docker Engine + Compose Plugin (Ubuntu 24.04 compatible)
  - [x] Static site hosting via Nginx
  - [x] Nginx safe reload handler (`nginx -t` before reload)
  - [x] Automated inventory from Terraform output (bash + PowerShell)
  - [x] Pre-deploy validation script

- [ ] **Phase 3 — CI/CD Pipeline**
  - [ ] GitHub Actions: `terraform validate` + `fmt-check` on every PR
  - [ ] GitHub Actions: `ansible-lint` on every PR
  - [ ] Automated deploy on merge to main

- [ ] **Phase 4 — Application Layer**
  - [ ] FastAPI backend (Python)
  - [ ] Docker Compose service definitions
  - [ ] Nginx as reverse proxy to backend

- [ ] **Phase 5 — Observability**
  - [ ] Prometheus metrics collection
  - [ ] Grafana dashboards
  - [ ] Loki log aggregation
  - [ ] Alerting rules

- [ ] **Phase 6 — Production Hardening**
  - [ ] Terraform S3 remote backend + DynamoDB state lock
  - [ ] HTTPS via Let's Encrypt (certbot Ansible role)
  - [ ] Separate staging and production environments

---

## References

- [First Deploy Runbook](docs/RUNBOOK_FIRST_DEPLOY.md) — full step-by-step walkthrough
- [Troubleshooting Guide](docs/TROUBLESHOOTING.md) — common failure scenarios and fixes
- [Terraform module docs](terraform/README.md) — infrastructure details
- [Ansible playbook docs](ansible/README.md) — role descriptions and variables
- [Site artifact docs](site/README.md) — deploy artifact structure

---

<div align="center">

Built as a hands-on DevOps practice project · AWS eu-north-1 (Stockholm)

</div>
