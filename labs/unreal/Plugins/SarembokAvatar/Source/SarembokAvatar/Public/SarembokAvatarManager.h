// ============================================================================
// Copyright (c) 2026 Timothy Hall Jr. / Jetsontech. All rights reserved.
//
// This source code is licensed under the Business Source License 1.1 (BSL).
// Commercial use, deployment in production environments, or redistribution 
// for profit is strictly prohibited without a valid commercial license.
//
// For commercial inquiries, licensing, or partnerships, contact the Licensor.
// ============================================================================

// ============================================================
// SarembokAvatarManager.h
// Sarembok Autonomous AI Virtual Entity Platform
// Avatar Runtime Manager
// ============================================================

#pragma once

#include "CoreMinimal.h"
#include "UObject/NoExportTypes.h"
#include "SarembokAvatarManager.generated.h"


/**
 * Avatar lifecycle state
 */
UENUM(BlueprintType)
enum class ESarembokAvatarState : uint8
{
    Uninitialized UMETA(DisplayName="Uninitialized"),
    Loading       UMETA(DisplayName="Loading"),
    Ready         UMETA(DisplayName="Ready"),
    Speaking      UMETA(DisplayName="Speaking"),
    Listening     UMETA(DisplayName="Listening"),
    Thinking      UMETA(DisplayName="Thinking"),
    Disabled      UMETA(DisplayName="Disabled")
};


/**
 * Sarembok Avatar Runtime Manager
 *
 * Controls:
 * - Digital human lifecycle
 * - Avatar state
 * - Animation communication
 * - Voice synchronization
 * - AI runtime events
 */
UCLASS(Blueprintable)
class SAREMBOKAVATAR_API USarembokAvatarManager : public UObject
{

    GENERATED_BODY()


public:

    USarembokAvatarManager();


    /**
     * Initialize Avatar subsystem
     */
    UFUNCTION(BlueprintCallable, Category="Sarembok|Avatar")
    void InitializeAvatar();


    /**
     * Shutdown Avatar subsystem
     */
    UFUNCTION(BlueprintCallable, Category="Sarembok|Avatar")
    void ShutdownAvatar();


    /**
     * Update avatar state
     */
    UFUNCTION(BlueprintCallable, Category="Sarembok|Avatar")
    void SetAvatarState(
        ESarembokAvatarState NewState
    );


    /**
     * Get current avatar state
     */
    UFUNCTION(BlueprintPure, Category="Sarembok|Avatar")
    ESarembokAvatarState GetAvatarState() const;


    /**
     * Trigger facial animation
     */
    UFUNCTION(BlueprintCallable, Category="Sarembok|Avatar")
    void TriggerExpression(
        FString ExpressionName
    );


    /**
     * Synchronize speech animation
     */
    UFUNCTION(BlueprintCallable, Category="Sarembok|Avatar")
    void SynchronizeVoice(
        FString AudioReference
    );


private:

    UPROPERTY()
    ESarembokAvatarState CurrentState;


};

