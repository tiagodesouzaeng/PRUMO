param(
  [int]$Port = 5173
)

$ErrorActionPreference = "Stop"
$projectDirectory = Split-Path -Parent $PSScriptRoot

function Read-UserSetting([string]$Name, [string]$Default = "") {
  $value = [Environment]::GetEnvironmentVariable($Name, "User")
  if ([string]::IsNullOrWhiteSpace($value)) { return $Default }
  return $value
}

$env:VITE_PRUMO_API_URL = Read-UserSetting "VITE_PRUMO_API_URL" "http://127.0.0.1:8787"
$env:VITE_PRUMO_AUTH_URL = Read-UserSetting "VITE_PRUMO_AUTH_URL"
$env:VITE_PRUMO_DEV_USER = Read-UserSetting "VITE_PRUMO_DEV_USER"
$env:VITE_PRUMO_TENANT_ID = Read-UserSetting "VITE_PRUMO_TENANT_ID"
$env:VITE_PRUMO_TEAM_ID = Read-UserSetting "VITE_PRUMO_TEAM_ID"

Set-Location -LiteralPath $projectDirectory
& pnpm dev -- --host 127.0.0.1 --port $Port --strictPort
