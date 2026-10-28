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
# Create-SarembokAvatarBlueprintLibrary.ps1
# Sarembok VE Avatar Blueprint Interface
# ============================================================

$ProjectRoot = "C:\Sarembok_VE"

$Path = Join-Path $ProjectRoot `
"Plugins\SarembokAvatar\Source\SarembokAvatar\Public\SarembokAvatarBlueprintLibrary.h"

$Dir = Split-Path $Path -Parent


if (!(Test-Path $Dir)) {
    New-Item `
        -ItemType Directory `
        -Path $Dir `
        -Force | Out-Null
}


$Content = @'
// ============================================================
// SarembokAvatarBlueprintLibrary.h
// Blueprint Interface Layer
// ============================================================

#pragma once

#include "Kismet/BlueprintFunctionLibrary.h"
#include "SarembokAvatarBlueprintLibrary.generated.h"


class USarembokAvatarComponent;


/**
 * Sarembok Avatar Blueprint Utilities
 */
UCLASS()
class SAREMBOKAVATAR_API USarembokAvatarBlueprintLibrary 
    : public UBlueprintFunctionLibrary
{

    GENERATED_BODY()


public:


    /**
     * Initialize Avatar Component
     */
    UFUNCTION(
        BlueprintCallable,
        Category="Sarembok|Avatar"
    )
    static void InitializeSarembokAvatar(
        USarembokAvatarComponent* Component
    );


    /**
     * Send speech command
     */
    UFUNCTION(
        BlueprintCallable,
        Category="Sarembok|Avatar"
    )
    static void AvatarSpeak(
        USarembokAvatarComponent* Component,
        FString Text
    );


};
'@


Set-Content `
    -Path $Path `
    -Value $Content `
    -Encoding UTF8


Write-Host ""
Write-Host "Created:"
Write-Host $Path
Write-Host ""