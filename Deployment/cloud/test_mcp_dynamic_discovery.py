# ============================================================================
# Copyright (c) 2026 Timothy Hall Jr. / Jetsontech. All rights reserved.
#
# This source code is licensed under the Business Source License 1.1 (BSL).
# Commercial use, deployment in production environments, or redistribution 
# for profit is strictly prohibited without a valid commercial license.
#
# For commercial inquiries, licensing, or partnerships, contact the Licensor.
# ============================================================================

"""Verification suite for MCP v2026.1 Dynamic Tool Discovery and Task Routing."""
from __future__ import annotations

import json
import unittest
from typing import Any

from Deployment.cloud.mcp_gateway import get_mcp_gateway, MCP_PROTOCOL_VERSION
from Deployment.cloud.worker_task_executor import WorkerTaskExecutor
import Deployment.cloud.server as server


class TestMcpDynamicDiscovery(unittest.TestCase):
    def setUp(self) -> None:
        self.gateway = get_mcp_gateway()
        self.executor = WorkerTaskExecutor(
            worker_id="test-dynamic-worker-01",
            mcp_gateway=self.gateway,
        )

    def test_01_mcp_v2026_initialization_negotiation(self) -> None:
        # Default negotiation uses 2026.1
        resp = self.gateway.handle_request({
            "jsonrpc": "2.0",
            "id": "init-1",
            "method": "initialize",
            "params": {"protocolVersion": "2026.1"},
        })
        self.assertIsNotNone(resp)
        self.assertEqual(resp["result"]["protocolVersion"], "2026.1")
        self.assertTrue(resp["result"]["capabilities"]["tools"]["listChanged"])
        self.assertEqual(resp["result"]["serverInfo"]["mcpSpec"], "v2026.1")

        # Backwards compatibility negotiation for 2024-11-05
        resp_legacy = self.gateway.handle_request({
            "jsonrpc": "2.0",
            "id": "init-2",
            "method": "initialize",
            "params": {"protocolVersion": "2024-11-05"},
        })
        self.assertEqual(resp_legacy["result"]["protocolVersion"], "2024-11-05")

    def test_02_dynamic_tool_registration_and_listing(self) -> None:
        def sample_entropy_tool(args: dict[str, Any]) -> dict[str, Any]:
            val = float(args.get("entropy", 0.12))
            return {"status": "MITIGATED", "stabilizedEntropy": round(val * 0.5, 4)}

        self.gateway.register_tool(
            name="mitigate_entropy",
            description="Dynamically registered entropy stabilization tool.",
            input_schema={
                "type": "object",
                "properties": {"entropy": {"type": "number"}},
                "required": ["entropy"],
            },
            handler=sample_entropy_tool,
            capability="governance",
        )

        self.assertTrue(self.gateway.has_tool("mitigate_entropy"))
        self.assertEqual(self.gateway.get_tool_capability("mitigate_entropy"), "governance")

        tools_resp = self.gateway.handle_request({
            "jsonrpc": "2.0",
            "id": "tools-1",
            "method": "tools/list",
            "params": {},
        })
        tool_names = [t["name"] for t in tools_resp["result"]["tools"]]
        self.assertIn("mitigate_entropy", tool_names)

    def test_03_dynamic_tool_execution_via_tools_call(self) -> None:
        def echo_tool(args: dict[str, Any]) -> str:
            return f"ECHO:{args.get('msg', '')}"

        self.gateway.register_tool(
            name="echo_test",
            description="Simple echo tool.",
            input_schema={"type": "object", "properties": {"msg": {"type": "string"}}},
            handler=echo_tool,
        )

        call_resp = self.gateway.handle_request({
            "jsonrpc": "2.0",
            "id": "call-1",
            "method": "tools/call",
            "params": {"name": "echo_test", "arguments": {"msg": "hello_mcp"}},
        })
        self.assertFalse(call_resp["result"]["isError"])
        self.assertEqual(call_resp["result"]["content"][0]["text"], "ECHO:hello_mcp")

    def test_04_worker_executor_dynamic_tool_discovery(self) -> None:
        def custom_calc(args: dict[str, Any]) -> dict[str, Any]:
            return {"score": sum(args.get("values", []))}

        self.gateway.register_tool(
            name="custom_calc",
            description="Dynamic score summation tool",
            input_schema={"type": "object", "properties": {"values": {"type": "array"}}},
            handler=custom_calc,
            capability="compute",
        )

        discovered = self.executor.discover_tools()
        discovered_names = [t["name"] for t in discovered]
        self.assertIn("custom_calc", discovered_names)
        self.assertIn("compute", self.executor.capabilities())
        self.assertIn("mcp", self.executor.capabilities())

    def test_05_worker_executor_executes_dynamic_tool_directly(self) -> None:
        def tensor_dot(args: dict[str, Any]) -> dict[str, Any]:
            v1 = args.get("v1", [1, 2])
            v2 = args.get("v2", [3, 4])
            dot = sum(a * b for a, b in zip(v1, v2))
            return {"dot": dot}

        self.gateway.register_tool(
            name="tensor_dot",
            description="Compute dot product of two vectors",
            input_schema={"type": "object"},
            handler=tensor_dot,
        )

        # Call by tool name directly
        res1 = self.executor.execute("tensor_dot", {"v1": [2, 3], "v2": [4, 5]})
        self.assertEqual(res1["status"], "COMPLETED")
        self.assertEqual(res1["tool"], "tensor_dot")
        out1 = json.loads(res1["output"])
        self.assertEqual(out1["dot"], 23)

        # Call via mcp: prefix
        res2 = self.executor.execute("mcp:tensor_dot", {"v1": [1, 1], "v2": [1, 1]})
        self.assertEqual(res2["status"], "COMPLETED")
        out2 = json.loads(res2["output"])
        self.assertEqual(out2["dot"], 2)

        # Call via mcp_call task type
        res3 = self.executor.execute("mcp_call", {"tool": "tensor_dot", "arguments": {"v1": [3], "v2": [4]}})
        self.assertEqual(res3["status"], "COMPLETED")
        out3 = json.loads(res3["output"])
        self.assertEqual(out3["dot"], 12)

    def test_06_server_required_capability_for_dynamic_mcp_tool(self) -> None:
        self.gateway.register_tool(
            name="security_scanner",
            description="Dynamic security auditing tool",
            input_schema={"type": "object"},
            handler=lambda x: "SECURE",
            capability="security",
        )
        # Verify server capability resolution routes dynamic tool without hardcoding
        cap = server.required_capability_for_task("security_scanner")
        self.assertEqual(cap, "security")

        cap_mcp = server.required_capability_for_task("mcp:security_scanner")
        self.assertEqual(cap_mcp, "security")

        cap_generic_mcp = server.required_capability_for_task("mcp_call")
        self.assertEqual(cap_generic_mcp, "mcp")


if __name__ == "__main__":
    unittest.main()
