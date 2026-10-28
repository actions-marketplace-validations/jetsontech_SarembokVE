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
#include "UObject/NoExportTypes.h"
#include "SarembokRuntimeManager.generated.h"

UCLASS()
class SAREMBOKBRIDGE_API USarembokRuntimeManager : public UObject
{
    GENERATED_BODY()

public:
    void InitializeRuntime();
    void ShutdownRuntime();

    bool IsInitialized() const
    {
        return bInitialized;
    }

private:
    bool bInitialized = false;
};
