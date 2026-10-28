# ============================================================================
# Copyright (c) 2026 Timothy Hall Jr. / Jetsontech. All rights reserved.
#
# This source code is licensed under the Business Source License 1.1 (BSL).
# Commercial use, deployment in production environments, or redistribution 
# for profit is strictly prohibited without a valid commercial license.
#
# For commercial inquiries, licensing, or partnerships, contact the Licensor.
# ============================================================================

from commands import speak, emotion


class SarembokAgent:
    def __init__(self, memory):
        self.memory = memory

    def process(self, event):
        event_type = event.get("event")

        if event_type == "user_detected":
            self.memory.remember("last_event", "User detected")
            return [
                emotion("friendly"),
                speak("Hello, I am Sarembok.", "friendly"),
            ]

        return []
