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
# Create-SarembokAvatarBuildCS.ps1
# Sarembok VE Avatar Module Definition
# ============================================================

$ProjectRoot = "C:\Sarembok_VE"

$BuildPath = Join-Path $ProjectRoot `
"Plugins\SarembokAvatar\Source\SarembokAvatar\SarembokAvatar.Build.cs"


$Directory = Split-Path $BuildPath -Parent


if (!(Test-Path $Directory)) {
    New-Item `
        -ItemType Directory `
        -Path $Directory `
        -Force | Out-Null
}


$Content = @'
using UnrealBuildTool;

public class SarembokAvatar : ModuleRules
{
    public SarembokAvatar(
        ReadOnlyTargetRules Target
    ) : base(Target)
    {

        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;


        PublicDependencyModuleNames.AddRange(
            new string[]
            {
                "Core",
                "CoreUObject",
                "Engine"
            }
        );


        PrivateDependencyModuleNames.AddRange(
            new string[]
            {

            }
        );


    }
}
'@


Set-Content `
    -Path $BuildPath `
    -Value $Content `
    -Encoding UTF8


Write-Host ""
Write-Host "Created:"
Write-Host $BuildPath
Write-Host ""