[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$dockerRoot = Join-Path $projectRoot '.runtime\dify\docker'
$composeFile = Join-Path $dockerRoot 'docker-compose.yaml'

if (-not (Test-Path -LiteralPath $composeFile -PathType Leaf)) {
    throw 'Dify is not initialized. Run scripts\Initialize-Dify.ps1 first.'
}

docker info *> $null
if ($LASTEXITCODE -ne 0) {
    throw 'Docker Engine is not running. Start Docker Desktop and try again.'
}

Push-Location $dockerRoot
try {
    docker compose up -d
    if ($LASTEXITCODE -ne 0) {
        throw 'Docker Compose failed to start Dify.'
    }
    docker compose ps
}
finally {
    Pop-Location
}

Write-Host 'Dify is starting. Open http://localhost after the containers become healthy.' -ForegroundColor Green

