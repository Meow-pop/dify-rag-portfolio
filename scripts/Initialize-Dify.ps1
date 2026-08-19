[CmdletBinding()]
param(
    [string]$DifyRef = '1.16.1'
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$runtimeRoot = Join-Path $projectRoot '.runtime'
$difyRoot = Join-Path $runtimeRoot 'dify'

if (Test-Path -LiteralPath $difyRoot) {
    $gitMetadata = Join-Path $difyRoot '.git'
    if (-not (Test-Path -LiteralPath $gitMetadata)) {
        throw "An incomplete runtime directory exists: $difyRoot. Inspect it before retrying."
    }

    Write-Host "Dify runtime already exists: $difyRoot"
    Write-Host 'No files were overwritten.'
    exit 0
}

New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null

Write-Host "Cloning Dify $DifyRef..."
git clone --depth 1 --branch $DifyRef https://github.com/langgenius/dify.git $difyRoot
if ($LASTEXITCODE -ne 0) {
    throw 'Unable to clone the pinned Dify release.'
}

$dockerRoot = Join-Path $difyRoot 'docker'
$envExample = Join-Path $dockerRoot '.env.example'
$envFile = Join-Path $dockerRoot '.env'

if (-not (Test-Path -LiteralPath $envExample -PathType Leaf)) {
    throw "Dify environment template was not found: $envExample"
}

Copy-Item -LiteralPath $envExample -Destination $envFile
$envContent = Get-Content -LiteralPath $envFile -Raw
$envContent = $envContent -replace '(?m)^NEXT_PUBLIC_SOCKET_URL=.*$', 'NEXT_PUBLIC_SOCKET_URL=ws://127.0.0.1'
Set-Content -LiteralPath $envFile -Value $envContent -NoNewline
Write-Host "Created local Dify configuration: $envFile"
Write-Host 'Initialization complete. Review the local .env before exposing any service.' -ForegroundColor Green
