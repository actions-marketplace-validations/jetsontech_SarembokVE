"""Unit tests for SarembokVE Sovereign Specification & Architecture Engine."""
from __future__ import annotations

import json
import unittest
from unittest.mock import patch, MagicMock

from Deployment.cloud.browser.server import (
    infer_json_schema,
    generate_openapi_spec,
    generate_typescript_contracts,
)
from Deployment.cloud.provider_router import ProviderRouter
from Deployment.cloud.capability_registry import CapabilityRegistry


class TestSpecificationEngine(unittest.TestCase):
    def test_schema_inference_primitives_and_nested(self):
        sample = {
            "id": 42,
            "title": "Quantum Gateway",
            "active": True,
            "tags": ["edge", "sovereign"],
            "metrics": {"latency_ms": 12.4, "success_rate": 0.999},
            "nullable": None,
        }
        schema = infer_json_schema(sample)
        self.assertEqual(schema["type"], "object")
        props = schema["properties"]
        self.assertEqual(props["id"]["type"], "integer")
        self.assertEqual(props["title"]["type"], "string")
        self.assertEqual(props["active"]["type"], "boolean")
        self.assertEqual(props["tags"]["type"], "array")
        self.assertEqual(props["tags"]["items"]["type"], "string")
        self.assertEqual(props["metrics"]["type"], "object")
        self.assertEqual(props["metrics"]["properties"]["latency_ms"]["type"], "number")
        self.assertEqual(props["nullable"]["type"], "null")

    def test_generate_openapi_spec(self):
        url = "https://api.sarembok.example"
        dom_spec = {
            "title": "Enterprise Cloud Portal",
            "forms": [
                {
                    "index": 0,
                    "action": "/login",
                    "method": "POST",
                    "fields": [
                        {"name": "username", "type": "text", "required": True},
                        {"name": "password", "type": "password", "required": True},
                    ],
                }
            ],
        }
        endpoints_map = {
            "GET /v1/telemetry": {
                "method": "GET",
                "path": "/v1/telemetry",
                "status": 200,
                "contentType": "application/json",
                "queryParams": {"cluster": "string"},
                "responseBody": {
                    "type": "object",
                    "properties": {"healthy": {"type": "boolean"}},
                },
            }
        }
        spec = generate_openapi_spec(url, dom_spec, endpoints_map)
        self.assertEqual(spec["openapi"], "3.1.0")
        self.assertIn("/v1/telemetry", spec["paths"])
        self.assertIn("get", spec["paths"]["/v1/telemetry"])
        self.assertIn("/login", spec["paths"])
        self.assertIn("post", spec["paths"]["/login"])

    def test_generate_typescript_contracts(self):
        url = "https://app.sarembok.example"
        dom_spec = {
            "forms": [
                {
                    "index": 0,
                    "fields": [
                        {"name": "email", "required": True},
                        {"name": "optIn", "required": False},
                    ],
                }
            ]
        }
        endpoints_map = {
            "GET /api/status": {
                "method": "GET",
                "path": "/api/status",
                "queryParams": {"verbose": "string"},
                "responseBody": {
                    "type": "object",
                    "properties": {
                        "ok": {"type": "boolean"},
                        "workers": {"type": "integer"},
                    },
                },
            }
        }
        contracts = generate_typescript_contracts(url, dom_spec, endpoints_map)
        self.assertIn("export interface Form_0_Payload", contracts)
        self.assertIn("email: string;", contracts)
        self.assertIn("optIn?: string;", contracts)
        self.assertIn("export interface Endpoint_Get_api_status_Query", contracts)
        self.assertIn("export interface Endpoint_Get_api_status_Response", contracts)
        self.assertIn("ok?: boolean;", contracts)
        self.assertIn("workers?: number;", contracts)

    def test_muse_glimmer_model_alias_resolution(self):
        router = ProviderRouter()
        self.assertEqual(router.resolve_model_id("muse"), "muse-glimmer-30b")
        self.assertEqual(router.resolve_model_id("muse-glimmer"), "muse-glimmer-30b")
        self.assertEqual(router.resolve_model_id("muse-glimmer-30b"), "muse-glimmer-30b")
        self.assertEqual(router.resolve_model_id("glimmer"), "muse-glimmer-30b")
        self.assertEqual(router.resolve_model_id("qwen-32b"), "qwen/qwen-2.5-coder-32b-instruct")

    def test_capability_registry_includes_specification(self):
        snapshot = CapabilityRegistry().snapshot({"onlineWorkers": 0, "registeredWorkers": 0, "llmConfigured": False})
        method_names = [c.get("method") for c in snapshot.get("capabilities", [])]
        self.assertIn("ExtractSystemSpecification", method_names)


if __name__ == "__main__":
    unittest.main()
