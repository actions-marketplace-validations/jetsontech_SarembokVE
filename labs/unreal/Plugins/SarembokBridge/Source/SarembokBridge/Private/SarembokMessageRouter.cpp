// ============================================================================
// Copyright (c) 2026 Timothy Hall Jr. / Jetsontech. All rights reserved.
//
// This source code is licensed under the Business Source License 1.1 (BSL).
// Commercial use, deployment in production environments, or redistribution 
// for profit is strictly prohibited without a valid commercial license.
//
// For commercial inquiries, licensing, or partnerships, contact the Licensor.
// ============================================================================

#include "SarembokMessageRouter.h"

FSarembokMessageRouter& FSarembokMessageRouter::Get()
{
    static FSarembokMessageRouter Instance;
    return Instance;
}

void FSarembokMessageRouter::RegisterHandler(const FString& EventName, FSarembokMessageHandler Handler)
{
    Handlers.Add(EventName, Handler);
}

void FSarembokMessageRouter::Dispatch(const FSarembokMessage& Message)
{
    if (FSarembokMessageHandler* Handler = Handlers.Find(Message.Event))
    {
        Handler->ExecuteIfBound(Message);
    }
}
