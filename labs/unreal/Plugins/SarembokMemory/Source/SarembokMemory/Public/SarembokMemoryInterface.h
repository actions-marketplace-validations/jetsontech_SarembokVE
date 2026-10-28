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
#include "UObject/Interface.h"
#include "SarembokMemoryInterface.generated.h"

UINTERFACE(BlueprintType)
class SAREMBOKMEMORY_API USarembokMemoryInterface : public UInterface
{
    GENERATED_BODY()
};

class SAREMBOKMEMORY_API ISarembokMemoryInterface
{
    GENERATED_BODY()

public:

    virtual void StoreMemory(
        const FString& Key,
        const FString& Value
    ) = 0;

    virtual FString RecallMemory(
        const FString& Key
    ) = 0;
};
