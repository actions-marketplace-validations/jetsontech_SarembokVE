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
// SarembokRealtimeDemoController.h
// Real-Time Cognitive Interaction Harness Actor (Checks 116 to 140)
// ============================================================

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "SarembokRealtimeDemoController.generated.h"

UCLASS(ClassGroup=(Sarembok), meta=(BlueprintSpawnableComponent))
class SAREMBOKAGENT_API ASarembokRealtimeDemoController : public AActor
{
    GENERATED_BODY()

public:

    ASarembokRealtimeDemoController();

    virtual void BeginPlay() override;

    UFUNCTION(BlueprintCallable, Category="Sarembok|RealtimeDemo")
    void TriggerRealtimeTest_116_120();

    UFUNCTION(BlueprintCallable, Category="Sarembok|RealtimeDemo")
    void TriggerRealtimeTest_121_125();

    UFUNCTION(BlueprintCallable, Category="Sarembok|RealtimeDemo")
    void TriggerRealtimeTest_126_130();

    UFUNCTION(BlueprintCallable, Category="Sarembok|RealtimeDemo")
    void TriggerRealtimeTest_131_135();

    UFUNCTION(BlueprintCallable, Category="Sarembok|RealtimeDemo")
    void TriggerRealtimeTest_136_140();
};
