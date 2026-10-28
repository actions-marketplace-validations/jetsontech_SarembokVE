// ============================================================================
// Copyright (c) 2026 Timothy Hall Jr. / Jetsontech. All rights reserved.
//
// This source code is licensed under the Business Source License 1.1 (BSL).
// Commercial use, deployment in production environments, or redistribution 
// for profit is strictly prohibited without a valid commercial license.
//
// For commercial inquiries, licensing, or partnerships, contact the Licensor.
// ============================================================================

#include "SarembokRuntimeSubsystem.h"
#include "SarembokBridgeService.h"

void USarembokRuntimeSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
    Super::Initialize(Collection);

    bInitialized = true;

    UE_LOG(LogTemp, Display, TEXT("[SAREMBOK] Bridge initialized"));

    FSarembokBridgeService::Get().Initialize();

    UE_LOG(LogTemp, Display, TEXT("[SAREMBOK] Runtime world available"));
}

void USarembokRuntimeSubsystem::Deinitialize()
{
    FSarembokBridgeService::Get().Shutdown();

    bInitialized = false;

    UE_LOG(LogTemp, Display, TEXT("[SAREMBOK] Runtime Subsystem Shutdown"));

    Super::Deinitialize();
}

void USarembokRuntimeSubsystem::Speak(const FString& Message)
{
    UE_LOG(LogTemp, Display, TEXT("[SAREMBOK] Speak: %s"), *Message);
    OnSpeak.Broadcast(Message);
}

void USarembokRuntimeSubsystem::SetEmotion(const FString& Emotion)
{
    UE_LOG(LogTemp, Display, TEXT("[SAREMBOK] Emotion: %s"), *Emotion);
    OnEmotionSet.Broadcast(Emotion);
}

void USarembokRuntimeSubsystem::Observe(const FString& Target)
{
    UE_LOG(LogTemp, Display, TEXT("[SAREMBOK] Observe: %s"), *Target);
    OnObserve.Broadcast(Target);
}
