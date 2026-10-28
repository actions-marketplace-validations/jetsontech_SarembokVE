// ============================================================================
// Copyright (c) 2026 Timothy Hall Jr. / Jetsontech. All rights reserved.
//
// This source code is licensed under the Business Source License 1.1 (BSL).
// Commercial use, deployment in production environments, or redistribution 
// for profit is strictly prohibited without a valid commercial license.
//
// For commercial inquiries, licensing, or partnerships, contact the Licensor.
// ============================================================================

#include "SarembokCommandRouter.h"

bool USarembokCommandRouter::RouteCommand(const FSarembokCommand& Command)
{
    LastCommand = FString::Printf(
        TEXT("%s:%s:%s"),
        *Command.Command,
        *Command.Target,
        *Command.Payload
    );

    UE_LOG(LogTemp, Log,
        TEXT("Sarembok Command Routed: %s"),
        *LastCommand);

    return true;
}

FString USarembokCommandRouter::GetLastCommand() const
{
    return LastCommand;
}
