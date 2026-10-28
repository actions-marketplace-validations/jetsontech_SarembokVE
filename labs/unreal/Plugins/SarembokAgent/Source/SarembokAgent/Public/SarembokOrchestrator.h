// ============================================================================
// Copyright (c) 2026 Timothy Hall Jr. / Jetsontech. All rights reserved.
//
// This source code is licensed under the Business Source License 1.1 (BSL).
// Commercial use, deployment in production environments, or redistribution 
// for profit is strictly prohibited without a valid commercial license.
//
// For commercial inquiries, licensing, or partnerships, contact the Licensor.
// ============================================================================

#pragma once

#include "CoreMinimal.h"
#include "UObject/Object.h"
#include "SarembokOrchestrator.generated.h"

UCLASS(Blueprintable)
class SAREMBOKAGENT_API USarembokOrchestrator : public UObject
{
    GENERATED_BODY()

public:

    UFUNCTION(BlueprintCallable, Category="Sarembok AI")
    void StartInteraction(const FString& Context);

    UFUNCTION(BlueprintCallable, Category="Sarembok AI")
    FString GetCurrentOperation() const;

private:

    FString CurrentOperation;
};
