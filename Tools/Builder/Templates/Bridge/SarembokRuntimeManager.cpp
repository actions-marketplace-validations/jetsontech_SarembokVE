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


FSarembokRuntimeManager::
FSarembokRuntimeManager()
{
}



FSarembokRuntimeManager&
FSarembokRuntimeManager::Get()
{
    static FSarembokRuntimeManager Instance;

    return Instance;
}



void FSarembokRuntimeManager::Initialize()
{
    UE_LOG(
        LogTemp,
        Display,
        TEXT("Sarembok Runtime Manager Initialized")
    );
}



void FSarembokRuntimeManager::Shutdown()
{
}
