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
// SarembokTraceViewerComponent.cpp
// Cognitive Trace Timeline Inspector Component Implementation
// ============================================================

#include "SarembokTraceViewerComponent.h"

USarembokTraceViewerComponent::USarembokTraceViewerComponent()
{
    PrimaryComponentTick.bCanEverTick = false;
}

void USarembokTraceViewerComponent::BeginPlay()
{
    Super::BeginPlay();
    ActiveTimeline.Empty();
    UE_LOG(LogTemp, Display, TEXT("[SAREMBOK][TRACE_VIEWER] INITIALIZED"));
}

void USarembokTraceViewerComponent::LogTraceStep(const FString& Stage, const FString& Message)
{
    FSarembokTraceStep Step;
    Step.TimestampMs = FPlatformTime::Seconds() * 1000.0;
    Step.Stage = Stage;
    Step.Message = Message;
    ActiveTimeline.Add(Step);

    UE_LOG(LogTemp, Display,
        TEXT("[SAREMBOK][TRACE] %s | %s"),
        *Stage, *Message);
}

void USarembokTraceViewerComponent::FormatAndEmitTimeline(const FString& TraceId)
{
    UE_LOG(LogTemp, Display, TEXT("[SAREMBOK][TRACE_VIEWER] TIMELINE_EMITTED | TraceId=%s | Steps=%d"), *TraceId, ActiveTimeline.Num());
}
