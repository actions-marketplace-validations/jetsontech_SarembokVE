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
#include "SarembokVisionTypes.h"

/** Backend-neutral interface. Implementations must not own agent or avatar state. */
class SAREMBOKVISION_API ISarembokVisionBackend
{
public:
    virtual ~ISarembokVisionBackend() = default;

    virtual FString GetBackendName() const = 0;
    virtual bool IsAvailable() const = 0;

    /** Process one normalized frame and return zero or more perception events. */
    virtual bool ProcessFrame(const TArray<uint8>& ImageBytes, FSarembokVisionEvent& OutEvent) = 0;
};
