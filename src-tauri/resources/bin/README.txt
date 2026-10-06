Place ffmpeg.exe, ffprobe.exe and yt-dlp.exe in this folder to bundle them with the installer.
The GitHub Actions workflow (.github/workflows/build-windows.yml) and scripts/fetch-tools.ps1 do this automatically.
If they are missing, AquaWall also looks in %APPDATA%\com.aquawall.desktop\bin and on PATH.
