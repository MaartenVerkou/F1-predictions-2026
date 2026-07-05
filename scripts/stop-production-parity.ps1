[CmdletBinding()]
param(
    [switch]$RemoveVolumes
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot

function Invoke-Checked {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)

    & docker @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "docker $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
    }
}

Push-Location $repoRoot
try {
    $downArgs = @("compose", "--profile", "edge", "down", "--remove-orphans")
    if ($RemoveVolumes) {
        $downArgs += "-v"
    }

    Invoke-Checked -Arguments $downArgs
    Write-Host "Production-parity stack stopped."
    if (-not $RemoveVolumes) {
        Write-Host "Volumes were preserved. Add -RemoveVolumes only when local Docker data is disposable."
    }
}
finally {
    Pop-Location
}
