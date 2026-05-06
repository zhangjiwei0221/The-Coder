$ErrorActionPreference = "SilentlyContinue"

$projectRoot = Split-Path -Parent $PSScriptRoot
$url = "http://127.0.0.1:4173/"
$nodePath = "D:\nodejs\node.exe"
$serverPath = Join-Path $projectRoot "preview-server.js"

$listener = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort 4173 -State Listen
if (-not $listener) {
  Start-Process -FilePath $nodePath -ArgumentList "`"$serverPath`"" -WorkingDirectory $projectRoot -WindowStyle Hidden
  Start-Sleep -Milliseconds 800
}

Add-Type -AssemblyName System.Windows.Forms
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$width = [Math]::Max(760, [Math]::Floor($screen.Width * 0.45))
$height = $screen.Height
$x = $screen.Right - $width
$y = $screen.Top

$edge = (Get-Command msedge).Source
$chrome = (Get-Command chrome).Source

if ($edge) {
  Start-Process -FilePath $edge -ArgumentList "--app=$url --window-size=$width,$height --window-position=$x,$y"
} elseif ($chrome) {
  Start-Process -FilePath $chrome -ArgumentList "--app=$url --window-size=$width,$height --window-position=$x,$y"
} else {
  Start-Process $url
}
