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
// SarembokAgentRuntimeManager.h
// Multi-Agent Runtime Manager Subsystem — Sarembok_VE v2.1
// ============================================================
#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "SarembokAgentRuntimeManager.generated.h"

UCLASS()
class SAREMBOKCORE_API USarembokAgentRuntimeManager : public UGameInstanceSubsystem
{
    GENERATED_BODY()

public:
    virtual void Initialize(FSubsystemCollectionBase& Collection) override;

    UFUNCTION(BlueprintCallable, Category="Sarembok|RuntimeManager")
    bool RegisterAgentRuntime(const FString& AgentId, const FString& RoleName);

    UFUNCTION(BlueprintCallable, Category="Sarembok|RuntimeManager")
    bool IsAgentActive(const FString& AgentId) const;

    UFUNCTION(BlueprintCallable, Category="Sarembok|RuntimeManager")
    TArray<FString> GetActiveAgentRuntimes() const;

    UFUNCTION(BlueprintCallable, Category="Sarembok|RuntimeManager")
    bool TerminateAgentRuntime(const FString& AgentId);

private:
    TMap<FString, FString> ActiveAgentRoles;
};
