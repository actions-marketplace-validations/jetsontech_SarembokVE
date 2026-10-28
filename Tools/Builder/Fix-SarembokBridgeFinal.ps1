# ============================================================================
# Copyright (c) 2026 Timothy Hall Jr. / Jetsontech. All rights reserved.
#
# This source code is licensed under the Business Source License 1.1 (BSL).
# Commercial use, deployment in production environments, or redistribution 
# for profit is strictly prohibited without a valid commercial license.
#
# For commercial inquiries, licensing, or partnerships, contact the Licensor.
# ============================================================================

$Root="C:\Sarembok_VE"

Write-Host ""
Write-Host "========================================"
Write-Host " Sarembok Bridge Final Module Fix"
Write-Host "========================================"


$Public="$Root\Plugins\SarembokBridge\Source\SarembokBridge\Public"
$Private="$Root\Plugins\SarembokBridge\Source\SarembokBridge\Private"


Write-Host "Creating SarembokBridgeModule.h"


@"
#pragma once

#include "Modules/ModuleManager.h"


class FSarembokBridgeModule : public IModuleInterface
{

public:

    virtual void StartupModule() override;

    virtual void ShutdownModule() override;

};
"@ | Out-File "$Public\SarembokBridgeModule.h" -Encoding utf8



Write-Host "Fixing SarembokBridgeModule.cpp"


@'
#include "SarembokBridgeModule.h"

void FSarembokBridgeModule::StartupModule()
{

    UE_LOG(
        LogTemp,
        Display,
        TEXT("Sarembok Bridge Initialized")
    );

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
'@ | Out-File "$Private\SarembokBridgeModule.cpp" -Encoding utf8



Write-Host "Removing duplicate Bridge implementation"


$Old="$Public\SarembokBridge.h"

if(Test-Path $Old)
{
    Remove-Item $Old -Force
}



Write-Host "Cleaning cache"


Remove-Item "$Root\Intermediate" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "$Root\Plugins\SarembokBridge\Intermediate" -Recurse -Force -ErrorAction SilentlyContinue



Write-Host "Building"


& "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\DotNET\UnrealBuildTool\UnrealBuildTool.exe" `
SarembokVEEditor `
Win64 `
Development `
-project="$Root\SarembokVE.uproject" `
-progress


Write-Host ""
Write-Host "========================================"
Write-Host " Bridge Fix Complete"
Write-Host "========================================"