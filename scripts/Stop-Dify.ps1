[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$dockerRoot = Join-Path $projectRoot '.runtime\dify\docker'
$composeFile = Join-Path $dockerRoot 'docker-compose.yaml'
$securityOverride = Join-Path $projectRoot 'docker\compose.local-security.yaml'

if (-not (Test-Path -LiteralPath $composeFile -PathType Leaf)) {
    throw 'Dify is not initialized.'
}

if (-not (Test-Path -LiteralPath $securityOverride -PathType Leaf)) {
    throw "Local security override was not found: $securityOverride"
}

Push-Location $dockerRoot
try {
    docker compose -f $composeFile -f $securityOverride stop
    if ($LASTEXITCODE -ne 0) {
        throw 'Docker Compose failed to stop Dify.'
    }
}
finally {
    Pop-Location
}

Write-Host 'Dify containers stopped. Persistent data was preserved.' -ForegroundColor Green
