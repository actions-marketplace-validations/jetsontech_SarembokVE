// ============================================================================
// Copyright (c) 2026 Timothy Hall Jr. / Jetsontech. All rights reserved.
//
// This source code is licensed under the Business Source License 1.1 (BSL).
// Commercial use, deployment in production environments, or redistribution 
// for profit is strictly prohibited without a valid commercial license.
//
// For commercial inquiries, licensing, or partnerships, contact the Licensor.
// ============================================================================

// SarembokCoreModule.cpp
#include "SarembokCoreModule.h"
#include "Modules/ModuleManager.h"

void FSarembokCoreModule::StartupModule()
{
    UE_LOG(LogTemp, Display, TEXT("[SAREMBOK][CORE] Platform Runtime v2.0 initializing..."));
}

void FSarembokCoreModule::ShutdownModule()
{
    UE_LOG(LogTemp, Display, TEXT("[SAREMBOK][CORE] Platform Runtime v2.0 shutting down."));
}

IMPLEMENT_MODULE(FSarembokCoreModule, SarembokCore)
