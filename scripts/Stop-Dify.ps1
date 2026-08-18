[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$dockerRoot = Join-Path $projectRoot '.runtime\dify\docker'
$composeFile = Join-Path $dockerRoot 'docker-compose.yaml'

if (-not (Test-Path -LiteralPath $composeFile -PathType Leaf)) {
    throw 'Dify is not initialized.'
}

Push-Location $dockerRoot
try {
    docker compose stop
    if ($LASTEXITCODE -ne 0) {
        throw 'Docker Compose failed to stop Dify.'
    }
}
finally {
    Pop-Location
}

Write-Host 'Dify containers stopped. Persistent data was preserved.' -ForegroundColor Green

