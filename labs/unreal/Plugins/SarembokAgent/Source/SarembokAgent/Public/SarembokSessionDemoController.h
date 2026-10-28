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
// SarembokSessionDemoController.h
// Multi-Session Persistent Continuity Demonstration Harness Actor
// ============================================================

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "SarembokSessionDemoController.generated.h"

UCLASS(ClassGroup=(Sarembok), meta=(BlueprintSpawnableComponent))
class SAREMBOKAGENT_API ASarembokSessionDemoController : public AActor
{
    GENERATED_BODY()

public:

    ASarembokSessionDemoController();

    virtual void BeginPlay() override;

    UFUNCTION(BlueprintCallable, Category="Sarembok|SessionDemo")
    void TriggerSession1_FirstContact();

    UFUNCTION(BlueprintCallable, Category="Sarembok|SessionDemo")
    void TriggerSession2_ReturnVisit();

    UFUNCTION(BlueprintCallable, Category="Sarembok|SessionDemo")
    void TriggerSession3_Contradiction();

    UFUNCTION(BlueprintCallable, Category="Sarembok|SessionDemo")
    void TriggerSession4_LongTermGoal();

    UFUNCTION(BlueprintCallable, Category="Sarembok|SessionDemo")
    void TriggerSession5_ResilienceFallback();
};
