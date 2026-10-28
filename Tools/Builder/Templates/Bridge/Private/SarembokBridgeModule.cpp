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


void FSarembokBridgeModule::StartupModule()
{

UE_LOG(
LogTemp,
Display,
TEXT("Sarembok Bridge Initialized")
);


USarembokRuntimeManager* Runtime =
NewObject<USarembokRuntimeManager>();

Runtime->InitializeRuntime();

}



void FSarembokBridgeModule::ShutdownModule()
{

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
