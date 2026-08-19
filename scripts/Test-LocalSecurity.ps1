[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$dockerRoot = Join-Path $projectRoot '.runtime\dify\docker'
$composeFile = Join-Path $dockerRoot 'docker-compose.yaml'
$securityOverride = Join-Path $projectRoot 'docker\compose.local-security.yaml'
$envFile = Join-Path $dockerRoot '.env'

foreach ($requiredFile in @($composeFile, $securityOverride, $envFile)) {
    if (-not (Test-Path -LiteralPath $requiredFile -PathType Leaf)) {
        throw "Required file was not found: $requiredFile"
    }
}

docker version --format '{{.Server.Version}}' *> $null
if ($LASTEXITCODE -ne 0) {
    throw 'Docker Engine is not running.'
}

$secretLine = Select-String -LiteralPath $envFile -Pattern '^SECRET_KEY=(.+)$' | Select-Object -First 1
if (-not $secretLine -or $secretLine.Matches[0].Groups[1].Value.Length -lt 32) {
    throw 'SECRET_KEY is missing or too short in the local Dify .env file.'
}
Write-Host '[PASS] A non-empty local SECRET_KEY is configured.' -ForegroundColor Green

$socketUrlLine = Select-String -LiteralPath $envFile -Pattern '^NEXT_PUBLIC_SOCKET_URL=(.+)$' | Select-Object -First 1
if (-not $socketUrlLine -or $socketUrlLine.Matches[0].Groups[1].Value -ne 'ws://127.0.0.1') {
    throw 'NEXT_PUBLIC_SOCKET_URL must be ws://127.0.0.1 to match the local console host.'
}
Write-Host '[PASS] The WebSocket URL matches the loopback console host.' -ForegroundColor Green

Push-Location $projectRoot
try {
    git check-ignore --quiet -- '.runtime/dify/docker/.env'
    if ($LASTEXITCODE -ne 0) {
        throw 'The local Dify .env file is not covered by .gitignore.'
    }

    $trackedEnv = git ls-files -- '.runtime/dify/docker/.env'
    if ($trackedEnv) {
        throw 'The local Dify .env file is tracked by Git.'
    }
}
finally {
    Pop-Location
}
Write-Host '[PASS] The local Dify .env file is ignored and untracked.' -ForegroundColor Green

Push-Location $dockerRoot
try {
    $expectedPorts = @{
        nginx = '80/tcp'
        plugin_daemon = '5003/tcp'
    }

    foreach ($service in $expectedPorts.Keys) {
        $containerId = docker compose -f $composeFile -f $securityOverride ps -q $service
        if ($LASTEXITCODE -ne 0 -or -not $containerId) {
            throw "The $service container is not running."
        }

        $bindingsJson = docker inspect --format '{{json .HostConfig.PortBindings}}' $containerId
        if ($LASTEXITCODE -ne 0 -or -not $bindingsJson) {
            throw "Unable to inspect host port bindings for $service."
        }

        $bindings = $bindingsJson | ConvertFrom-Json
        $publishedPorts = @($bindings.PSObject.Properties)
        if ($publishedPorts.Count -ne 1 -or $publishedPorts[0].Name -ne $expectedPorts[$service]) {
            throw "$service has unexpected published ports: $($publishedPorts.Name -join ', ')."
        }

        foreach ($port in $publishedPorts) {
            foreach ($binding in @($port.Value)) {
                if ($binding.HostIp -notin @('127.0.0.1', '::1')) {
                    throw "$service publishes $($port.Name) on unsafe host address '$($binding.HostIp)'."
                }
            }
        }
        Write-Host "[PASS] $service host ports are loopback-only." -ForegroundColor Green
    }

    $ollamaContainerId = docker compose -f $composeFile -f $securityOverride ps -q ollama
    if ($LASTEXITCODE -ne 0 -or -not $ollamaContainerId) {
        throw 'The ollama container is not running.'
    }

    $ollamaBindingsJson = docker inspect --format '{{json .HostConfig.PortBindings}}' $ollamaContainerId
    if ($LASTEXITCODE -ne 0 -or -not $ollamaBindingsJson) {
        throw 'Unable to inspect Ollama host port bindings.'
    }

    $ollamaBindings = $ollamaBindingsJson | ConvertFrom-Json
    if (@($ollamaBindings.PSObject.Properties).Count -ne 0) {
        throw "Ollama must not publish host ports: $(@($ollamaBindings.PSObject.Properties).Name -join ', ')."
    }
    Write-Host '[PASS] Ollama does not publish a host port.' -ForegroundColor Green

    docker compose -f $composeFile -f $securityOverride exec -T ollama ollama show qwen3-embedding:0.6b *> $null
    if ($LASTEXITCODE -ne 0) {
        throw 'The qwen3-embedding:0.6b model is not available in Ollama.'
    }
    Write-Host '[PASS] The local embedding model is available.' -ForegroundColor Green

    docker compose -f $composeFile -f $securityOverride exec -T api python -c "import urllib.request; urllib.request.urlopen('http://ollama:11434/api/tags', timeout=5).read()" *> $null
    if ($LASTEXITCODE -ne 0) {
        throw 'Dify API cannot reach Ollama on the internal Docker network.'
    }
    Write-Host '[PASS] Dify can reach Ollama on the internal Docker network.' -ForegroundColor Green
}
finally {
    Pop-Location
}

$response = Invoke-WebRequest -Uri 'http://127.0.0.1' -UseBasicParsing -TimeoutSec 20
if ($response.StatusCode -ne 200) {
    throw "Dify returned unexpected HTTP status $($response.StatusCode)."
}
Write-Host '[PASS] Dify is reachable at http://127.0.0.1 with HTTP 200.' -ForegroundColor Green
Write-Host 'Local access security checks passed.' -ForegroundColor Cyan
