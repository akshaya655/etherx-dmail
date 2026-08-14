$css = Get-Content "c:\etherx-dmail\frontend\src\app\globals.css" -Raw

# Remove the compose mobile header overrides
$css = $css -replace '(?s)\.compose-mobile-header\s*\{.*?\}(?=\s*\n\s*\.)', ''
$css = $css -replace '(?s)\.compose-desktop-controls\s*\{\s*display:\s*none\s*!important;\s*\}', ''

Set-Content "c:\etherx-dmail\frontend\src\app\globals.css" $css
