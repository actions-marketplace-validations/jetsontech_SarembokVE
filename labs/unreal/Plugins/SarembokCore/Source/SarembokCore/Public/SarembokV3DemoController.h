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
// SarembokV3DemoController.h
// Sarembok VE 3.0 Complete Platform Demo Controller (Checks 251 to 300)
// ============================================================

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "SarembokV3DemoController.generated.h"

UCLASS(ClassGroup=(Sarembok), meta=(BlueprintSpawnableComponent))
class SAREMBOKCORE_API ASarembokV3DemoController : public AActor
{
    GENERATED_BODY()

public:
    ASarembokV3DemoController();

    virtual void BeginPlay() override;

    UFUNCTION(BlueprintCallable, Category="Sarembok|V3Demo")
    void TriggerV3Test_251_260();

    UFUNCTION(BlueprintCallable, Category="Sarembok|V3Demo")
    void TriggerV3Test_261_270();

    UFUNCTION(BlueprintCallable, Category="Sarembok|V3Demo")
    void TriggerV3Test_271_280();

    UFUNCTION(BlueprintCallable, Category="Sarembok|V3Demo")
    void TriggerV3Test_281_290();

    UFUNCTION(BlueprintCallable, Category="Sarembok|V3Demo")
    void TriggerV3Test_291_300();
};
