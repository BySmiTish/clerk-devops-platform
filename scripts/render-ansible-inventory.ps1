# Generates ansible/inventory/hosts.ini from Terraform output or manual IP.
#
# Usage (from project root):
#   .\scripts\render-ansible-inventory.ps1
#   .\scripts\render-ansible-inventory.ps1 -SshKeyPath "C:\path\to\key.pem"
#   .\scripts\render-ansible-inventory.ps1 -PublicIp "1.2.3.4" -SshKeyPath "..."  # without Terraform

param(
    [string]$SshKeyPath = "$env:USERPROFILE\.ssh\clerk-devops-key.pem",
    [string]$PublicIp = ""
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$TerraformDir = Join-Path $RepoRoot "terraform"
$InventoryFile = Join-Path $RepoRoot "ansible\inventory\hosts.ini"
$TemplateFile = Join-Path $RepoRoot "ansible\inventory\hosts.ini.template"

if ($PublicIp) {
    Write-Host "Using provided PublicIp: $PublicIp"
} elseif (Get-Command terraform -ErrorAction SilentlyContinue) {
    Push-Location $TerraformDir
    try {
        $PublicIp = terraform output -raw public_ip
    } catch {
        Write-Host "ERROR: Could not get public_ip. Run 'terraform apply' first." -ForegroundColor Red
        Pop-Location
        exit 1
    } finally {
        Pop-Location
    }
} else {
    Write-Host "ERROR: terraform not found in PATH." -ForegroundColor Red
    Write-Host "Options:"
    Write-Host "  1. Install Terraform and add to PATH: https://developer.hashicorp.com/terraform/install"
    Write-Host "  2. Pass IP manually: .\scripts\render-ansible-inventory.ps1 -PublicIp ""1.2.3.4"" -SshKeyPath ""path\to\key.pem"""
    exit 1
}

$Content = Get-Content $TemplateFile -Raw
$Content = $Content -replace '__PUBLIC_IP__', $PublicIp
$Content = $Content -replace '__SSH_KEY_PATH__', $SshKeyPath
$Content | Set-Content $InventoryFile -NoNewline

Write-Host "Generated $InventoryFile (public_ip=$PublicIp)"
