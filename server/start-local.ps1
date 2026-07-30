param(
  [string]$NodePath = ""
)

$ErrorActionPreference = "Stop"
$projectDirectory = Split-Path -Parent $PSScriptRoot

if (-not $NodePath) {
  $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
  if ($nodeCommand) {
    $NodePath = $nodeCommand.Source
  } else {
    $NodePath = Get-ChildItem `
      "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS*\node-*\node.exe" `
      -ErrorAction SilentlyContinue |
      Select-Object -First 1 -ExpandProperty FullName
  }
}

if (-not $NodePath -or -not (Test-Path -LiteralPath $NodePath)) {
  throw "Node.js não foi localizado."
}

$env:PRUMO_DATABASE_URL = [Environment]::GetEnvironmentVariable(
  "PRUMO_DATABASE_URL",
  "User"
)
$env:PRUMO_API_STORAGE = "postgres"
$env:PRUMO_DEV_IDENTITY = "true"
$env:PRUMO_CORS_ORIGINS = "http://127.0.0.1:4173,http://localhost:4173"

Set-Location -LiteralPath $projectDirectory
& $NodePath "server/index.js"
