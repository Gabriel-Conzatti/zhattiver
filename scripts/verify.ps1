[CmdletBinding()]
param(
    [switch]$SkipFrontend,
    [switch]$SkipCompose
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot

function Invoke-External {
    param(
        [string]$Description,
        [scriptblock]$Command
    )

    Write-Host "[verify] $Description"
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "Falha: $Description"
    }
}

Push-Location (Join-Path $repoRoot "backend")
try {
    Invoke-External "lint backend" { & .\.venv\Scripts\ruff.exe check . }
    Invoke-External "pytest backend" { & .\.venv\Scripts\python.exe -m pytest }
} finally {
    Pop-Location
}

if (-not $SkipFrontend) {
    Push-Location (Join-Path $repoRoot "frontend")
    try {
        Invoke-External "lint frontend" { & npm run lint }
        Invoke-External "typecheck frontend" { & npm run typecheck }
        Invoke-External "testes frontend" { & npm run test }
        Invoke-External "build frontend" { & npm run build }
    } finally {
        Pop-Location
    }
}

if (-not $SkipCompose) {
    $envPath = Join-Path $repoRoot ".env"
    $createdExampleEnv = -not (Test-Path $envPath)
    if ($createdExampleEnv) {
        Copy-Item (Join-Path $repoRoot ".env.example") $envPath
    }

    Push-Location $repoRoot
    try {
        Invoke-External "Compose de produção" { & docker compose config --quiet }
        Invoke-External "Compose de desenvolvimento" {
            & docker compose -f compose.yaml -f compose.dev.yaml config --quiet
        }
    } finally {
        Pop-Location
        if ($createdExampleEnv) {
            Remove-Item $envPath -Force
        }
    }
}

Write-Host "[verify] validação concluída"
