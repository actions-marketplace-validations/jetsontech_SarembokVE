# ============================================================================
# Copyright (c) 2026 Timothy Hall Jr. / Jetsontech. All rights reserved.
#
# This source code is licensed under the Business Source License 1.1 (BSL).
# Commercial use, deployment in production environments, or redistribution 
# for profit is strictly prohibited without a valid commercial license.
#
# For commercial inquiries, licensing, or partnerships, contact the Licensor.
# ============================================================================

from dataclasses import dataclass, asdict
import json


@dataclass
class SarembokCommand:
    command: str
    target: str
    payload: dict

    def to_json(self):
        return json.dumps(asdict(self))


def speak(text, emotion="neutral"):
    return SarembokCommand(
        command="Speak",
        target="Avatar",
        payload={"text": text, "emotion": emotion},
    )


def emotion(state):
    return SarembokCommand(
        command="Emotion",
        target="Avatar",
        payload={"state": state},
    )
