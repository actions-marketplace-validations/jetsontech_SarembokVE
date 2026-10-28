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
// SarembokTraceVisualizer.cpp
// ============================================================

#include "SarembokTraceVisualizer.h"
#include "Engine/Canvas.h"
#include "Engine/Engine.h"

ASarembokTraceVisualizer::ASarembokTraceVisualizer()
{
    PrimaryActorTick.bCanEverTick = true;
    bHUDEnabled = true;
    ActiveTraceSummary = TEXT("VISION (Observe) -> MEMORY (Update) -> AGENT (Goal: Demo) -> PLAN (Pick: Speak) -> BRIDGE (Route) -> AVATAR/VOICE");
}

void ASarembokTraceVisualizer::BeginPlay()
{
    Super::BeginPlay();

    UE_LOG(
        LogTemp,
        Display,
        TEXT("[SAREMBOK][TRACE_VISUALIZER] INITIALIZED | ConsoleCommand='sarembok.DebugTrace'")
    );
}

void ASarembokTraceVisualizer::Tick(float DeltaTime)
{
    Super::Tick(DeltaTime);

    if (bHUDEnabled && GEngine)
    {
        GEngine->AddOnScreenDebugMessage(
            184,
            0.1f,
            FColor::Cyan,
            FString::Printf(TEXT("[SAREMBOK EXECUTION TRACE] %s"), *ActiveTraceSummary)
        );
    }
}

void ASarembokTraceVisualizer::ToggleTraceHUD()
{
    bHUDEnabled = !bHUDEnabled;

    UE_LOG(
        LogTemp,
        Display,
        TEXT("[SAREMBOK][TRACE_VISUALIZER] HUD_TOGGLED Enabled=%s"),
        bHUDEnabled ? TEXT("true") : TEXT("false")
    );
}

void ASarembokTraceVisualizer::LogExecutionTraceCascade(const FString& TraceId, const FString& GoalDesc, const FString& IntentAction, float Confidence)
{
    ActiveTraceSummary = FString::Printf(
        TEXT("Trace=%s | Goal='%s' | Action=%s | Confidence=%.2f | Pipeline=VISION->MEMORY->AGENT->BRIDGE->AVATAR/VOICE"),
        *TraceId,
        *GoalDesc,
        *IntentAction,
        Confidence
    );

    UE_LOG(
        LogTemp,
        Display,
        TEXT("[SAREMBOK][TRACE_VISUALIZER] CASCADE | %s"),
        *ActiveTraceSummary
    );
}
