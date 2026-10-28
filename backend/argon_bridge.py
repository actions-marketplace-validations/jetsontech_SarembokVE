# ============================================================================
# Copyright (c) 2026 Timothy Hall Jr. / Jetsontech. All rights reserved.
#
# This source code is licensed under the Business Source License 1.1 (BSL).
# Commercial use, deployment in production environments, or redistribution 
# for profit is strictly prohibited without a valid commercial license.
#
# For commercial inquiries, licensing, or partnerships, contact the Licensor.
# ============================================================================

# backend/argon_bridge.py
import os
import json
import http.client
import sqlite3
from typing import Dict, Any, Optional

class ArgonBridgeComponent:
    """
    Strengthened Core Component coordinating telemetry extraction 
    with Gemini 4 Argon's extended 1M-token decode horizon.
    """
    def __init__(self, api_key: Optional[str] = None, db_path: str = "sarembok_memory.db"):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        self.db_path = db_path
        self._ensure_db_schema()

        # generativelanguage.googleapis.com is Google's Gemini REST endpoint host
        self.host = "generativelanguage.googleapis.com"
        self.model_name = os.getenv("ARGON_MODEL", "gemini-4-argon")
        self.fallback_model = os.getenv("ARGON_FALLBACK_MODEL", "gemini-2.5-flash")
        self.endpoint = f"/v1beta/models/{self.model_name}:generateContent?key={self.api_key}" if self.api_key else ""

    def _ensure_db_schema(self):
        """Initializes the SQLite WAL audit_logs table if not already present."""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("PRAGMA journal_mode=WAL;")
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    drift_detected BOOLEAN NOT NULL DEFAULT 0,
                    shannon_entropy REAL NOT NULL DEFAULT 0.14,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    report TEXT,
                    visual_svg TEXT
                )
            """)
            conn.commit()
            conn.close()
        except Exception as e:
            # Non-blocking schema initialization failure
            pass

    def record_audit(self, drift_detected: bool, shannon_entropy: float, report: Dict[str, Any], visual_svg: str = ""):
        """Commits audit telemetry directly to the persistent SQLite-WAL layer."""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO audit_logs (drift_detected, shannon_entropy, timestamp, report, visual_svg)
                VALUES (?, ?, datetime('now'), ?, ?)
            """, (int(drift_detected), shannon_entropy, json.dumps(report), visual_svg))
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"[ArgonBridge] Failed to record audit log: {e}")

    def process_telemetry_audit(self, baseline_spec: Dict[str, Any], live_payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Executes an advanced long-horizon contract audit. If drift is found, 
        Argon generates the structural analysis along with the native visual representation.
        """
        if not self.api_key:
            raise EnvironmentError("CRITICAL: GEMINI_API_KEY environment variable is missing.")

        headers = {"Content-Type": "application/json"}
        
        system_instruction = (
            "You are the master validation kernel inside SarembokVE.\n"
            "Analyze the expected OpenAPI 3.1 contract spec vs the live observed network payload.\n"
            "Detect subtle structural drift, validation bypasses, or breaking changes.\n"
            "OUTPUT REQUIREMENT: Return a JSON object with two fields:\n"
            "1. 'audit_report': Object mapping drift analysis metrics and code fix recommendations.\n"
            "2. 'visual_svg': A clean, valid, native dark-mode SVG string charting this specific data drift visually for the end-user."
        )

        prompt_data = {
            "contents": [{
                "parts": [{
                    "text": f"SYSTEM_INSTRUCTION:\n{system_instruction}\n\n"
                            f"EXPECTED_BASELINE_SPEC:\n{json.dumps(baseline_spec)}\n\n"
                            f"LIVE_OBSERVED_TRAFFIC:\n{json.dumps(live_payload)}"
                }]
            }],
            "generationConfig": {
                "temperature": 0.1,
                "responseMimeType": "application/json"
            }
        }

        # Thread-safe connection block for distributed execution
        conn = http.client.HTTPSConnection(self.host, timeout=30)
        conn.request("POST", self.endpoint, body=json.dumps(prompt_data), headers=headers)
        response = conn.getresponse()
        raw_response_data = response.read().decode("utf-8")
        conn.close()

        # If primary model is unavailable, rate-limited, or quota-gated, route to fallback model
        if response.status != 200 and self.fallback_model:
            fallback_endpoint = f"/v1beta/models/{self.fallback_model}:generateContent?key={self.api_key}"
            conn_fallback = http.client.HTTPSConnection(self.host, timeout=30)
            conn_fallback.request("POST", fallback_endpoint, body=json.dumps(prompt_data), headers=headers)
            response = conn_fallback.getresponse()
            raw_response_data = response.read().decode("utf-8")
            conn_fallback.close()

        if response.status != 200:
            return {
                "error": True,
                "message": f"Argon Integration Failure: HTTP {response.status}",
                "details": raw_response_data
            }

        try:
            parsed_payload = json.loads(raw_response_data)
            text_response = parsed_payload["candidates"][0]["content"]["parts"][0]["text"]
            result = json.loads(text_response)

            drift_found = bool(result.get("audit_report", {}).get("drift_detected", False))
            entropy_score = float(result.get("audit_report", {}).get("shannon_entropy", 0.14))
            svg_data = result.get("visual_svg", "")
            self.record_audit(drift_found, entropy_score, result.get("audit_report", {}), svg_data)

            return result
        except (KeyError, IndexError, json.JSONDecodeError) as err:
            return {
                "error": True,
                "message": "Error parsing downstream response from Argon framework.",
                "details": str(err)
            }


if __name__ == "__main__":
    bridge = ArgonBridgeComponent()
    print("✨ ArgonBridgeComponent initialized successfully.")
