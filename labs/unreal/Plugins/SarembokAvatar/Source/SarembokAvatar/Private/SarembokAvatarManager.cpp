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
// SarembokAvatarManager.cpp
// Sarembok Autonomous AI Virtual Entity Platform
// ============================================================

#include "SarembokAvatarManager.h"


USarembokAvatarManager::USarembokAvatarManager()
{
    CurrentState = ESarembokAvatarState::Uninitialized;
}



void USarembokAvatarManager::InitializeAvatar()
{
    CurrentState = ESarembokAvatarState::Ready;

    UE_LOG(
        LogTemp,
        Display,
        TEXT("Sarembok Avatar Initialized")
    );
}



void USarembokAvatarManager::ShutdownAvatar()
{
    CurrentState = ESarembokAvatarState::Disabled;

    UE_LOG(
        LogTemp,
        Display,
        TEXT("Sarembok Avatar Shutdown")
    );
}



void USarembokAvatarManager::SetAvatarState(
    ESarembokAvatarState NewState
)
{
    CurrentState = NewState;
}



ESarembokAvatarState 
USarembokAvatarManager::GetAvatarState() const
{
    return CurrentState;
}



void USarembokAvatarManager::TriggerExpression(
    FString ExpressionName
)
{
    UE_LOG(
        LogTemp,
        Display,
        TEXT("Avatar Expression: %s"),
        *ExpressionName
    );
}



void USarembokAvatarManager::SynchronizeVoice(
    FString AudioReference
)
{
    CurrentState = ESarembokAvatarState::Speaking;

    UE_LOG(
        LogTemp,
        Display,
        TEXT("Voice Sync: %s"),
        *AudioReference
    );
}

