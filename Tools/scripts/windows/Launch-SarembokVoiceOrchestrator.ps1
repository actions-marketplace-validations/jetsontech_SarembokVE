<#
.SYNOPSIS
    [DEPRECATED] Launches the Sarembok Multi-Agent Voice Orchestrator Gateway.
    Please use: `node bin/sarembok-cli.js engine voice` or `npx sarembok engine voice`
#>
param(
    [int]$Port = 9001,
    [string]$Database = "sarembok_memory.db"
)

Write-Host "==============================================================================" -ForegroundColor Yellow
Write-Host "  [DEPRECATED] Launch-SarembokVoiceOrchestrator.ps1 is deprecated." -ForegroundColor Yellow
Write-Host "  Please use the unified cross-platform CLI:" -ForegroundColor Yellow
Write-Host "      node bin/sarembok-cli.js engine voice" -ForegroundColor Cyan
Write-Host "  or" -ForegroundColor Yellow
Write-Host "      npx sarembok engine voice" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Yellow

Push-Location $PSScriptRoot
try {
    node bin/sarembok-cli.js engine voice
}
finally {
    Pop-Location
}
