param(
    [switch]$SkipInstall
)

# Starts the Vite dev server for the TypeRush client on port 5173.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not $SkipInstall) {
    Push-Location $root
    if (-not (Test-Path (Join-Path $root 'node_modules'))) {
        npm install --no-fund --no-audit
    }
    Pop-Location
}

Start-Process -FilePath 'npm.cmd' `
    -ArgumentList 'run', 'dev', '--', '--host' `
    -WorkingDirectory $root `
    -RedirectStandardOutput "$root\vite.log" `
    -RedirectStandardError "$root\vite.err.log" `
    -WindowStyle Hidden

$deadline = (Get-Date).AddSeconds(60)
while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 2
    try {
        $page = Invoke-WebRequest 'http://localhost:5173/' -TimeoutSec 3 -UseBasicParsing
        if ($page.StatusCode -eq 200) {
            Write-Output 'frontend up: http://localhost:5173'
            exit 0
        }
    } catch {
        # keep polling until vite answers
    }
}

Write-Output 'frontend did not answer in 60s; see frontend\vite.log'
exit 1