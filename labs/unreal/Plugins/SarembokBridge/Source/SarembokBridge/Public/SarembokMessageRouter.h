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
#include "SarembokMessage.h"

DECLARE_DELEGATE_OneParam(FSarembokMessageHandler, const FSarembokMessage&);

class SAREMBOKBRIDGE_API FSarembokMessageRouter
{
public:

    static FSarembokMessageRouter& Get();

    void RegisterHandler(const FString& EventName, FSarembokMessageHandler Handler);
    void Dispatch(const FSarembokMessage& Message);

private:

    TMap<FString, FSarembokMessageHandler> Handlers;
};
