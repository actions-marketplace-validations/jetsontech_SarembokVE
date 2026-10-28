// ============================================================================
// Copyright (c) 2026 Timothy Hall Jr. / Jetsontech. All rights reserved.
//
// This source code is licensed under the Business Source License 1.1 (BSL).
// Commercial use, deployment in production environments, or redistribution 
// for profit is strictly prohibited without a valid commercial license.
//
// For commercial inquiries, licensing, or partnerships, contact the Licensor.
// ============================================================================

#include "SarembokBridgeModule.h"
#include "SarembokRuntimeManager.h"
#include "UObject/UObjectGlobals.h"

static USarembokRuntimeManager* GSarembokRuntimeManager = nullptr;

void FSarembokBridgeModule::StartupModule()
{
    UE_LOG(
        LogTemp,
        Display,
        TEXT("Sarembok Bridge Initialized")
    );

    GSarembokRuntimeManager = NewObject<USarembokRuntimeManager>(
        GetTransientPackage(),
        USarembokRuntimeManager::StaticClass()
    );

    if (GSarembokRuntimeManager)
    {
        GSarembokRuntimeManager->AddToRoot();
        GSarembokRuntimeManager->InitializeRuntime();
    }
}

void FSarembokBridgeModule::ShutdownModule()
{
    if (GSarembokRuntimeManager)
    {
        GSarembokRuntimeManager->ShutdownRuntime();

        // Do NOT call RemoveFromRoot() here.
        // During UE shutdown the UObject array may already be tearing down.
        GSarembokRuntimeManager = nullptr;
    }

    UE_LOG(
        LogTemp,
        Display,
        TEXT("Sarembok Bridge Shutdown")
    );
}

IMPLEMENT_MODULE(
    FSarembokBridgeModule,
    SarembokBridge
)