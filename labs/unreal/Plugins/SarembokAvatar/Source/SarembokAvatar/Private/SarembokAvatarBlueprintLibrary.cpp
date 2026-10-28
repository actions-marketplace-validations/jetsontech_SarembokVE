// ============================================================================
// Copyright (c) 2026 Timothy Hall Jr. / Jetsontech. All rights reserved.
//
// This source code is licensed under the Business Source License 1.1 (BSL).
// Commercial use, deployment in production environments, or redistribution 
// for profit is strictly prohibited without a valid commercial license.
//
// For commercial inquiries, licensing, or partnerships, contact the Licensor.
// ============================================================================

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

