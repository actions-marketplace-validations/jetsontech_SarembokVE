"""Acceptance and Regression Test Suite for Sarembok Front-End Rendering Pipelines.

Verifies:
1. UnifiedCockpit dual-pipeline configuration (UE 5.8 Live Link & Client WebGL Canvas).
2. ARKit 52 morph target telemetry indicators and 468-vertex topology bindings.
3. Live Link receiver port 11188 and ADA_V1_ARKIT mesh contract definitions.
4. Digital Human session controller and holographic canvas initialization in frontend/index.html.
"""
from __future__ import annotations

import re
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent


class TestFrontendRendering(unittest.TestCase):
    def setUp(self) -> None:
        self.cockpit_path = REPO_ROOT / "public" / "components" / "UnifiedCockpit.html"
        self.cockpit_frontend_path = REPO_ROOT / "frontend" / "components" / "UnifiedCockpit.html"
        legacy_html = REPO_ROOT / "frontend" / "legacy.html"
        self.index_html_path = legacy_html if legacy_html.exists() else (REPO_ROOT / "frontend" / "index.html")

    def test_01_unified_cockpit_elements_and_pipeline_switcher(self) -> None:
        self.assertTrue(self.cockpit_path.exists(), "public/components/UnifiedCockpit.html must exist")
        content = self.cockpit_path.read_text(encoding="utf-8")

        # Check Pipeline switcher buttons
        self.assertIn("btn-pipe-uelink", content)
        self.assertIn("btn-pipe-webgl", content)
        self.assertIn("btn-pipe-cloud", content)

        # Check UE 5.8 Live Link port 11188
        self.assertIn("11188", content)
        self.assertIn("ADA_V1_ARKIT", content)

        # Check WebGL / Canvas Hologram fallback viewport
        self.assertIn("cockpit-avatar-canvas", content)
        self.assertIn("468 ARKIT VERTICES", content)
        self.assertIn("JAW OPEN", content)
        self.assertIn("MOUTH SMILE", content)
        self.assertIn("EYE BLINK", content)

        # Check 32-band adaptive frequency spectrograph
        vbar_count = len(re.findall(r'<div class="vbar"></div>', content))
        self.assertEqual(vbar_count, 32, "UnifiedCockpit must feature 32 frequency bands")
        self.assertIn("SHANNON ENTROPY", content)

    def test_02_frontend_index_metahuman_canvas_and_controls(self) -> None:
        self.assertTrue(self.index_html_path.exists(), "frontend index/legacy html must exist")
        content = self.index_html_path.read_text(encoding="utf-8")

        # Check canvas and HUD overlay
        self.assertIn('id="metahuman-canvas"', content)
        self.assertIn('id="val-jaw-open"', content)
        self.assertIn('id="val-mouth-smile"', content)
        self.assertIn('id="val-eye-blink"', content)
        self.assertIn('id="val-brow-up"', content)

        # Check session functions
        self.assertIn("createLiveDigitalHumanSession", content)
        self.assertIn("animateMetaHuman", content)
        self.assertIn("initMetaHumanHologram", content)
        self.assertIn("FACE_TOPOLOGY", content)

    def test_03_avatar_contract_compliance(self) -> None:
        doc_contract = REPO_ROOT / "Docs" / "architecture" / "METAHUMAN_AVATAR_CONTRACT.md"
        legacy_contract = REPO_ROOT / "Architecture" / "METAHUMAN_AVATAR_CONTRACT.md"
        contract_path = doc_contract if doc_contract.exists() else legacy_contract
        self.assertTrue(contract_path.exists(), "METAHUMAN_AVATAR_CONTRACT.md must exist")
        contract = contract_path.read_text(encoding="utf-8")
        self.assertIn("presentation implementation, not the intelligence layer", contract)
        self.assertIn("Mobile compatibility", contract)

    def test_04_verify_ue_bridge_module(self) -> None:
        from Tools.verify_ue_bridge import test_unreal_bridge, CANONICAL_ARKIT_PACKET
        self.assertEqual(CANONICAL_ARKIT_PACKET["MeshId"], "ADA_V1_ARKIT")
        self.assertIn("JawOpen", CANONICAL_ARKIT_PACKET["Blendshapes"])

        # Run bridge probe with WebGL fallback enabled
        res = test_unreal_bridge(port=11188, allow_fallback=True)
        self.assertIn(res["status"], {"LIVE_LINK_CONNECTED", "FALLBACK_WEBGL_VERIFIED"})


if __name__ == "__main__":
    unittest.main()
