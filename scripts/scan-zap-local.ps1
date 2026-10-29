param(
    [string]$Target = "http://127.0.0.1:5500/es/iniciar-sesion/"
)

$ErrorActionPreference = "Stop"

$targetUri = [Uri]$Target
$allowedHosts = @("127.0.0.1", "localhost", "::1")
if ($targetUri.Scheme -ne "http" -or $targetUri.Host -notin $allowedHosts) {
    throw "ZAP solo puede apuntar a un entorno HTTP local (127.0.0.1, localhost o ::1). Producción y hosts remotos están bloqueados por este script."
}

$zapCommand = Get-Command zap.bat -ErrorAction SilentlyContinue
if ($env:ZAP_PATH -and (Test-Path -LiteralPath $env:ZAP_PATH)) {
    $zapPath = $env:ZAP_PATH
} elseif ($zapCommand) {
    $zapPath = $zapCommand.Source
} else {
    $zapPath = @(
        "$env:ProgramFiles\ZAP\Zed Attack Proxy\zap.bat",
        "$env:ProgramFiles\OWASP\Zed Attack Proxy\zap.bat",
        "${env:ProgramFiles(x86)}\OWASP\Zed Attack Proxy\zap.bat"
    ) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}
if (-not $zapPath) {
    throw "No encuentro zap.bat. Instala la versión estable de ZAP o define ZAP_PATH."
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$reportRoot = Join-Path $repoRoot "artifacts/security/zap-local"
New-Item -ItemType Directory -Force -Path $reportRoot | Out-Null

$planPath = Join-Path $reportRoot "automation-plan.yaml"
$targetYaml = $targetUri.AbsoluteUri.TrimEnd('/')
$siteYaml = $targetUri.GetLeftPart([UriPartial]::Authority)
$plan = @"
env:
  contexts:
    - name: lixby-local
      urls:
        - "$targetYaml"
  parameters:
    failOnError: true
    failOnWarning: false
    continueOnFailure: false
    progressToStdout: true
jobs:
  - type: spider
    parameters:
      context: lixby-local
      url: "$targetYaml"
      maxDuration: 2
      maxDepth: 5
      maxChildren: 25
  - type: passiveScan-wait
    parameters:
      maxDuration: 3
  - type: report
    parameters:
      template: traditional-html
      reportDir: "$($reportRoot.Replace('\', '/'))"
      reportFile: zap-lixby-local.html
      reportTitle: Lixby local passive ZAP scan
      reportDescription: Passive-only baseline against a loopback test server.
      displayReport: false
    sites:
      - "$siteYaml"
  - type: exitStatus
    parameters:
      errorLevel: High
"@
Set-Content -LiteralPath $planPath -Value $plan -Encoding utf8

$probe = [System.Net.Http.HttpClient]::new()
try {
    $response = $probe.GetAsync($targetUri).GetAwaiter().GetResult()
    if (-not $response.IsSuccessStatusCode) {
        throw "El servidor local respondió $([int]$response.StatusCode); ZAP no se ejecutó."
    }
    if ($response.RequestMessage.RequestUri.Host -notin $allowedHosts) {
        throw "El destino redirigió fuera del entorno local; ZAP no se ejecutó."
    }
} finally {
    $probe.Dispose()
}

Push-Location (Split-Path -Parent $zapPath)
try {
    & $zapPath -cmd -autorun $planPath
    $zapExitCode = $LASTEXITCODE
} finally {
    Pop-Location
}
if ($zapExitCode -ne 0) {
    throw "ZAP terminó con código $zapExitCode. Revisa $reportRoot."
}
Write-Output "Informe ZAP local: $(Join-Path $reportRoot 'zap-lixby-local.html')"
