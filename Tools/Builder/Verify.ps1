# ============================================================================
# Copyright (c) 2026 Timothy Hall Jr. / Jetsontech. All rights reserved.
#
# This source code is licensed under the Business Source License 1.1 (BSL).
# Commercial use, deployment in production environments, or redistribution 
# for profit is strictly prohibited without a valid commercial license.
#
# For commercial inquiries, licensing, or partnerships, contact the Licensor.
# ============================================================================

$ROOT="C:\Sarembok_VE"

$files=@(
"Plugins\SarembokBridge\SarembokBridge.uplugin",
"Plugins\SarembokBridge\Source\SarembokBridge\SarembokBridge.Build.cs",
"Plugins\SarembokBridge\Source\SarembokBridge\Public\SarembokRuntimeManager.h",
"Plugins\SarembokBridge\Source\SarembokBridge\Private\SarembokBridge.cpp"
)

Write-Host ""
Write-Host "Sarembok Verification"
Write-Host ""

foreach($file in $files)
{
    $path=Join-Path $ROOT $file

    if(Test-Path $path)
    {
        Write-Host "[OK] $file"
    }
    else
    {
        Write-Host "[FAIL] $file"
    }
}
