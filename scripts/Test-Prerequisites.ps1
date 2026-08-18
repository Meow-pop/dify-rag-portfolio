[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$failures = [System.Collections.Generic.List[string]]::new()

function Test-Command {
    param([Parameter(Mandatory)][string]$Name)

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        $failures.Add("Missing command: $Name")
        return $false
    }
    return $true
}

Write-Host 'Checking local prerequisites...'

$hasGit = Test-Command -Name 'git'
$hasDocker = Test-Command -Name 'docker'

if ($hasGit) {
    Write-Host "Git: $(git --version)"
}

if ($hasDocker) {
    Write-Host "Docker CLI: $(docker --version)"
    try {
        $serverVersion = docker info --format '{{.ServerVersion}}' 2>$null
        if (-not $serverVersion) {
            throw 'Docker Engine did not return a version.'
        }
        Write-Host "Docker Engine: $serverVersion"

        $composeVersion = docker compose version --short
        Write-Host "Docker Compose: $composeVersion"
    }
    catch {
        $failures.Add('Docker Desktop is installed but its engine is not running.')
    }
}

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$driveName = (Split-Path -Qualifier $projectRoot).TrimEnd(':')
$drive = Get-PSDrive -Name $driveName
$freeGb = [math]::Round($drive.Free / 1GB, 1)
Write-Host "Free disk space on $($drive.Name): $freeGb GB"

if ($freeGb -lt 20) {
    $failures.Add('Less than 20 GB of free disk space is available.')
}

if ($failures.Count -gt 0) {
    Write-Host ''
    Write-Host 'Prerequisite check failed:' -ForegroundColor Red
    $failures | ForEach-Object { Write-Host "- $_" -ForegroundColor Red }
    exit 1
}

Write-Host 'All prerequisite checks passed.' -ForegroundColor Green

