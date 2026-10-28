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
#include "SarembokVisionTypes.generated.h"

/** A normalized perception result. Backends may be OpenCV, Unreal, mobile native vision, or a future model. */
USTRUCT(BlueprintType)
struct SAREMBOKVISION_API FSarembokVisionDetection
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly)
    FString ClassId;

    UPROPERTY(BlueprintReadOnly)
    float Confidence = 0.0f;

    UPROPERTY(BlueprintReadOnly)
    FBox2D BoundingBox;

    UPROPERTY(BlueprintReadOnly)
    FDateTime TimestampUtc;
};

/** Stable transport envelope between perception backends and Sarembok agents. */
USTRUCT(BlueprintType)
struct SAREMBOKVISION_API FSarembokVisionEvent
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly)
    FString EventId;

    UPROPERTY(BlueprintReadOnly)
    FString Source;

    UPROPERTY(BlueprintReadOnly)
    FString SensorId;

    UPROPERTY(BlueprintReadOnly)
    FString EventType;

    UPROPERTY(BlueprintReadOnly)
    TArray<FSarembokVisionDetection> Detections;

    UPROPERTY(BlueprintReadOnly)
    FDateTime TimestampUtc;
};
