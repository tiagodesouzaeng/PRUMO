[CmdletBinding()]
param(
  [switch]$Full,
  [switch]$RunTests,
  [switch]$RunBuild,
  [switch]$RunAudit,
  [switch]$AsJson
)

$ErrorActionPreference = "Continue"
$projectDirectory = Split-Path -Parent $PSScriptRoot
$results = New-Object System.Collections.Generic.List[object]

if ($Full) {
  $RunTests = $true
  $RunBuild = $true
  $RunAudit = $true
}

function Add-Check {
  param(
    [string]$Component,
    [ValidateSet("OK", "ALERTA", "FALHA", "INFO")]
    [string]$Status,
    [string]$Details,
    [bool]$Required = $true
  )

  $results.Add([pscustomobject]@{
    Componente = $Component
    Status = $Status
    Detalhes = $Details
    Obrigatorio = $Required
  })
}

function Get-ConfiguredValue {
  param([string]$Name)

  foreach ($scope in @("Process", "User", "Machine")) {
    $value = [Environment]::GetEnvironmentVariable($Name, $scope)
    if (-not [string]::IsNullOrWhiteSpace($value)) {
      return [pscustomobject]@{ Value = $value; Scope = $scope }
    }
  }
  return $null
}

function Find-PostgresTool {
  param([string]$Name)

  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }

  $candidate = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\$Name.exe" `
    -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending |
    Select-Object -First 1
  if ($candidate) { return $candidate.FullName }
  return $null
}

