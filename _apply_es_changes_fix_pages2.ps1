$root = "c:\\Users\\antho\\Lixby"
$langDirs = Get-ChildItem -Directory -Path $root | Where-Object { $_.Name -notin @('.git','node_modules','es') }

function Prefix-RelativePaths($html, $prefix) {
  $pattern = '(?<attr>href|src|action)="(?!https?:|mailto:|tel:|#|/)(?<url>[^"]+)"'
  $evaluator = { param($m) $m.Groups['attr'].Value + '="' + $prefix + $m.Groups['url'].Value + '"' }
  return [regex]::Replace($html, $pattern, $evaluator)
}

$single = [System.Text.RegularExpressions.RegexOptions]::Singleline

foreach ($langDir in $langDirs) {
  $indexPath = Join-Path $langDir.FullName 'index.html'
  if (-not (Test-Path $indexPath)) { continue }
  $index = Get-Content -Raw -LiteralPath $indexPath
  $header = [regex]::Match($index, '<header class="nav"[\s\S]*?</header>\s*<div class="nav-mobile-panel"[\s\S]*?</div>').Value
  $footer = [regex]::Match($index, '<footer class="footer footer-mega"[\s\S]*?</footer>').Value
  if (-not $header -or -not $footer) { continue }

  $navBlock = [regex]::Match($index, '<nav class="nav-links"[\s\S]*?</nav>').Value
  $shopHref = ''
  if ($navBlock) { $shopHref = [regex]::Match($navBlock, '<a href="([^"]+)">').Groups[1].Value }
  if (-not $shopHref) { continue }

  $aboutPath = Join-Path $langDir.FullName 'pages\\about.html'
  if (-not (Test-Path $aboutPath)) { continue }

  $prefix = '../'
  $headerAdj = Prefix-RelativePaths $header $prefix
  $footerAdj = Prefix-RelativePaths $footer $prefix

  $headerAdj = $headerAdj -replace 'href="#productos"', ('href="' + $prefix + 'index.html#productos"')
  $headerAdj = $headerAdj -replace 'href="#apps"', ('href="' + $prefix + 'index.html#apps"')
  $footerAdj = $footerAdj -replace 'href="#apps"', ('href="' + $prefix + 'index.html#apps"')

  $shopHrefAdj = $prefix + $shopHref
  $footerAdj = [regex]::Replace($footerAdj, '<li><a href="#">', "<li><a href=`"$shopHrefAdj`">", 1)
  $footerAdj = $footerAdj -replace '<li><a href="#">Newsroom</a></li>', '<li><a href="about.html">Nosotros</a></li>'

  $about = Get-Content -Raw -LiteralPath $aboutPath
  $about = [regex]::Replace($about, '<header class="nav"[\s\S]*?</header>\s*<div class="nav-mobile-panel"[\s\S]*?</div>', $headerAdj, $single)
  $about = [regex]::Replace($about, '<footer class="footer[\s\S]*?</footer>', $footerAdj, $single)
  $about = $about -replace 'tienda\.html', $shopHrefAdj

  Set-Content -LiteralPath $aboutPath -Value $about -Encoding UTF8
}
