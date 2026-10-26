# One-command verification for Windows PowerShell. Run from the project root:
#   .\verify.ps1                      (offline checks: tests + frontend build)
#   .\verify.ps1 -Live -Food meal.jpg -Freshness fruit.jpg -Kitchen kitchen.jpg
# Writes docs\test-evidence.txt (no secrets are printed or saved).
param([switch]$Live, [string]$Food, [string]$Freshness, [string]$Kitchen)
$ErrorActionPreference = 'Continue'
$root = $PSScriptRoot
$evidence = Join-Path $root 'docs\test-evidence.txt'
$failed = @()
function Step($name, [scriptblock]$block) {
    "`n=== $name ===" | Tee-Object -FilePath $evidence -Append
    & $block 2>&1 | Tee-Object -FilePath $evidence -Append
    if ($LASTEXITCODE -ne 0) { $script:failed += $name; "RESULT: FAIL ($name)" | Tee-Object -FilePath $evidence -Append }
    else { "RESULT: PASS ($name)" | Tee-Object -FilePath $evidence -Append }
}
"Food Verse AI verification - $(Get-Date -Format s)" | Set-Content $evidence
$py = Join-Path $root 'backend\venv\Scripts\python.exe'
if (-not (Test-Path $py)) { Write-Host "Create the venv first (see README)."; exit 2 }

Push-Location (Join-Path $root 'backend')
Step 'Backend unit tests' { & $py -m unittest discover -s tests -v }
if ($Live) {
    $liveArgs = @('live_check.py', '--all')
    if ($Food) { $liveArgs += @('--food', $Food) }
    if ($Freshness) { $liveArgs += @('--freshness', $Freshness) }
    if ($Kitchen) { $liveArgs += @('--kitchen', $Kitchen) }
    Step 'Live Gemini check' { & $py @liveArgs }
}
Pop-Location

Push-Location (Join-Path $root 'frontend')
Step 'Frontend install' { npm install }
Step 'Frontend production build' { npm run build }
Pop-Location

"`n=== SUMMARY ===" | Tee-Object -FilePath $evidence -Append
if ($failed.Count -eq 0) { "ALL REQUESTED STEPS PASSED" | Tee-Object -FilePath $evidence -Append; exit 0 }
else { "FAILED: $($failed -join ', ')" | Tee-Object -FilePath $evidence -Append; exit 1 }
