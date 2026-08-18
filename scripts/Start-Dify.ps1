[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$dockerRoot = Join-Path $projectRoot '.runtime\dify\docker'
$composeFile = Join-Path $dockerRoot 'docker-compose.yaml'
$securityOverride = Join-Path $projectRoot 'docker\compose.local-security.yaml'

if (-not (Test-Path -LiteralPath $composeFile -PathType Leaf)) {
    throw 'Dify is not initialized. Run scripts\Initialize-Dify.ps1 first.'
}

if (-not (Test-Path -LiteralPath $securityOverride -PathType Leaf)) {
    throw "Local security override was not found: $securityOverride"
}

docker info *> $null
if ($LASTEXITCODE -ne 0) {
    throw 'Docker Engine is not running. Start Docker Desktop and try again.'
}

Push-Location $dockerRoot
try {
    docker compose -f $composeFile -f $securityOverride up -d
    if ($LASTEXITCODE -ne 0) {
        throw 'Docker Compose failed to start Dify.'
    }
    docker compose -f $composeFile -f $securityOverride ps
}
finally {
    Pop-Location
}

Write-Host 'Dify is starting with loopback-only host ports. Open http://127.0.0.1 after the containers become healthy.' -ForegroundColor Green
