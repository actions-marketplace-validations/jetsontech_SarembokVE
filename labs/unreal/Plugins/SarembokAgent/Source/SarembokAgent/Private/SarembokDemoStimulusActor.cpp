// ============================================================================
// Copyright (c) 2026 Timothy Hall Jr. / Jetsontech. All rights reserved.
//
// This source code is licensed under the Business Source License 1.1 (BSL).
// Commercial use, deployment in production environments, or redistribution 
// for profit is strictly prohibited without a valid commercial license.
//
// For commercial inquiries, licensing, or partnerships, contact the Licensor.
// ============================================================================

#include "SarembokDemoStimulusActor.h"

ASarembokDemoStimulusActor::ASarembokDemoStimulusActor()
{
    PrimaryActorTick.bCanEverTick = false;
    Tags.Add(FName("SarembokDemoStimulusActor"));
}

void ASarembokDemoStimulusActor::BeginPlay()
{
    Super::BeginPlay();
    UE_LOG(LogTemp, Display, TEXT("[SAREMBOK][DEMO] STIMULUS_ACTOR_SPAWNED Actor=SarembokDemoStimulusActor"));
}
