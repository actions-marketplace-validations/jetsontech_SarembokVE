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

$folders=@(
"$ROOT\Intermediate",
"$ROOT\Saved"
)

foreach($folder in $folders)
{
    if(Test-Path $folder)
    {
        Remove-Item `
        $folder `
        -Recurse `
        -Force
    }
}

Write-Host "Sarembok clean complete"