function Invoke-PsqlScalar {
  param(
    [string]$PsqlPath,
    [string]$ConnectionUrl,
    [string]$Sql
  )

  if ([string]::IsNullOrWhiteSpace($ConnectionUrl)) {
    throw "URL de conexao ausente."
  }

  $uri = [Uri]$ConnectionUrl
  $userInfo = $uri.UserInfo -split ":", 2
  $user = [Uri]::UnescapeDataString($userInfo[0])
  $password = if ($userInfo.Count -gt 1) {
    [Uri]::UnescapeDataString($userInfo[1])
  } else { "" }
  $database = $uri.AbsolutePath.TrimStart("/")
  $previousPassword = $env:PGPASSWORD

  try {
    $env:PGPASSWORD = $password
    $output = & $PsqlPath -X -w -h $uri.Host -p $uri.Port -U $user `
      -d $database -At -F "|" -c $Sql 2>&1
    if ($LASTEXITCODE -ne 0) {
      throw (($output | Out-String).Trim())
    }
    return @($output | ForEach-Object { [string]$_ })
  }
  finally {
    $env:PGPASSWORD = $previousPassword
  }
}

function Test-HttpEndpoint {
  param([string]$Url)

  try {
    $response = Invoke-RestMethod -Uri $Url -TimeoutSec 3
    return [pscustomobject]@{ Ok = $true; Response = $response }
  }
  catch {
    return [pscustomobject]@{ Ok = $false; Error = $_.Exception.Message }
  }
}

Set-Location -LiteralPath $projectDirectory

# Sistema
try {
  $os = Get-CimInstance Win32_OperatingSystem
  $disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
  $freeGb = [math]::Round($disk.FreeSpace / 1GB, 1)
  $diskStatus = if ($freeGb -lt 10) { "FALHA" } elseif ($freeGb -lt 25) { "ALERTA" } else { "OK" }
  Add-Check "Sistema operacional" "OK" "$($os.Caption) $($os.Version), $($os.OSArchitecture)"
  Add-Check "Espaco em disco" $diskStatus "$freeGb GB livres na unidade C:" ($freeGb -ge 10)
}
catch {
  Add-Check "Sistema operacional" "ALERTA" "Nao foi possivel consultar detalhes do Windows." $false
}

$effectivePolicy = Get-ExecutionPolicy
$policyStatus = if ($effectivePolicy -eq "Restricted") { "ALERTA" } else { "OK" }
Add-Check "PowerShell" $policyStatus "Politica efetiva: $effectivePolicy. Use -ExecutionPolicy Bypass se necessario." $false

# Git
$git = Get-Command git -ErrorAction SilentlyContinue
if (-not $git) {
  Add-Check "Git" "FALHA" "Git nao encontrado no PATH."
}
else {
  $gitVersion = (& $git.Source --version 2>$null) -replace "^git version\s+", ""
  Add-Check "Git" "OK" "Versao $gitVersion"

  $insideRepo = (& $git.Source rev-parse --is-inside-work-tree 2>$null) -eq "true"
  if ($insideRepo) {
    $branch = (& $git.Source branch --show-current 2>$null).Trim()
    $commit = (& $git.Source rev-parse --short=12 HEAD 2>$null).Trim()
    $dirty = -not [string]::IsNullOrWhiteSpace((& $git.Source status --porcelain 2>$null | Out-String))
    $repoStatus = if ($dirty) { "ALERTA" } else { "OK" }
    $repoDetail = "Branch $branch, commit $commit, arvore " + $(if ($dirty) { "com alteracoes" } else { "limpa" })
    Add-Check "Repositorio PRUMO" $repoStatus $repoDetail
  }
  else {
    Add-Check "Repositorio PRUMO" "FALHA" "O script nao esta dentro de um repositorio Git."
  }

  $gitName = & $git.Source config --global --get user.name 2>$null
  $gitEmail = & $git.Source config --global --get user.email 2>$null
  $identityStatus = if ($gitName -and $gitEmail) { "OK" } else { "ALERTA" }
  $identityDetail = "Nome e e-mail " + $(if ($identityStatus -eq "OK") { "configurados" } else { "ainda nao configurados" })
  Add-Check "Identidade Git" $identityStatus $identityDetail $false
}

# Node e pnpm
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Add-Check "Node.js" "FALHA" "Node.js nao encontrado no PATH."
}
else {
  $nodeVersion = (& $node.Source --version 2>$null).TrimStart("v")
  $nodeMajor = [int](($nodeVersion -split "\.")[0])
  Add-Check "Node.js" $(if ($nodeMajor -ge 20) { "OK" } else { "FALHA" }) "Versao $nodeVersion; minimo exigido: 20"
}

$packageManagerExpected = ""
try {
  $packageJson = Get-Content -LiteralPath "package.json" -Raw | ConvertFrom-Json
  $packageManagerExpected = [string]$packageJson.packageManager
}
catch {
  Add-Check "package.json" "FALHA" "Nao foi possivel ler o manifesto do projeto."
}

$corepack = Get-Command corepack -ErrorAction SilentlyContinue
if (-not $corepack) {
  Add-Check "Corepack/pnpm" "FALHA" "Corepack nao encontrado no PATH."
}
else {
  $pnpmVersion = (& $corepack.Source pnpm --version 2>$null | Select-Object -Last 1).Trim()
  $expectedVersion = ($packageManagerExpected -split "@")[1]
  $pnpmStatus = if ($pnpmVersion -eq $expectedVersion) { "OK" } else { "ALERTA" }
  Add-Check "Corepack/pnpm" $pnpmStatus "Ativo: $pnpmVersion; esperado: $expectedVersion"
}

if ((Test-Path -LiteralPath "pnpm-lock.yaml") -and (Test-Path -LiteralPath "node_modules\.pnpm")) {
  Add-Check "Dependencias" "OK" "Lockfile e node_modules presentes."
}
else {
  Add-Check "Dependencias" "FALHA" "Execute: corepack pnpm install --frozen-lockfile"
}

# PostgreSQL
$postgresService = Get-Service -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -match "postgres|pgsql" -or $_.DisplayName -match "PostgreSQL" } |
  Select-Object -First 1
if (-not $postgresService) {
  Add-Check "Servico PostgreSQL" "FALHA" "Servico PostgreSQL nao encontrado."
}
else {
  $serviceStatus = if ($postgresService.Status -eq "Running") { "OK" } else { "FALHA" }
  Add-Check "Servico PostgreSQL" $serviceStatus "$($postgresService.Name): $($postgresService.Status)"
}

$psqlPath = Find-PostgresTool "psql"
$pgDumpPath = Find-PostgresTool "pg_dump"
$pgRestorePath = Find-PostgresTool "pg_restore"
if (-not $psqlPath) {
  Add-Check "Cliente PostgreSQL" "FALHA" "psql nao encontrado."
}
else {
  $psqlVersion = (& $psqlPath --version 2>$null) -replace "^psql \(PostgreSQL\)\s+", ""
  Add-Check "Cliente PostgreSQL" "OK" "psql $psqlVersion"
}
Add-Check "Backup PostgreSQL" $(if ($pgDumpPath -and $pgRestorePath) { "OK" } else { "FALHA" }) `
  $(if ($pgDumpPath -and $pgRestorePath) { "pg_dump e pg_restore disponiveis." } else { "Ferramentas de backup incompletas." })

$postgresListener = Get-NetTCPConnection -LocalPort 5432 -State Listen -ErrorAction SilentlyContinue
Add-Check "Porta PostgreSQL" $(if ($postgresListener) { "OK" } else { "FALHA" }) `
  $(if ($postgresListener) { "Porta 5432 em escuta." } else { "Porta 5432 nao esta em escuta." })

# Configuracao, sem revelar valores
$requiredVariables = @(
  "PRUMO_DATABASE_URL",
  "PRUMO_MIGRATION_DATABASE_URL",
  "PRUMO_API_STORAGE",
  "PRUMO_DEV_IDENTITY",
  "PRUMO_CORS_ORIGINS",
  "VITE_PRUMO_API_URL",
  "VITE_PRUMO_DEV_USER",
  "VITE_PRUMO_TENANT_ID",
  "VITE_PRUMO_TEAM_ID"
)
$missingVariables = New-Object System.Collections.Generic.List[string]
$configuredScopes = New-Object System.Collections.Generic.List[string]
foreach ($variableName in $requiredVariables) {
  $configured = Get-ConfiguredValue $variableName
  if ($configured) {
    $configuredScopes.Add("${variableName}:$($configured.Scope)")
    if ($configured.Scope -ne "Process") {
      [Environment]::SetEnvironmentVariable($variableName, $configured.Value, "Process")
    }
  }
  else {
    $missingVariables.Add($variableName)
  }
}
if ($missingVariables.Count -eq 0) {
  Add-Check "Variaveis PRUMO" "OK" "Todas as variaveis locais obrigatorias estao configuradas; valores ocultos."
}
else {
  Add-Check "Variaveis PRUMO" "FALHA" ("Ausentes: " + ($missingVariables -join ", "))
}

$apiConnection = Get-ConfiguredValue "PRUMO_DATABASE_URL"
$migrationConnection = Get-ConfiguredValue "PRUMO_MIGRATION_DATABASE_URL"

if ($psqlPath -and $apiConnection) {
  try {
    $apiResult = Invoke-PsqlScalar $psqlPath $apiConnection.Value "select current_database(), current_user;"
    Add-Check "Conexao prumo_api" "OK" (($apiResult | Select-Object -First 1) -replace "\|", " / ")
  }
  catch {
    Add-Check "Conexao prumo_api" "FALHA" $_.Exception.Message
  }
}

if ($psqlPath -and $migrationConnection) {
  try {
    $migrationResult = Invoke-PsqlScalar $psqlPath $migrationConnection.Value "select current_database(), current_user;"
    Add-Check "Conexao prumo_migrator" "OK" (($migrationResult | Select-Object -First 1) -replace "\|", " / ")

    $databaseState = Invoke-PsqlScalar $psqlPath $migrationConnection.Value @"
select
  (select pg_get_userbyid(datdba) from pg_database where datname=current_database()),
  (select count(*) from pg_tables where schemaname='app'),
  (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='app' and c.relrowsecurity and c.relforcerowsecurity);
"@
    $stateParts = ($databaseState | Select-Object -First 1) -split "\|"
    $databaseStatus = if ($stateParts[0] -eq "prumo_migrator" -and [int]$stateParts[1] -ge 29 -and [int]$stateParts[2] -ge 22) { "OK" } else { "ALERTA" }
    Add-Check "Estrutura do banco" $databaseStatus "Owner $($stateParts[0]); tabelas app $($stateParts[1]); RLS forcado $($stateParts[2])"

    $roleLines = Invoke-PsqlScalar $psqlPath $migrationConnection.Value @"
select rolname, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls
from pg_roles where rolname in ('prumo_api','prumo_migrator') order by rolname;
"@
    $rolesSafe = $roleLines.Count -eq 2
    foreach ($roleLine in $roleLines) {
      $roleParts = $roleLine -split "\|"
      if (($roleParts | Select-Object -Skip 1) -contains "t") { $rolesSafe = $false }
    }
    Add-Check "Roles PostgreSQL" $(if ($rolesSafe) { "OK" } else { "FALHA" }) `
      $(if ($rolesSafe) { "prumo_api e prumo_migrator sem privilegios administrativos ou BYPASSRLS." } else { "Atributos inseguros ou roles ausentes." })

    $migrationLines = Invoke-PsqlScalar $psqlPath $migrationConnection.Value `
      "select arquivo, checksum from public.prumo_migrations order by arquivo;"
    $databaseChecksums = @{}
    foreach ($line in $migrationLines) {
      $parts = $line -split "\|", 2
      $databaseChecksums[$parts[0]] = $parts[1]
    }

    $migrationFiles = Get-FileHash "server\migrations\*.sql" -Algorithm SHA256
    $checksumOk = $migrationFiles.Count -eq 4
    foreach ($migrationFile in $migrationFiles) {
      $name = Split-Path $migrationFile.Path -Leaf
      if ($databaseChecksums[$name] -ne $migrationFile.Hash.ToLowerInvariant()) {
        $checksumOk = $false
      }
    }
    Add-Check "Checksums das migracoes" $(if ($checksumOk) { "OK" } else { "FALHA" }) `
      $(if ($checksumOk) { "4 de 4 migracoes conferem com o banco." } else { "Ha migracao ausente ou alterada." })
  }
  catch {
    Add-Check "Conexao prumo_migrator" "FALHA" $_.Exception.Message
  }
}

