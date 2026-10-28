# ============================================================================
# Copyright (c) 2026 Timothy Hall Jr. / Jetsontech. All rights reserved.
#
# This source code is licensed under the Business Source License 1.1 (BSL).
# Commercial use, deployment in production environments, or redistribution 
# for profit is strictly prohibited without a valid commercial license.
#
# For commercial inquiries, licensing, or partnerships, contact the Licensor.
# ============================================================================

import unittest

from sarembok_avatar import (
    AvatarController,
    AvatarExpression,
    AvatarSignal,
)


class FakeRenderer:
    def apply(self, command):
        return {
            "ok": True,
            "signal": command.state.signal.value,
            "expression": command.state.expression.name if command.state.expression else None,
            "speech": command.state.speech_stream_ref,
        }


class AvatarTests(unittest.TestCase):
    def test_renderer_receives_neutral_avatar_state(self):
        result = AvatarController(FakeRenderer()).set_state("s1", AvatarSignal.LISTENING)
        self.assertTrue(result["ok"])
        self.assertEqual(result["signal"], "listening")

    def test_speech_can_drive_expression_and_voice_stream(self):
        result = AvatarController(FakeRenderer()).set_state(
            "s2",
            AvatarSignal.SPEAKING,
            expression=AvatarExpression("engaged", 0.8),
            speech_stream_ref="speech://stream-1",
            viseme_ref="viseme://stream-1",
        )
        self.assertEqual(result["expression"], "engaged")
        self.assertEqual(result["speech"], "speech://stream-1")


if __name__ == "__main__":
    unittest.main()
