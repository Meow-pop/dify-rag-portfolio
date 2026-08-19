[CmdletBinding()]
param(
    [string]$EmbeddingModel = 'qwen3-embedding:0.6b'
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$dockerRoot = Join-Path $projectRoot '.runtime\dify\docker'
$composeFile = Join-Path $dockerRoot 'docker-compose.yaml'
$securityOverride = Join-Path $projectRoot 'docker\compose.local-security.yaml'

foreach ($requiredFile in @($composeFile, $securityOverride)) {
    if (-not (Test-Path -LiteralPath $requiredFile -PathType Leaf)) {
        throw "Required file was not found: $requiredFile"
    }
}

docker version --format '{{.Server.Version}}' *> $null
if ($LASTEXITCODE -ne 0) {
    throw 'Docker Engine is not running.'
}

Push-Location $dockerRoot
try {
    docker compose -f $composeFile -f $securityOverride up -d ollama
    if ($LASTEXITCODE -ne 0) {
        throw 'Unable to start the Ollama container.'
    }

    docker compose -f $composeFile -f $securityOverride exec -T ollama ollama pull $EmbeddingModel
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to pull the Ollama embedding model '$EmbeddingModel'."
    }

    docker compose -f $composeFile -f $securityOverride exec -T ollama ollama show $EmbeddingModel *> $null
    if ($LASTEXITCODE -ne 0) {
        throw "Ollama did not report the expected model '$EmbeddingModel'."
    }
}
finally {
    Pop-Location
}

Write-Host "Ollama is ready with embedding model: $EmbeddingModel" -ForegroundColor Green
Write-Host 'Internal Dify base URL: http://ollama:11434' -ForegroundColor Green
