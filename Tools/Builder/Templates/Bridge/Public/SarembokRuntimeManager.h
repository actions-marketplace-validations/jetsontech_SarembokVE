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


class SAREMBOKBRIDGE_API FSarembokRuntimeManager
{

public:

    static FSarembokRuntimeManager& Get();

    void Initialize();

    void Shutdown();


private:

    FSarembokRuntimeManager();

};
