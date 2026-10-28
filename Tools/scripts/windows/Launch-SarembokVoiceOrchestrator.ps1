# ============================================================================
# Copyright (c) 2026 Timothy Hall Jr. / Jetsontech. All rights reserved.
#
# This source code is licensed under the Business Source License 1.1 (BSL).
# Commercial use, deployment in production environments, or redistribution 
# for profit is strictly prohibited without a valid commercial license.
#
# For commercial inquiries, licensing, or partnerships, contact the Licensor.
# ============================================================================

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
