[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$statusFile = Join-Path $env:TEMP "prumo-devops-config-status.json"
$stage = "início"
$pointer = [IntPtr]::Zero
Remove-Item -LiteralPath $statusFile -ErrorAction SilentlyContinue

function Find-Psql {
  $command = Get-Command "psql.exe" -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  $candidate = Get-ChildItem "C:\Program Files\PostgreSQL" -Recurse -Filter "psql.exe" -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending |
    Select-Object -First 1 -ExpandProperty FullName
  if (-not $candidate) { throw "psql não foi localizado." }
  return $candidate
}

function Invoke-Psql(
  [string]$User,
  [string]$Password,
  [string]$Database,
  [string]$Sql,
  [switch]$Scalar
) {
  $previousPassword = $env:PGPASSWORD
  try {
    $env:PGPASSWORD = $Password
    $arguments = @(
      "-X", "-w", "-h", "127.0.0.1", "-p", $script:Port,
      "-U", $User, "-d", $Database, "-v", "ON_ERROR_STOP=1"
    )
    if ($Scalar) { $arguments += "-At" }
    $arguments += @("-c", $Sql)
    $previousErrorAction = $ErrorActionPreference
    try {
      $ErrorActionPreference = "Continue"
      $output = & $script:Psql @arguments 2>&1
      $exitCode = $LASTEXITCODE
    }
    finally {
      $ErrorActionPreference = $previousErrorAction
    }
    if ($exitCode -ne 0) { throw ($output -join [Environment]::NewLine) }
    return $output
  }
  finally {
    if ($null -eq $previousPassword) {
      Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    }
    else {
      $env:PGPASSWORD = $previousPassword
    }
  }
}

$migrationUrl = [Environment]::GetEnvironmentVariable("PRUMO_MIGRATION_DATABASE_URL", "User")
if (-not $migrationUrl) { throw "PRUMO_MIGRATION_DATABASE_URL não está configurada." }
$migrationUri = [Uri]$migrationUrl
$script:Port = if ($migrationUri.IsDefaultPort) { "5432" } else { [string]$migrationUri.Port }
$script:Psql = Find-Psql

try {
  $stage = "credencial administrativa"
  $credential = Get-Credential -UserName "postgres" -Message "Última autorização: informe a senha do postgres para criar a conta local de automação. A senha não será gravada."
  if (-not $credential) { throw "A solicitação foi cancelada." }
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($credential.Password)
  $adminPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  $adminUser = $credential.UserName

  $stage = "validação da conta postgres"
  $identity = Invoke-Psql $adminUser $adminPassword "postgres" `
    "select rolsuper::text || '|' || rolcreatedb::text || '|' || rolcreaterole::text from pg_roles where rolname=current_user;" -Scalar
  $flags = ([string]($identity | Select-Object -First 1)).Split("|")
  if ($flags.Count -ne 3 -or ($flags | Where-Object { $_ -notin @("t", "true") }).Count -gt 0) {
    throw "A conta informada não possui os privilégios administrativos necessários."
  }

  $stage = "geração da credencial operacional"
  $random = New-Object byte[] 36
  $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $generator.GetBytes($random) } finally { $generator.Dispose() }
  $devopsPassword = [Convert]::ToBase64String($random).Replace("+", "A").Replace("/", "B").TrimEnd("=")

  $stage = "criação da role prumo_devops"
  $exists = Invoke-Psql $adminUser $adminPassword "postgres" `
    "select 1 from pg_roles where rolname='prumo_devops';" -Scalar
  if ($exists -contains "1") {
    Invoke-Psql $adminUser $adminPassword "postgres" `
      "alter role prumo_devops with login nosuperuser createdb createrole inherit noreplication nobypassrls connection limit 5 password '$devopsPassword';" | Out-Null
  }
  else {
    Invoke-Psql $adminUser $adminPassword "postgres" `
      "create role prumo_devops with login nosuperuser createdb createrole inherit noreplication nobypassrls connection limit 5 password '$devopsPassword';" | Out-Null
  }
  Invoke-Psql $adminUser $adminPassword "postgres" @"
grant pg_monitor to prumo_devops;
grant connect on database postgres to prumo_devops;
grant connect on database prumo to prumo_devops;
comment on role prumo_devops is 'Automação local do desenvolvimento PRUMO; sem SUPERUSER e sem BYPASSRLS';
"@ | Out-Null

  $stage = "teste de criação de role"
  $probeRole = "prumo_probe_$([Guid]::NewGuid().ToString('N').Substring(0, 12))"
  Invoke-Psql "prumo_devops" $devopsPassword "postgres" `
    "create role $probeRole nologin; drop role $probeRole;" | Out-Null

  $stage = "teste de criação de banco"
  $probeDatabase = "prumo_probe_$([Guid]::NewGuid().ToString('N').Substring(0, 12))"
  Invoke-Psql "prumo_devops" $devopsPassword "postgres" `
    "create database $probeDatabase;" | Out-Null
  Invoke-Psql "prumo_devops" $devopsPassword "postgres" `
    "drop database $probeDatabase with (force);" | Out-Null

  $stage = "gravação da URL operacional"
  $adminUrl = "postgresql://prumo_devops:$devopsPassword@127.0.0.1:$($script:Port)/postgres"
  [Environment]::SetEnvironmentVariable("PRUMO_ADMIN_DATABASE_URL", $adminUrl, "User")

  @{ ok = $true; etapa = "concluída" } |
    ConvertTo-Json | Set-Content -LiteralPath $statusFile -Encoding UTF8
  Write-Host ""
  Write-Host "Configuração concluída." -ForegroundColor Green
  Write-Host "- prumo_devops pode criar bancos e roles locais"
  Write-Host "- SUPERUSER: não"
  Write-Host "- BYPASSRLS: não"
  Write-Host "- credencial operacional salva sem exibir a senha"
}
catch {
  $safeMessage = [string]$_.Exception.Message
  $safeMessage = $safeMessage -replace "(?i)(password\s+')[^']+(')", '$1***$2'
  @{ ok = $false; etapa = $stage; mensagem = $safeMessage } |
    ConvertTo-Json | Set-Content -LiteralPath $statusFile -Encoding UTF8
  Write-Error "Falha na etapa '$stage': $safeMessage"
}
finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  if ($pointer -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  }
}
