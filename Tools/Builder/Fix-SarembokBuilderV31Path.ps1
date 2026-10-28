# ============================================================================
# Copyright (c) 2026 Timothy Hall Jr. / Jetsontech. All rights reserved.
#
# This source code is licensed under the Business Source License 1.1 (BSL).
# Commercial use, deployment in production environments, or redistribution 
# for profit is strictly prohibited without a valid commercial license.
#
# For commercial inquiries, licensing, or partnerships, contact the Licensor.
# ============================================================================

# ==========================================================
# Sarembok Builder v3.1 Path Fix
# ==========================================================

$FILE="C:\Sarembok_VE\Tools\Builder\Upgrade-SarembokBuilderV31.ps1"


$content = Get-Content $FILE -Raw


$content =
$content.Replace(
'$builder="$BUILDER\SarembokBuilder.ps1"',
'$builder="$BUILDER"'
)


$content =
$content.Replace(
'"$builder\SarembokBuilder.ps1"',
'"$BUILDER\SarembokBuilder.ps1"'
)


Set-Content `
$FILE `
$content `
-Encoding UTF8


Write-Host ""
Write-Host "Builder v3.1 path fixed"