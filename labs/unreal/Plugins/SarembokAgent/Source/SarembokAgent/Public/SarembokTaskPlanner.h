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
#include "SarembokTaskPlanner.generated.h"

USTRUCT(BlueprintType)
struct FSarembokPlanStep
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadWrite)
    FString Action;

    UPROPERTY(BlueprintReadWrite)
    FString Target;

    UPROPERTY(BlueprintReadWrite)
    FString Parameters;
};

UCLASS(Blueprintable)
class SAREMBOKAGENT_API USarembokTaskPlanner : public UObject
{
    GENERATED_BODY()

public:

    UFUNCTION(BlueprintCallable, Category="Sarembok Planner")
    TArray<FSarembokPlanStep> BuildPlan(
        const FString& Intent,
        const FString& Context
    );

private:
    TArray<FSarembokPlanStep> ActivePlan;
};
