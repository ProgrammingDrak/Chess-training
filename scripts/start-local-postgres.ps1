param(
  [string]$DataDir = ".local-postgres/data",
  [int]$Port = 55432,
  [string]$Username = "postgres"
)

$ErrorActionPreference = "Stop"

function Resolve-RepoPath([string]$Path) {
  if ([System.IO.Path]::IsPathRooted($Path)) {
    return $Path
  }
  return Join-Path (Get-Location) $Path
}

function Require-Command([string]$Name) {
  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $command) {
    throw "Missing PostgreSQL command '$Name'. Install PostgreSQL client/server tools and make sure '$Name' is on PATH."
  }
  return $command.Source
}

$pgCtl = Require-Command "pg_ctl"
$pgIsReady = Require-Command "pg_isready"
$initDb = Require-Command "initdb"

$resolvedDataDir = Resolve-RepoPath $DataDir
$localRoot = Split-Path $resolvedDataDir -Parent
$logFile = Join-Path $localRoot "postgres.log"

New-Item -ItemType Directory -Force -Path $localRoot | Out-Null

if (-not (Test-Path (Join-Path $resolvedDataDir "PG_VERSION"))) {
  Write-Host "Initializing local Postgres data directory at $resolvedDataDir"
  & $initDb -D $resolvedDataDir -U $Username --auth=trust --encoding=UTF8 --locale=C
}

& $pgIsReady -h 127.0.0.1 -p $Port -U $Username | Out-Null
if ($LASTEXITCODE -eq 0) {
  Write-Host "Local Postgres is already running on 127.0.0.1:$Port"
  exit 0
}

Write-Host "Starting local Postgres on 127.0.0.1:$Port"
& $pgCtl -D $resolvedDataDir -l $logFile -o "-p $Port -c listen_addresses=127.0.0.1" start
if ($LASTEXITCODE -ne 0) {
  throw "Failed to start local Postgres. Check $logFile for details."
}

& $pgIsReady -h 127.0.0.1 -p $Port -U $Username | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "Local Postgres did not become ready on 127.0.0.1:$Port."
}

Write-Host "Local Postgres is ready on 127.0.0.1:$Port"
