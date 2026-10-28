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
#include "GameFramework/Actor.h"
#include "SarembokBridgeTestActor.generated.h"

UCLASS(Blueprintable, Category = "SarembokBridge")
class SAREMBOKBRIDGE_API ASarembokBridgeTestActor : public AActor
{
    GENERATED_BODY()

public:
    ASarembokBridgeTestActor();

protected:
    virtual void BeginPlay() override;

public:
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "SarembokBridge")
    USceneComponent* RootScene;
};
