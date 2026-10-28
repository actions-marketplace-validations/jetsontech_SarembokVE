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
// SarembokActionPolicyGate.h
// Action Authorization & Policy Safety Gate Subsystem
// ============================================================

#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "SarembokReasoningProvider.h"
#include "SarembokActionPolicyGate.generated.h"

UENUM(BlueprintType)
enum class EPolicyResult : uint8
{
    ALLOW,
    DENY,
    CONFIRMATION_REQUIRED
};

UCLASS()
class SAREMBOKAGENT_API USarembokActionPolicyGate : public UGameInstanceSubsystem
{
    GENERATED_BODY()

public:

    virtual void Initialize(FSubsystemCollectionBase& Collection) override;
    virtual void Deinitialize() override;

    UFUNCTION(BlueprintCallable, Category = "Sarembok|PolicyGate")
    EPolicyResult EvaluateIntentPolicy(const FSarembokIntent& Intent);

    UFUNCTION(BlueprintCallable, Category = "Sarembok|PolicyGate")
    void SetStrictPolicyMode(bool bEnableStrict);

    UFUNCTION(BlueprintPure, Category = "Sarembok|PolicyGate")
    bool IsStrictPolicyMode() const;

private:

    bool bStrictPolicyMode = true;
};
