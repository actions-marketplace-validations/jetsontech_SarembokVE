// ============================================================================
// Copyright (c) 2026 Timothy Hall Jr. / Jetsontech. All rights reserved.
//
// This source code is licensed under the Business Source License 1.1 (BSL).
// Commercial use, deployment in production environments, or redistribution 
// for profit is strictly prohibited without a valid commercial license.
//
// For commercial inquiries, licensing, or partnerships, contact the Licensor.
// ============================================================================

#include "SarembokRuntimeManager.h"
#include "SarembokBridgeService.h"

void USarembokRuntimeManager::InitializeRuntime()
{
    if (bInitialized)
    {
        return;
    }

    UE_LOG(
        LogTemp,
        Display,
        TEXT("Sarembok Runtime Manager Initializing")
    );

    FSarembokBridgeService::Get().Initialize();

    bInitialized = true;

    UE_LOG(
        LogTemp,
        Display,
        TEXT("Sarembok Runtime Manager Initialized")
    );
}

void USarembokRuntimeManager::ShutdownRuntime()
{
    if (!bInitialized)
    {
        return;
    }

    UE_LOG(
        LogTemp,
        Display,
        TEXT("Sarembok Runtime Manager Shutting Down")
    );

    FSarembokBridgeService::Get().Shutdown();

    bInitialized = false;

    UE_LOG(
        LogTemp,
        Display,
        TEXT("Sarembok Runtime Manager Shutdown")
    );
}