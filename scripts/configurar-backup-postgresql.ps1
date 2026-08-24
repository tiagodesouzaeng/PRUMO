[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$statusFile = Join-Path $env:TEMP "prumo-backup-config-status.json"
$stage = "inicio"
$pointer = [IntPtr]::Zero
Remove-Item -LiteralPath $statusFile -ErrorAction SilentlyContinue

function Find-PostgresTool([string]$Name) {
  $command = Get-Command "$Name.exe" -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  $candidate = Get-ChildItem "C:\Program Files\PostgreSQL" -Recurse -Filter "$Name.exe" -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending |
    Select-Object -First 1 -ExpandProperty FullName
  if (-not $candidate) { throw "$Name não foi localizado." }
  return $candidate
}

function Invoke-Psql([string]$Database, [string]$Sql, [switch]$Scalar) {
  $arguments = @(
    "-X", "-w", "-h", "127.0.0.1", "-U", $script:AdminUser,
    "-d", $Database, "-v", "ON_ERROR_STOP=1"
  )
  if ($Scalar) { $arguments += @("-At") }
  $arguments += @("-c", $Sql)
  $output = & $script:Psql @arguments 2>&1
  if ($LASTEXITCODE -ne 0) { throw ($output -join [Environment]::NewLine) }
  return $output
}

$migrationUrl = [Environment]::GetEnvironmentVariable("PRUMO_MIGRATION_DATABASE_URL", "User")
if (-not $migrationUrl) {
  throw "PRUMO_MIGRATION_DATABASE_URL não está configurada para o usuário atual."
}

$script:Psql = Find-PostgresTool "psql"

try {
  $stage = "credencial administrativa"
  $credential = Get-Credential -UserName "postgres" -Message "Informe a senha administrativa criada na instalação do PostgreSQL. Ela será usada somente nesta execução."
  if (-not $credential) { throw "A solicitação de credencial foi cancelada." }
  $script:AdminUser = $credential.UserName
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($credential.Password)
  $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)

  $stage = "validação da conta postgres"
  $identity = Invoke-Psql "postgres" "select current_user || '|' || rolsuper || '|' || rolcreatedb || '|' || rolcreaterole from pg_roles where rolname=current_user;" -Scalar
  $identityLine = [string]($identity | Select-Object -First 1)
  $parts = $identityLine.Split("|")
  $adminFlags = $parts | Select-Object -Skip 1 -First 3
  if ($parts.Count -lt 4 -or ($adminFlags | Where-Object { $_ -notin @("t", "true") }).Count -gt 0) {
    throw "A identidade informada não possui os privilégios administrativos necessários."
  }

  $stage = "geração da credencial de backup"
  $random = New-Object byte[] 36
  $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $generator.GetBytes($random) } finally { $generator.Dispose() }
  $backupPassword = [Convert]::ToBase64String($random).Replace("+", "A").Replace("/", "B").TrimEnd("=")

  $stage = "criação da role prumo_backup"
  $roleExists = Invoke-Psql "postgres" "select 1 from pg_roles where rolname='prumo_backup';" -Scalar
  if ($roleExists -contains "1") {
    Invoke-Psql "postgres" "alter role prumo_backup with login nosuperuser nocreatedb nocreaterole noinherit noreplication bypassrls password '$backupPassword';" | Out-Null
  }
  else {
    Invoke-Psql "postgres" "create role prumo_backup with login nosuperuser nocreatedb nocreaterole noinherit noreplication bypassrls password '$backupPassword';" | Out-Null
  }

  $stage = "concessão de leitura para backup"
  Invoke-Psql "prumo" @"
grant connect on database prumo to prumo_backup;
grant usage on schema app, public to prumo_backup;
grant select on all tables in schema app, public to prumo_backup;
grant select on all sequences in schema app, public to prumo_backup;
alter default privileges for role prumo_migrator in schema app grant select on tables to prumo_backup;
alter default privileges for role prumo_migrator in schema app grant select on sequences to prumo_backup;
"@ | Out-Null

  $stage = "criação do banco descartável"
  $restoreDatabase = "prumo_restauracao_teste"
  $restoreExists = Invoke-Psql "postgres" "select 1 from pg_database where datname='$restoreDatabase';" -Scalar
  if ($restoreExists -notcontains "1") {
    Invoke-Psql "postgres" "create database $restoreDatabase owner prumo_migrator template template0 encoding 'UTF8';" | Out-Null
  }

  $stage = "gravação das URLs operacionais"
  $source = [Uri]$migrationUrl
  $port = if ($source.IsDefaultPort) { 5432 } else { $source.Port }
  $backupUrl = "postgresql://prumo_backup:$backupPassword@127.0.0.1:$port/prumo"
  $restoreUrl = "postgresql://$($source.UserInfo)@127.0.0.1:$port/$restoreDatabase"
  [Environment]::SetEnvironmentVariable("PRUMO_BACKUP_DATABASE_URL", $backupUrl, "User")
  [Environment]::SetEnvironmentVariable("PRUMO_RESTORE_TEST_DATABASE_URL", $restoreUrl, "User")

  $stage = "teste final da role de backup"
  $env:PGUSER = "prumo_backup"
  $env:PGPASSWORD = $backupPassword
  $probe = & $script:Psql -X -w -h 127.0.0.1 -p $port -U prumo_backup -d prumo -At -c "select count(*) from app.tenants;" 2>&1
  if ($LASTEXITCODE -ne 0) { throw "A role foi criada, mas a leitura protegida de teste falhou." }

  @{ ok = $true; etapa = "concluída" } | ConvertTo-Json | Set-Content -LiteralPath $statusFile -Encoding UTF8
  Write-Host ""
  Write-Host "Configuração concluída." -ForegroundColor Green
  Write-Host "- role dedicada prumo_backup pronta"
  Write-Host "- banco descartável $restoreDatabase pronto"
  Write-Host "- URLs operacionais salvas no ambiente do usuário sem exibir credenciais"
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
  Remove-Item Env:PGUSER -ErrorAction SilentlyContinue
  if ($pointer -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  }
}
