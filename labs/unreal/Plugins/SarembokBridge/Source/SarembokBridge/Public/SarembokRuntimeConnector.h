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
#include "Subsystems/GameInstanceSubsystem.h"
#include "SarembokRuntimeConnector.generated.h"

UCLASS()
class SAREMBOKBRIDGE_API USarembokRuntimeConnector : public UGameInstanceSubsystem
{
    GENERATED_BODY()

public:
    virtual void Initialize(FSubsystemCollectionBase& Collection) override;
    virtual void Deinitialize() override;

    UFUNCTION(BlueprintCallable, Category="Sarembok")
    void ConnectRuntime();

    UFUNCTION(BlueprintCallable, Category="Sarembok")
    void SendCommand(const FString& CommandJson);

private:
    FString RuntimeAddress;
    bool bConnected = false;
};