# Servicos HTTP locais
$apiUrlConfig = Get-ConfiguredValue "VITE_PRUMO_API_URL"
$apiUrl = if ($apiUrlConfig) { $apiUrlConfig.Value.TrimEnd("/") } else { "http://127.0.0.1:8787" }
$apiHealth = Test-HttpEndpoint "$apiUrl/health"
if ($apiHealth.Ok) {
  Add-Check "API PRUMO" "OK" "Versao $($apiHealth.Response.versao); armazenamento $($apiHealth.Response.armazenamento)." $false
}
else {
  Add-Check "API PRUMO" "INFO" "Nao esta em execucao. Inicie com: corepack pnpm api" $false
}

$frontendPort = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object { $_.LocalPort -in 5173, 4173 } |
  Select-Object -First 1
if ($frontendPort) {
  Add-Check "Frontend PRUMO" "OK" "Em execucao na porta $($frontendPort.LocalPort)." $false
}
else {
  Add-Check "Frontend PRUMO" "INFO" "Nao esta em execucao. Inicie com: corepack pnpm dev" $false
}

$latestBackup = Get-ChildItem "outputs\backups\*.backup" -File -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1
if ($latestBackup) {
  $backupKb = [math]::Round($latestBackup.Length / 1KB, 1)
  Add-Check "Ultimo backup" "OK" "$($latestBackup.Name), $backupKb KB, $($latestBackup.LastWriteTime)" $false
}
else {
  Add-Check "Ultimo backup" "ALERTA" "Nenhum backup localizado em outputs/backups." $false
}

