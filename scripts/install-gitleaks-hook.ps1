$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (-not (Get-Command gitleaks -ErrorAction SilentlyContinue)) {
    throw "Gitleaks no está instalado. Instálalo y vuelve a ejecutar este script."
}

git -C $repoRoot config --local core.hooksPath .githooks
if ($LASTEXITCODE -ne 0) {
    throw "No se pudo activar core.hooksPath para este repositorio."
}

Write-Output "Hook de Gitleaks activado en este repositorio (.githooks/pre-commit)."
