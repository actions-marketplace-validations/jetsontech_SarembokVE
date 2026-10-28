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
// SarembokAvatarComponent.h
// Runtime Avatar Component
// ============================================================

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "SarembokAvatarComponent.generated.h"


class USarembokAvatarManager;


/**
 * Runtime component attached to
 * MetaHuman / Digital Human actors
 */
UCLASS(
    ClassGroup=(Sarembok),
    meta=(BlueprintSpawnableComponent)
)
class SAREMBOKAVATAR_API USarembokAvatarComponent 
    : public UActorComponent
{

    GENERATED_BODY()


public:

    USarembokAvatarComponent();


    virtual void BeginPlay() override;


    /**
     * Initialize avatar runtime
     */
    UFUNCTION(BlueprintCallable, Category="Sarembok|Avatar")
    void InitializeAvatar();


    /**
     * Send speech event
     */
    UFUNCTION(BlueprintCallable, Category="Sarembok|Avatar")
    void Speak(
        FString Text
    );


    /**
     * Set avatar identity
     */
    UFUNCTION(BlueprintCallable, Category="Sarembok|Avatar")
    void SetIdentity(
        FString AvatarID
    );


protected:

    UPROPERTY()
    USarembokAvatarManager* AvatarManager;


    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Sarembok")
    FString Identity;


};
