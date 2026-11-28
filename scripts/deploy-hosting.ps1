#Requires -Version 5.1
$ErrorActionPreference = 'Stop'

# pnpm v11 reenvia el separador "--" literalmente; se ignora antes de leer los modos.
$modes = @($args | Where-Object { $_ -ne '--' })
$SetupToken = $modes -contains '-SetupToken'
$CheckOnly = $modes -contains '-CheckOnly'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Project    = 'lixby0'
$Origin     = 'https://lixby.es'
$ConfigDir  = Join-Path $env:APPDATA 'Lixby'
$ConfigFile = Join-Path $ConfigDir 'deploy-hosting.config'

function Protect-Secret {
    param([string]$Value)
    $secure = ConvertTo-SecureString -String $Value -AsPlainText -Force
    ConvertFrom-SecureString -SecureString $secure
}

function Unprotect-Secret {
    param([string]$Value)
    $secure = ConvertTo-SecureString -String $Value -ErrorAction Stop
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

function Read-SecretValue {
    param([string]$Prompt)
    $secure = Read-Host -AsSecureString $Prompt
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

# ----------Configuración cifrada del token (DPAPI, usuario actual) ---------- */
if ($SetupToken) {
    New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null
    $zoneId = Read-SecretValue 'Zone ID de Cloudflare (lixby.es):'
    $apiToken = Read-SecretValue 'API token (Zone -> Cache Purge -> Purge):'
    if ([string]::IsNullOrWhiteSpace($zoneId) -or [string]::IsNullOrWhiteSpace($apiToken)) {
        throw 'Zone ID y token son obligatorios.'
    }
    $lines = @(
        '# Configuracion cifrada de Lixby (DPAPI, solo el usuario actual)',
        (Protect-Secret $zoneId),
        (Protect-Secret $apiToken)
    )
    Set-Content -Path $ConfigFile -Value $lines -Encoding ASCII
    $user = [Security.Principal.WindowsIdentity]::GetCurrent().Name
    & icacls $ConfigFile /inheritance:r /grant "`"$user`":F" | Out-Null
    Write-Host "Guardado cifrado en: $ConfigFile"
    Write-Host 'Aviso: cualquier programa que corra con tu usuario puede leerlo. Usa un token con permiso minimo y caducidad.'
    return
}

# ----------Comprobación en vivo de rutas internas ---------- */
if ($CheckOnly) {
    $paths = @(
        '/.env', '/.env.local', '/.env.production', '/.env.example',
        '/.git/HEAD', '/.git/config', '/.git/index', '/.git/objects/',
        '/server.js', '/functions/', '/functions/index.js', '/functions/package.json',
        '/functions/.env', '/firebase.json', '/firestore.rules', '/firestore.indexes.json',
        '/package.json', '/pnpm-lock.yaml', '/pnpm-workspace.yaml', '/.gitleaksignore',
        '/.gitignore', '/.firebaserc', '/.npmrc', '/.git-credentials',
        '/scripts/', '/tests/', '/src/', '/node_modules/', '/docs/', '/security/',
        '/.github/', '/.config/', '/.stripe/', '/.agents/', '/.continue/',
        '/.firebase/', '/artifacts/', '/secrets/', '/.cache/',
        '/admin', '/admin.html', '/nota.txt', '/SECURITY.md', '/gitleaks-report.json',
        '/npm-debug.log', '/.DS_Store', '/Thumbs.db'
    )

    function Get-ProbeResult {
        param([int]$Code, [string]$FinalPath, [string]$ContentType, [long]$Length, [string]$Body)
        if ($FinalPath -match '/404(?:\.html)?/?$') { return 'BLOQUEADO (404)' }
        if ($Code -ge 200 -and $Code -lt 300) {
            if ($ContentType -like 'text/html*' -and $Length -gt 20000) {
                return "200 HTML (pagina, no archivo; $Length B)"
            }
            return "EXPUESTO (200, $ContentType, $Length B)"
        }
        if ($Code -eq 401) { return 'BLOQUEADO (401)' }
        if ($Code -eq 403) { return 'BLOQUEADO (403)' }
        if ($Code -eq 404) { return 'BLOQUEADO (404)' }
        if ($Code -ge 300 -and $Code -lt 400) { return "REDIRECCION ($Code -> $FinalPath)" }
        return "ERROR ($Code)"
    }

    $results = @()
    foreach ($path in $paths) {
        try {
            $response = Invoke-WebRequest -Uri ($Origin + $path) -UseBasicParsing `
                -TimeoutSec 20 -MaximumRedirection 5 -ErrorAction Stop
            $code = [int]$response.StatusCode
            $finalPath = $response.BaseResponse.ResponseUri.AbsolutePath
            $contentType = [string]$response.Headers['Content-Type']
            $length = [long]$response.Content.Length
            $result = Get-ProbeResult $code $finalPath $contentType $length $response.Content
        }
        catch {
            $resp = $_.Exception.Response
            if ($null -ne $resp) {
                $code = [int]$resp.StatusCode
                $finalPath = $resp.ResponseUri.AbsolutePath
                $result = Get-ProbeResult $code $finalPath '' 0 ''
            }
            else { $result = 'SIN RESPUESTA' }
        }
        $results += [pscustomobject]@{ Ruta = $path; Resultado = $result }
    }
    $results | Format-Table -AutoSize | Out-String -Width 200 | Write-Output
    return
}

