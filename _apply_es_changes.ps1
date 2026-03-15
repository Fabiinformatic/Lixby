$root = "c:\\Users\\antho\\Lixby"
$esAboutPath = Join-Path $root "es\\pages\\about.html"
$esAbout = Get-Content -Raw -LiteralPath $esAboutPath
$animCssMatch = [regex]::Match($esAbout, '(?s)\.fade-scale\s*\{.*?\.stagger-item\s*\{.*?\}')
$animCss = if ($animCssMatch.Success) { $animCssMatch.Value } else { '' }
$animScriptMatch = [regex]::Match($esAbout, '(?s)<script>\s*const revealObserver[\s\S]*?</script>')
$animScript = if ($animScriptMatch.Success) { $animScriptMatch.Value } else { '' }

function Prefix-RelativePaths($html, $prefix) {
  if (-not $prefix) { return $html }
  $pattern = '(?<attr>href|src|action)="(?!https?:|mailto:|tel:|#|/)(?<url>[^"]+)"'
  $evaluator = { param($m) $m.Groups['attr'].Value + '="' + $prefix + $m.Groups['url'].Value + '"' }
  return [regex]::Replace($html, $pattern, $evaluator)
}

$langDirs = Get-ChildItem -Directory -Path $root | Where-Object { $_.Name -notin @('.git','node_modules','es') }

foreach ($langDir in $langDirs) {
  $indexPath = Join-Path $langDir.FullName 'index.html'
  if (-not (Test-Path $indexPath)) { continue }
  $index = Get-Content -Raw -LiteralPath $indexPath
  $headerMatch = [regex]::Match($index, '<header class="nav"[\s\S]*?</header>\s*<div class="nav-mobile-panel"[\s\S]*?</div>')
  $footerMatch = [regex]::Match($index, '<footer class="footer footer-mega"[\s\S]*?</footer>')
  if (-not $headerMatch.Success -or -not $footerMatch.Success) { continue }
  $header = $headerMatch.Value
  $footer = $footerMatch.Value

  foreach ($aboutPath in @((Join-Path $langDir.FullName 'about.html'), (Join-Path $langDir.FullName 'pages\\about.html'))) {
    if (-not (Test-Path $aboutPath)) { continue }
    $about = Get-Content -Raw -LiteralPath $aboutPath
    $depth = if ($aboutPath -like '*\\pages\\about.html') { 1 } else { 0 }
    $prefix = if ($depth -eq 1) { '../' } else { '' }

    $headerAdj = Prefix-RelativePaths $header $prefix
    $footerAdj = Prefix-RelativePaths $footer $prefix

    if ($about -notmatch 'id="scroll-progress"') {
      $about = $about -replace '<body>', "<body>`n  <div id=`"scroll-progress`"></div>"
    }

    $about = [regex]::Replace($about, '<header class="nav"[\s\S]*?</header>\s*<div class="nav-mobile-panel"[\s\S]*?</div>', '', 'Singleline')
    $about = [regex]::Replace($about, '<nav class="nav"[\s\S]*?</nav>', '', 'Singleline')
    $about = [regex]::Replace($about, '<div class="nav-mobile-panel"[\s\S]*?</div>', '', 'Singleline')

    $about = $about -replace '<div id="scroll-progress"></div>', "<div id=`"scroll-progress`"></div>`n`n  $headerAdj"

    $about = [regex]::Replace($about, '<footer class="footer[\s\S]*?</footer>', $footerAdj, 'Singleline')

    if ($animCss -and ($about -notmatch '\.fade-scale')) {
      $about = $about -replace '</style>', ($animCss + "`n  </style>")
    }

    if ($about -notmatch '--timeline-date-width') {
      $about = $about -replace '(?s)\.timeline\s*\{', ".timeline {`n      --timeline-date-width: 110px;`n      --timeline-gap: var(--spacing-8);`n      --timeline-dot: 16px;"
    }
    $about = [regex]::Replace($about, '(?s)\.timeline-container::before\s*\{.*?\}\s*', '')
    $about = [regex]::Replace($about, '(?s)\.timeline-item::before\s*\{.*?\}\s*', '')
    $about = [regex]::Replace($about, '(?s)\.timeline-item:last-child::before\s*\{.*?\}\s*', '')
    $about = $about -replace 'width:\s*100px;', 'width: var(--timeline-date-width);'
    $about = $about -replace 'padding-left:\s*var\(--spacing-8\);', 'padding-left: var(--timeline-gap);'
    $about = $about -replace 'width:\s*16px;', 'width: var(--timeline-dot);'
    $about = $about -replace 'height:\s*16px;', 'height: var(--timeline-dot);'
    $about = $about -replace 'left:\s*-20px;', 'left: calc(-1 * (var(--timeline-dot) / 2));'
    $about = $about -replace 'left:\s*calc\(-1 \* \(var\(--timeline-gap\) - \(var\(--timeline-dot\) / 2\)\)\);', 'left: calc(-1 * (var(--timeline-dot) / 2));'

    if ($animScript -and ($about -notmatch 'revealObserver')) {
      $scriptAdj = $animScript -replace '\.\./tienda\.html', ($prefix + 'tienda.html')
      if ($about -match '<script src="https://cdnjs\.cloudflare\.com/ajax/libs/gsap/3\.12\.2/gsap\.min\.js"></script>') {
        $about = [regex]::Replace($about, '<script src="https://cdnjs\.cloudflare\.com/ajax/libs/gsap/3\.12\.2/gsap\.min\.js"></script>', ($scriptAdj + "`n  <script src=`"https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js`"></script>"), 1)
      } else {
        $about = $about -replace '</body>', ($scriptAdj + "`n</body>")
      }
    }

    Set-Content -LiteralPath $aboutPath -Value $about -Encoding UTF8
  }

  $footerBlock = $footer
  $navMatch = [regex]::Match($index, '<nav class="nav-links"[\s\S]*?</nav>')
  if ($navMatch.Success) {
    $navBlock = $navMatch.Value
    $shopHref = [regex]::Match($navBlock, '<a href="([^"]+)">').Groups[1].Value
    if ($shopHref) {
      $footerBlock = [regex]::Replace($footerBlock, '<li><a href="#">', "<li><a href=`"$shopHref`">", 1)
    }
  }
  $footerBlock = $footerBlock -replace '<li><a href="#">Newsroom</a></li>', '<li><a href="about.html">Nosotros</a></li>'

  $index = [regex]::Replace($index, '<footer class="footer footer-mega"[\s\S]*?</footer>', $footerBlock, 'Singleline')
  Set-Content -LiteralPath $indexPath -Value $index -Encoding UTF8
}
