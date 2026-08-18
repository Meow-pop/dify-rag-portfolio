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

docker info *> $null
if ($LASTEXITCODE -ne 0) {
    throw 'Docker Engine is not running.'
}

$secretLine = Select-String -LiteralPath $envFile -Pattern '^SECRET_KEY=(.+)$' | Select-Object -First 1
if (-not $secretLine -or $secretLine.Matches[0].Groups[1].Value.Length -lt 32) {
    throw 'SECRET_KEY is missing or too short in the local Dify .env file.'
}
Write-Host '[PASS] A non-empty local SECRET_KEY is configured.' -ForegroundColor Green

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
