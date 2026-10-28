// ============================================================================
// Copyright (c) 2026 Timothy Hall Jr. / Jetsontech. All rights reserved.
//
// This source code is licensed under the Business Source License 1.1 (BSL).
// Commercial use, deployment in production environments, or redistribution 
// for profit is strictly prohibited without a valid commercial license.
//
// For commercial inquiries, licensing, or partnerships, contact the Licensor.
// ============================================================================

#include "SarembokRuntimeConnector.h"

void USarembokRuntimeConnector::Initialize(FSubsystemCollectionBase& Collection)
{
    Super::Initialize(Collection);
    RuntimeAddress = TEXT("ws://127.0.0.1:8765");
}

void USarembokRuntimeConnector::Deinitialize()
{
    bConnected = false;
    Super::Deinitialize();
}

void USarembokRuntimeConnector::ConnectRuntime()
{
    // WebSocket transport binding is connected in the next integration pass.
    bConnected = true;
}

void USarembokRuntimeConnector::SendCommand(const FString& CommandJson)
{
    if (!bConnected)
    {
        return;
    }

    // Command dispatch hook for SarembokBridge WebSocket client.
}
