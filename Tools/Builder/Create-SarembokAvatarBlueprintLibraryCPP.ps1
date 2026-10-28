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
# Create-SarembokAvatarBlueprintLibraryCPP.ps1
# Sarembok VE Blueprint Runtime Interface
# ============================================================

$ProjectRoot = "C:\Sarembok_VE"

$Path = Join-Path $ProjectRoot `
"Plugins\SarembokAvatar\Source\SarembokAvatar\Private\SarembokAvatarBlueprintLibrary.cpp"

$Dir = Split-Path $Path -Parent


if (!(Test-Path $Dir)) {
    New-Item `
        -ItemType Directory `
        -Path $Dir `
        -Force | Out-Null
}


$Content = @'
// ============================================================
// SarembokAvatarBlueprintLibrary.cpp
// ============================================================

#include "SarembokAvatarBlueprintLibrary.h"
#include "SarembokAvatarComponent.h"



void USarembokAvatarBlueprintLibrary::InitializeSarembokAvatar(
    USarembokAvatarComponent* Component
)
{
    if (Component)
    {
        Component->InitializeAvatar();
    }
}



void USarembokAvatarBlueprintLibrary::AvatarSpeak(
    USarembokAvatarComponent* Component,
    FString Text
)
{
    if (Component)
    {
        Component->Speak(Text);
    }
}

'@


Set-Content `
    -Path $Path `
    -Value $Content `
    -Encoding UTF8


Write-Host ""
Write-Host "Created:"
Write-Host $Path
Write-Host ""