// ============================================================================
// Copyright (c) 2026 Timothy Hall Jr. / Jetsontech. All rights reserved.
//
// This source code is licensed under the Business Source License 1.1 (BSL).
// Commercial use, deployment in production environments, or redistribution 
// for profit is strictly prohibited without a valid commercial license.
//
// For commercial inquiries, licensing, or partnerships, contact the Licensor.
// ============================================================================

#include "SarembokTaskPlanner.h"

TArray<FSarembokPlanStep> USarembokTaskPlanner::BuildPlan(
    const FString& Intent,
    const FString& Context)
{
    ActivePlan.Empty();

    FSarembokPlanStep Analyze;
    Analyze.Action = TEXT("Analyze");
    Analyze.Target = TEXT("Input");
    Analyze.Parameters = Context;
    ActivePlan.Add(Analyze);

    FSarembokPlanStep Execute;
    Execute.Action = TEXT("Execute");
    Execute.Target = Intent;
    Execute.Parameters = TEXT("Runtime Dispatch");
    ActivePlan.Add(Execute);

    FSarembokPlanStep Respond;
    Respond.Action = TEXT("Respond");
    Respond.Target = TEXT("User");
    Respond.Parameters = TEXT("Generate Result");
    ActivePlan.Add(Respond);

    return ActivePlan;
}
