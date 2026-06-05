param(
    [string]$Password = "postgres",
    [string]$Database = "stockinsight",
    [string]$User = "postgres",
    [int]$Port = 5432,
    [switch]$ResetPassword
)

$ErrorActionPreference = "Stop"
$psql = "C:\Program Files\PostgreSQL\16\bin\psql.exe"
$hba = "C:\Program Files\PostgreSQL\16\data\pg_hba.conf"
$bak = "$hba.bak-trading-helper-setup"
$service = "postgresql-x64-16"

if (-not (Test-Path $psql)) {
    throw "psql not found at $psql"
}

function Invoke-Psql([string]$Sql) {
    & $psql -U $User -h 127.0.0.1 -p $Port -d postgres -v ON_ERROR_STOP=1 -c $Sql
    if ($LASTEXITCODE -ne 0) { throw "psql failed: $Sql" }
}

# Already configured?
$prevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$env:PGPASSWORD = $Password
& $psql -U $User -h 127.0.0.1 -p $Port -d postgres -tAc "SELECT 1" 2>$null | Out-Null
$authOk = ($LASTEXITCODE -eq 0)
$ErrorActionPreference = $prevEap

if ($authOk) {
    Write-Host "Password already works for user '$User'."
} elseif (-not $ResetPassword) {
    Write-Host "Authentication failed. Either:"
    Write-Host "  1) Re-run with your real password:  .\scripts\setup-postgres.ps1 -Password 'YOUR_PASSWORD'"
    Write-Host "  2) Reset to 'postgres' (Admin PS):  .\scripts\setup-postgres.ps1 -ResetPassword"
    exit 1
} else {
    if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        Write-Host "Password reset requires Administrator PowerShell."
        exit 1
    }
    Write-Host "Resetting PostgreSQL password via temporary trust auth..."
    Copy-Item $hba $bak -Force
    $trust = @(
        "",
        "# trading-helper setup (temporary)",
        "host    all             all             127.0.0.1/32            trust",
        "host    all             all             ::1/128                 trust"
    )
    $original = Get-Content $hba
    [System.IO.File]::WriteAllLines($hba, ($trust + $original))
    Restart-Service $service
    Start-Sleep -Seconds 2

    Invoke-Psql "ALTER USER $User WITH PASSWORD '$Password';"

    Copy-Item $bak $hba -Force
    Remove-Item $bak -Force
    Restart-Service $service
    Start-Sleep -Seconds 2
    Write-Host "Password reset complete."
}

$env:PGPASSWORD = $Password
$dbExists = & $psql -U $User -h 127.0.0.1 -p $Port -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$Database'"
if ($dbExists -ne "1") {
    Invoke-Psql "CREATE DATABASE $Database;"
    Write-Host "Database '$Database' created."
} else {
    Write-Host "Database '$Database' already exists."
}

Write-Host "Done. Use DATABASE_URL=postgresql+asyncpg://${User}:${Password}@localhost:${Port}/${Database}"
Write-Host "Then apply schema:  poetry run alembic upgrade head"