# Verificacoes opcionais demoradas
if ($RunTests -and $corepack) {
  $testOutput = & $corepack.Source pnpm test 2>&1
  $testExit = $LASTEXITCODE
  $testText = $testOutput | Out-String
  $passMatch = [regex]::Match($testText, "(?m)^.\s*pass\s+(\d+)")
  $failMatch = [regex]::Match($testText, "(?m)^.\s*fail\s+(\d+)")
  $skipMatch = [regex]::Match($testText, "(?m)^.\s*skipped\s+(\d+)")
  $testDetail = if ($passMatch.Success) {
    "Aprovados $($passMatch.Groups[1].Value); falhas $($failMatch.Groups[1].Value); ignorados $($skipMatch.Groups[1].Value)."
  } else {
    "Execucao encerrada com codigo $testExit."
  }
  $testStatus = if (
    $testExit -eq 0 -and
    $passMatch.Success -and
    $failMatch.Success -and
    $skipMatch.Success -and
    [int]$failMatch.Groups[1].Value -eq 0 -and
    [int]$skipMatch.Groups[1].Value -eq 0
  ) { "OK" } else { "FALHA" }
  Add-Check "Suite automatizada" $testStatus $testDetail
}

if ($RunBuild -and $corepack) {
  $buildOutput = & $corepack.Source pnpm build 2>&1
  $buildExit = $LASTEXITCODE
  Add-Check "Build de producao" $(if ($buildExit -eq 0) { "OK" } else { "FALHA" }) `
    $(if ($buildExit -eq 0) { "Build concluido." } else { "Build falhou com codigo $buildExit." })
}

if ($RunAudit -and $corepack) {
  $auditOutput = & $corepack.Source pnpm audit --prod 2>&1
  $auditExit = $LASTEXITCODE
  $auditText = $auditOutput | Out-String
  $countMatch = [regex]::Match($auditText, "(?m)^(\d+) vulnerabilities found")
  $auditDetail = if ($auditExit -eq 0) {
    "Nenhuma vulnerabilidade de producao encontrada."
  } elseif ($countMatch.Success) {
    "$($countMatch.Groups[1].Value) vulnerabilidades encontradas; revise o relatorio do pnpm audit."
  } else {
    "Auditoria retornou codigo $auditExit."
  }
  Add-Check "Auditoria de dependencias" $(if ($auditExit -eq 0) { "OK" } else { "ALERTA" }) $auditDetail $false
}

$summary = [pscustomobject]@{
  GeradoEm = (Get-Date).ToString("s")
  Projeto = $projectDirectory
  Total = $results.Count
  Ok = @($results | Where-Object Status -eq "OK").Count
  Alertas = @($results | Where-Object Status -eq "ALERTA").Count
  Falhas = @($results | Where-Object Status -eq "FALHA").Count
  Informacoes = @($results | Where-Object Status -eq "INFO").Count
  ProntoParaTestes = @($results | Where-Object { $_.Obrigatorio -and $_.Status -eq "FALHA" }).Count -eq 0
}

if ($AsJson) {
  [pscustomobject]@{ Resumo = $summary; Verificacoes = $results } |
    ConvertTo-Json -Depth 5
}
else {
  Write-Host ""
  Write-Host "PRUMO - Status do ambiente de desenvolvimento" -ForegroundColor Cyan
  Write-Host ("=" * 58) -ForegroundColor DarkCyan
  foreach ($item in $results) {
    $color = switch ($item.Status) {
      "OK" { "Green" }
      "ALERTA" { "Yellow" }
      "FALHA" { "Red" }
      default { "Gray" }
    }
    Write-Host ("[{0,-6}] {1,-27} {2}" -f $item.Status, $item.Componente, $item.Detalhes) -ForegroundColor $color
  }
  Write-Host ("=" * 58) -ForegroundColor DarkCyan
  $readyText = if ($summary.ProntoParaTestes) { "SIM" } else { "NAO" }
  $readyColor = if ($summary.ProntoParaTestes) { "Green" } else { "Red" }
  Write-Host "Pronto para testes: $readyText" -ForegroundColor $readyColor
  Write-Host "OK: $($summary.Ok) | Alertas: $($summary.Alertas) | Falhas: $($summary.Falhas) | Informacoes: $($summary.Informacoes)"
}

if (-not $summary.ProntoParaTestes) { exit 1 }
exit 0
