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
#include "SarembokWebSocketClient.h"
#include "SarembokMessageDispatcher.h"

class FSarembokBridgeRuntime
{
public:

    FSarembokBridgeRuntime();
    ~FSarembokBridgeRuntime();

    void Initialize();
    void Shutdown();

    void SendCommand(const FString& Command,
                     const FString& Target,
                     const FString& Payload);

private:

    TSharedPtr<FSarembokWebSocketClient> Client;
    TSharedPtr<FSarembokMessageDispatcher> Dispatcher;
};
