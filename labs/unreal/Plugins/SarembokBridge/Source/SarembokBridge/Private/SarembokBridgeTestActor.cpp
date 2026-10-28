// ============================================================================
// Copyright (c) 2026 Timothy Hall Jr. / Jetsontech. All rights reserved.
//
// This source code is licensed under the Business Source License 1.1 (BSL).
// Commercial use, deployment in production environments, or redistribution 
// for profit is strictly prohibited without a valid commercial license.
//
// For commercial inquiries, licensing, or partnerships, contact the Licensor.
// ============================================================================

#include "SarembokBridgeTestActor.h"
#include "SarembokBridgeModule.h"

ASarembokBridgeTestActor::ASarembokBridgeTestActor()
{
    PrimaryActorTick.bCanEverTick = false;
    RootScene = CreateDefaultSubobject<USceneComponent>(TEXT("RootScene"));
    RootComponent = RootScene;
}

void ASarembokBridgeTestActor::BeginPlay()
{
    Super::BeginPlay();

    UE_LOG(LogTemp, Display, TEXT("SarembokBridgeTestActor has begun play."));
    UE_LOG(LogTemp, Display, TEXT("SarembokBridge module loaded: %s"), *FString(TEXT("true")));
}
