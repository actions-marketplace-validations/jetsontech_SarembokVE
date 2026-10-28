// ============================================================================
// Copyright (c) 2026 Timothy Hall Jr. / Jetsontech. All rights reserved.
//
// This source code is licensed under the Business Source License 1.1 (BSL).
// Commercial use, deployment in production environments, or redistribution 
// for profit is strictly prohibited without a valid commercial license.
//
// For commercial inquiries, licensing, or partnerships, contact the Licensor.
// ============================================================================

#include "SarembokAutonomousLoop.h"

void USarembokAutonomousLoop::StartCycle(const FString& InputContext)
{
    CurrentContext = InputContext;

    CurrentState = ESarembokLoopState::Perceiving;
    UE_LOG(LogTemp, Log, TEXT("Sarembok Loop: Perceiving - %s"), *CurrentContext);

    CurrentState = ESarembokLoopState::Planning;
    UE_LOG(LogTemp, Log, TEXT("Sarembok Loop: Planning"));

    CurrentState = ESarembokLoopState::Acting;
    UE_LOG(LogTemp, Log, TEXT("Sarembok Loop: Acting"));

    CurrentState = ESarembokLoopState::Responding;
    UE_LOG(LogTemp, Log, TEXT("Sarembok Loop: Responding"));

    CurrentState = ESarembokLoopState::Idle;
}

ESarembokLoopState USarembokAutonomousLoop::GetLoopState() const
{
    return CurrentState;
}
