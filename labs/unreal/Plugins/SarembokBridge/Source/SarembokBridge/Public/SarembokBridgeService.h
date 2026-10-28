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
#include "SarembokWebSocketClient.h"
#include "SarembokMessageRouter.h"

class SAREMBOKBRIDGE_API FSarembokBridgeService
{
public:

    static FSarembokBridgeService& Get();

    void Initialize();
    void Shutdown();

    void SendMessage(const FSarembokMessage& Message);
    void ReceiveMessage(const FSarembokMessage& Message);

    bool IsReady() const { return bReady; }

private:

    FSarembokBridgeService();

    TSharedPtr<FSarembokWebSocketClient> WebSocketClient;

    bool bReady = false;
};
