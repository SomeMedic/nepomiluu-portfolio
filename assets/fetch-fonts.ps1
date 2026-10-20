$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$fontsDirectory = Join-Path $projectRoot 'apps/web/public/fonts'
$originalCss = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'originals/google-fonts.css') -Raw
$blocks = [regex]::Matches($originalCss, '(?s)/\* ([\w-]+) \*/\s*(@font-face\s*\{.*?\})')
$keptBlocks = [System.Collections.Generic.List[string]]::new()
$manifest = [System.Collections.Generic.List[object]]::new()
foreach ($block in $blocks) {
    $subset = $block.Groups[1].Value
    if ($subset -notin @('cyrillic-ext', 'cyrillic', 'latin-ext', 'latin')) { continue }
    $declaration = $block.Groups[2].Value
    $family = [regex]::Match($declaration, "font-family: '([^']+)'").Groups[1].Value
    $style = [regex]::Match($declaration, 'font-style: (\w+)').Groups[1].Value
    $weight = [regex]::Match($declaration, 'font-weight: (\d+)').Groups[1].Value
    $remoteUrl = [regex]::Match($declaration, 'url\(([^)]+)\)').Groups[1].Value
    $familySlug = $family.ToLowerInvariant().Replace(' ', '-')
    $fileName = "$familySlug-$style-$subset.woff2"
    $destination = Join-Path $fontsDirectory $fileName
    if (-not (Test-Path -LiteralPath $destination)) {
        Invoke-WebRequest -Uri $remoteUrl -OutFile $destination -TimeoutSec 30
    }
    $keptBlocks.Add("/* $subset */`n" + $declaration.Replace($remoteUrl, "/fonts/$fileName"))
    $manifest.Add([pscustomobject]@{family = $family; style = $style; weight = [int]$weight; subset = $subset; path = "/fonts/$fileName"; source = $remoteUrl})
}
[IO.File]::WriteAllText((Join-Path $fontsDirectory 'fonts.css'), (($keptBlocks -join "`n`n") + "`n"), [Text.UTF8Encoding]::new($false))
$manifest | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $fontsDirectory 'manifest.json') -Encoding utf8
foreach ($fontFamily in @('cormorantgaramond', 'inter')) {
    Invoke-WebRequest -Uri "https://raw.githubusercontent.com/google/fonts/main/ofl/$fontFamily/OFL.txt" -OutFile (Join-Path $fontsDirectory "$fontFamily-OFL.txt") -TimeoutSec 30
}
Get-ChildItem -LiteralPath $fontsDirectory | Select-Object Name, Length
