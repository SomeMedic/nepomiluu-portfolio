$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$destination = Join-Path $root 'assets/typography-study'
[IO.Directory]::CreateDirectory($destination) | Out-Null
$css = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'originals/typography-study.css'))
$urls = [regex]::Matches($css, 'url\((https://[^)]+)\)') | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique
$index = 0
foreach ($url in $urls) {
  $file = "candidate-$index.ttf"
  Invoke-WebRequest -Uri $url -OutFile (Join-Path $destination $file) -TimeoutSec 30
  $css = $css.Replace($url, "./$file")
  $index++
}
[IO.File]::WriteAllText((Join-Path $destination 'fonts.css'), $css)
$families = @('Prata', 'Playfair Display', 'Noto Serif Display', 'Old Standard TT', 'Cormorant Garamond', 'Times New Roman')
$html = '<!doctype html><html lang="ru"><meta charset="utf-8"><title>Typography study</title><link rel="stylesheet" href="../../apps/web/public/fonts/fonts.css"><link rel="stylesheet" href="./fonts.css"><style>body{background:#faf8f4;color:#1f1c19;margin:40px}section{border-top:1px solid #bd573c;padding:15px 0 30px}label{font:14px Arial}h1{font-size:150px;line-height:1.1;letter-spacing:-.05em;margin:10px 0}p{font-size:140px;line-height:1;font-style:italic;letter-spacing:-.055em;margin:0}a{font:16px Arial;margin-right:20px}</style><nav>'
foreach ($family in $families) { $html += "<a href='#$($family.Replace(' ', '-'))'>$family</a>" }
$html += '</nav>'
foreach ($family in $families) {
  $weight = if ($family -eq 'Prata') { '400' } else { '600' }
  $html += "<section id='$($family.Replace(' ', '-'))' style='font-family:`"$family`";font-weight:$weight'><label>$family · $weight</label><h1 style='font-weight:$weight'>Ульяна Непомилуева</h1><p style='font-weight:$weight'>Проектируем. Логика.</p></section>"
}
[IO.File]::WriteAllText((Join-Path $destination 'index.html'), $html + '</html>')
Write-Output "Font study downloaded: $index font files"
