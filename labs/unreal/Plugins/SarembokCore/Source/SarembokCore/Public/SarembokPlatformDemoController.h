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
// SarembokPlatformDemoController.h
// Cognitive Platform Harness Actor (Checks 166 to 200)
// ============================================================

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "SarembokPlatformDemoController.generated.h"

UCLASS(ClassGroup=(Sarembok), meta=(BlueprintSpawnableComponent))
class SAREMBOKCORE_API ASarembokPlatformDemoController : public AActor
{
    GENERATED_BODY()

public:
    ASarembokPlatformDemoController();

    virtual void BeginPlay() override;

    UFUNCTION(BlueprintCallable, Category="Sarembok|PlatformDemo")
    void TriggerPlatformTest_166_170();

    UFUNCTION(BlueprintCallable, Category="Sarembok|PlatformDemo")
    void TriggerPlatformTest_171_175();

    UFUNCTION(BlueprintCallable, Category="Sarembok|PlatformDemo")
    void TriggerPlatformTest_176_180();

    UFUNCTION(BlueprintCallable, Category="Sarembok|PlatformDemo")
    void TriggerPlatformTest_181_185();

    UFUNCTION(BlueprintCallable, Category="Sarembok|PlatformDemo")
    void TriggerPlatformTest_186_190();

    UFUNCTION(BlueprintCallable, Category="Sarembok|PlatformDemo")
    void TriggerPlatformTest_191_195();

    UFUNCTION(BlueprintCallable, Category="Sarembok|PlatformDemo")
    void TriggerPlatformTest_196_200();
};
