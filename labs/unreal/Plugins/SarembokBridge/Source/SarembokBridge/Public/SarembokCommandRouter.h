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
#include "UObject/Object.h"
#include "SarembokCommandRouter.generated.h"

USTRUCT(BlueprintType)
struct FSarembokCommand
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadWrite)
    FString Command;

    UPROPERTY(BlueprintReadWrite)
    FString Target;

    UPROPERTY(BlueprintReadWrite)
    FString Payload;
};

UCLASS(Blueprintable)
class SAREMBOKBRIDGE_API USarembokCommandRouter : public UObject
{
    GENERATED_BODY()

public:

    UFUNCTION(BlueprintCallable, Category="Sarembok Bridge")
    bool RouteCommand(const FSarembokCommand& Command);

    UFUNCTION(BlueprintCallable, Category="Sarembok Bridge")
    FString GetLastCommand() const;

private:

    FString LastCommand;
};
