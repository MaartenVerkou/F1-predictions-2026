[CmdletBinding()]
param(
    [switch]$WithEdge,
    [switch]$NoBuild,
    [int]$TimeoutSeconds = 90
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$previousEnv = @{}

function Set-ScopedEnv {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$Value,
        [switch]$OnlyIfMissing
    )

    if ($OnlyIfMissing -and -not [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($Name, "Process"))) {
        return
    }

    if (-not $previousEnv.ContainsKey($Name)) {
        $previousEnv[$Name] = [Environment]::GetEnvironmentVariable($Name, "Process")
    }

    [Environment]::SetEnvironmentVariable($Name, $Value, "Process")
}

function Restore-ScopedEnv {
    foreach ($entry in $previousEnv.GetEnumerator()) {
        [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, "Process")
    }
}

function Invoke-Checked {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)

    & docker @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "docker $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
    }
}

function Get-AppUrl {
    param([Parameter(Mandatory = $true)][string[]]$ComposeArgs)

    $published = & docker @($ComposeArgs + @("port", "app", "3000")) 2>$null | Select-Object -First 1
    if ($published -match ":(\d+)$") {
        return "http://127.0.0.1:$($Matches[1])"
    }

    return "http://127.0.0.1:3000"
}

function Wait-ForHealth {
    param(
        [Parameter(Mandatory = $true)][string]$HealthUrl,
        [Parameter(Mandatory = $true)][int]$Timeout
    )

    $deadline = (Get-Date).AddSeconds($Timeout)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 5
            if ($response.StatusCode -eq 200) {
                return
            }
        }
        catch {
            Start-Sleep -Seconds 2
            continue
        }

        Start-Sleep -Seconds 2
    }

    throw "Timed out waiting for $HealthUrl"
}

Push-Location $repoRoot
try {
    Set-ScopedEnv -Name "NODE_ENV" -Value "production"
    Set-ScopedEnv -Name "DEV_AUTO_LOGIN" -Value "0"
    Set-ScopedEnv -Name "ACTUALS_AUTO_UPDATE_ENABLED" -Value "0" -OnlyIfMissing

    Invoke-Checked -Arguments @("version")

    $composeArgs = @("compose")
    if ($WithEdge) {
        $composeArgs += @("--profile", "edge")
    }

    Invoke-Checked -Arguments ($composeArgs + @("config", "-q"))

    $upArgs = $composeArgs + @("up", "-d")
    if (-not $NoBuild) {
        $upArgs += "--build"
    }
    if (-not $WithEdge) {
        $upArgs += "app"
    }

    Invoke-Checked -Arguments $upArgs

    $appUrl = Get-AppUrl -ComposeArgs $composeArgs
    Wait-ForHealth -HealthUrl "$appUrl/healthz" -Timeout $TimeoutSeconds

    Write-Host "Production-parity stack is running."
    Write-Host "App: $appUrl"
    Write-Host "Health: $appUrl/healthz"
    Write-Host "Stop: powershell -ExecutionPolicy Bypass -File scripts/stop-production-parity.ps1"
}
finally {
    Restore-ScopedEnv
    Pop-Location
}
