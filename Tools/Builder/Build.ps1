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

$UE=Get-ChildItem `
"C:\Program Files\Epic Games" `
-Recurse `
-Filter Build.bat `
-ErrorAction SilentlyContinue |
Where-Object {
    $_.FullName -match "UE_5"
} |
Select-Object -First 1


if($null -eq $UE)
{
    throw "Unreal Engine Build.bat not found"
}


& $UE.FullName `
SarembokVEEditor `
Win64 `
Development `
"$ROOT\SarembokVE.uproject"
