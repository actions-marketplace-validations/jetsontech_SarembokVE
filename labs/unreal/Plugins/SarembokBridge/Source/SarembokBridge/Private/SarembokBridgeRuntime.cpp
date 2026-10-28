// ============================================================================
// Copyright (c) 2026 Timothy Hall Jr. / Jetsontech. All rights reserved.
//
// This source code is licensed under the Business Source License 1.1 (BSL).
// Commercial use, deployment in production environments, or redistribution 
// for profit is strictly prohibited without a valid commercial license.
//
// For commercial inquiries, licensing, or partnerships, contact the Licensor.
// ============================================================================

#include "SarembokBridgeRuntime.h"

FSarembokBridgeRuntime::FSarembokBridgeRuntime()
{
}

FSarembokBridgeRuntime::~FSarembokBridgeRuntime()
{
    Shutdown();
}

void FSarembokBridgeRuntime::Initialize()
{
    Dispatcher = MakeShared<FSarembokMessageDispatcher>();
    Client = MakeShared<FSarembokWebSocketClient>();

    Client->Connect();

    UE_LOG(LogTemp, Display, TEXT("Sarembok Bridge Runtime Started"));
}

void FSarembokBridgeRuntime::Shutdown()
{
    if (Client.IsValid())
    {
        Client->Disconnect();
        Client.Reset();
    }

    Dispatcher.Reset();
}

void FSarembokBridgeRuntime::SendCommand(
    const FString& Command,
    const FString& Target,
    const FString& Payload)
{
    if (!Client.IsValid())
    {
        return;
    }

    FString Message = FString::Printf(
        TEXT("{\"command\":\"%s\",\"target\":\"%s\",\"payload\":\"%s\"}"),
        *Command,
        *Target,
        *Payload
    );

    Client->SendMessage(Message);
}
