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

#include "Modules/ModuleManager.h"


class FSarembokBridgeModule :
public IModuleInterface
{

public:

virtual void StartupModule() override;

virtual void ShutdownModule() override;


};
