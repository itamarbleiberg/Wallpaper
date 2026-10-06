# Downloads ffmpeg/ffprobe (gyan.dev essentials build) and yt-dlp into
# src-tauri/resources/bin so they are bundled with the installer.
# Usage (from the repo root):  powershell -ExecutionPolicy Bypass -File scripts/fetch-tools.ps1
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$bin = Join-Path $PSScriptRoot "..\src-tauri\resources\bin"
New-Item -ItemType Directory -Force -Path $bin | Out-Null
$tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("aquawall-tools-" + [guid]::NewGuid())
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

try {
  if (-not (Test-Path (Join-Path $bin "yt-dlp.exe"))) {
    Write-Host "Downloading yt-dlp..."
    Invoke-WebRequest "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe" -OutFile (Join-Path $bin "yt-dlp.exe")
  }

  if (-not (Test-Path (Join-Path $bin "ffmpeg.exe"))) {
    Write-Host "Downloading ffmpeg..."
    $zip = Join-Path $tmp "ffmpeg.zip"
    Invoke-WebRequest "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip" -OutFile $zip
    Expand-Archive $zip -DestinationPath $tmp -Force
    $found = Get-ChildItem $tmp -Recurse -Filter "ffmpeg.exe" | Select-Object -First 1
    if (-not $found) { throw "ffmpeg.exe not found in archive" }
    Copy-Item $found.FullName $bin
    Copy-Item (Join-Path $found.DirectoryName "ffprobe.exe") $bin
  }
  Get-ChildItem $bin | Format-Table Name, Length
} finally {
  Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}
