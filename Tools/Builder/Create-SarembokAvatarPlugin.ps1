# ============================================================================
# Copyright (c) 2026 Timothy Hall Jr. / Jetsontech. All rights reserved.
#
# This source code is licensed under the Business Source License 1.1 (BSL).
# Commercial use, deployment in production environments, or redistribution 
# for profit is strictly prohibited without a valid commercial license.
#
# For commercial inquiries, licensing, or partnerships, contact the Licensor.
# ============================================================================

# ============================================================
# Create-SarembokAvatarPlugin.ps1
# Sarembok VE Avatar Unreal Plugin Descriptor
# ============================================================

$ProjectRoot = "C:\Sarembok_VE"

$PluginPath = Join-Path $ProjectRoot `
"Plugins\SarembokAvatar\SarembokAvatar.uplugin"


$PluginDirectory = Split-Path $PluginPath -Parent


if (!(Test-Path $PluginDirectory)) {
    New-Item `
        -ItemType Directory `
        -Path $PluginDirectory `
        -Force | Out-Null
}


$Plugin = @'
{
    "FileVersion": 3,
    "Version": 1,
    "VersionName": "0.1",
    "FriendlyName": "Sarembok Avatar",
    "Description": "Sarembok Autonomous AI Digital Human Avatar Runtime",
    "Category": "Sarembok AI",
    "CreatedBy": "Sarembok",
    "CanContainContent": true,
    "EnabledByDefault": true,

    "Modules":
    [
        {
            "Name": "SarembokAvatar",
            "Type": "Runtime",
            "LoadingPhase": "Default"
        }
    ]
}
'@


Set-Content `
    -Path $PluginPath `
    -Value $Plugin `
    -Encoding UTF8


Write-Host ""
Write-Host "Created:"
Write-Host $PluginPath
Write-Host ""