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
// SarembokHardeningDemoController.h
// Cognitive Platform Hardening Harness Actor (Checks 201 to 225)
// ============================================================

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "SarembokHardeningDemoController.generated.h"

UCLASS(ClassGroup=(Sarembok), meta=(BlueprintSpawnableComponent))
class SAREMBOKCORE_API ASarembokHardeningDemoController : public AActor
{
    GENERATED_BODY()

public:
    ASarembokHardeningDemoController();

    virtual void BeginPlay() override;

    UFUNCTION(BlueprintCallable, Category="Sarembok|HardeningDemo")
    void TriggerHardeningTest_201_205();

    UFUNCTION(BlueprintCallable, Category="Sarembok|HardeningDemo")
    void TriggerHardeningTest_206_210();

    UFUNCTION(BlueprintCallable, Category="Sarembok|HardeningDemo")
    void TriggerHardeningTest_211_215();

    UFUNCTION(BlueprintCallable, Category="Sarembok|HardeningDemo")
    void TriggerHardeningTest_216_220();

    UFUNCTION(BlueprintCallable, Category="Sarembok|HardeningDemo")
    void TriggerHardeningTest_221_225();
};