# ----------Despliegue ---------- */
$branch = (& git rev-parse --abbrev-ref HEAD).Trim()
if ($branch -ne 'main') { throw "Se requiere la rama main (actual: $branch)." }

$dirty = @(& git status --porcelain)
if ($dirty.Count -gt 0) { throw 'El arbol de trabajo no esta limpio.' }

& git fetch origin main --quiet
if ($LASTEXITCODE -ne 0) { throw 'No se pudo actualizar origin/main.' }
$head = (& git rev-parse HEAD).Trim()
$remote = (& git rev-parse origin/main).Trim()
if ($head -ne $remote) { throw 'main no esta al dia con origin/main.' }

$confirm = Read-Host 'Escribe DESPLEGAR para publicar en lixby.es'
if ($confirm -ne 'DESPLEGAR') { Write-Host 'Cancelado.'; return }

if (-not $env:GOOGLE_APPLICATION_CREDENTIALS) {
    $adcDir = Join-Path $env:APPDATA 'firebase'
    $adc = Get-ChildItem -Path $adcDir -Filter '*application_default_credentials.json' `
        -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -ne $adc) { $env:GOOGLE_APPLICATION_CREDENTIALS = $adc.FullName }
}

& firebase deploy --only hosting --project $Project
if ($LASTEXITCODE -ne 0) { throw 'firebase deploy fallo; no se ejecuto la purga.' }

& git checkout -- .firebase/hosting..cache functions/community-layouts.json `
    sitemap.xml functions/generated/sitemap.xml 2>$null

if (Test-Path $ConfigFile) {
    try {
        $lines = @(Get-Content $ConfigFile | Where-Object { $_ -and -not $_.StartsWith('#') })
        $zoneId = Unprotect-Secret $lines[0]
        $tokenValue = Unprotect-Secret $lines[1]
        $headers = @{ Authorization = "Bearer $tokenValue"; 'Content-Type' = 'application/json' }
        $purge = Invoke-RestMethod -Method Post `
            -Uri "https://api.cloudflare.com/client/v4/zones/$zoneId/purge_cache" `
            -Headers $headers -Body '{"purge_everything":true}' -TimeoutSec 30
        if ($purge.success) { Write-Host 'Cloudflare: purga de cache solicitada.' }
        else { Write-Host 'Cloudflare: la purga devolvio un error (revisar token).' }
    }
    catch { Write-Host "Cloudflare: no se pudo purgar (revisar token): $($_.Exception.Message)" }
}
else {
    Write-Host 'Cloudflare: sin token configurado; purga manual requerida.'
}

foreach ($path in @('/', '/es/', '/fi/')) {
    try {
        $r = Invoke-WebRequest -Uri ($Origin + $path) -Method Head -UseBasicParsing -TimeoutSec 20
        Write-Host "$path -> $([int]$r.StatusCode)"
    }
    catch { Write-Host "$path -> sin respuesta" }
}
