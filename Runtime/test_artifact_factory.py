"""Unit and Integration Test Suite for Multi-Format Artifact Factory and MCP Integration."""

from __future__ import annotations

import json
import os
import shutil
import tempfile
import unittest
from pathlib import Path

from Deployment.cloud.mcp_gateway import MCPGateway
from Runtime.eval_harness import IsolatedLoopTeardown
from Runtime.handlers.artifact_factory import (
    generate_config_envelope,
    generate_csv_dataset,
    generate_excel_spreadsheet,
    generate_pdf_document,
    generate_presentation_deck,
    generate_word_document,
    get_mcp_artifact_tools,
    write_markdown_file,
    write_source_artifact,
)


class TestArtifactFactory(unittest.TestCase):
    def setUp(self) -> None:
        self.test_dir = tempfile.mkdtemp(prefix="srbk_artifact_test_")

    def tearDown(self) -> None:
        if os.path.isdir(self.test_dir):
            shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_01_generate_csv_dataset(self) -> None:
        records = [
            {"agent_id": "STRATEGIST", "action": "PLAN", "latency_ms": 12.4},
            {"agent_id": "WORKER", "action": "EXECUTE", "latency_ms": 28.1},
            {"agent_id": "AUDITOR", "action": "VOTE", "latency_ms": 15.0},
        ]
        res = generate_csv_dataset("telemetry_log", records, output_dir=self.test_dir)
        self.assertEqual(res["status"], "SUCCESS")
        self.assertEqual(res["format"], "csv")
        self.assertEqual(res["rowCount"], 3)
        self.assertTrue(os.path.isfile(res["filePath"]))
        self.assertGreater(res["sizeBytes"], 0)
        self.assertTrue(len(res["sha256"]) == 64)

    def test_02_generate_excel_spreadsheet(self) -> None:
        sheets = {
            "Latency": [{"node": "edge_1", "p95_ms": 18.2}],
            "Throughput": [{"node": "edge_1", "ops_per_sec": 4820}],
        }
        res = generate_excel_spreadsheet("system_metrics", sheets, output_dir=self.test_dir)
        self.assertEqual(res["status"], "SUCCESS")
        self.assertEqual(res["format"], "xlsx")
        self.assertEqual(res["sheetCount"], 2)
        self.assertTrue(os.path.isfile(res["filePath"]))
        self.assertGreater(res["sizeBytes"], 0)

    def test_03_generate_word_document(self) -> None:
        sections = [
            {
                "heading": "Executive Summary",
                "content": "Autonomous swarm has stabilized the kernel coordination boundaries.",
                "bullets": ["Zero database locks", "Shannon entropy < 0.88"],
            },
            {
                "heading": "Node Matrix",
                "table": [
                    {"Node": "STRATEGIST", "Weight": "1.25"},
                    {"Node": "WORKER", "Weight": "1.00"},
                    {"Node": "AUDITOR", "Weight": "1.10"},
                ],
            },
        ]
        res = generate_word_document("Architecture_Brief", "Kernel Spec", sections, output_dir=self.test_dir)
        self.assertEqual(res["status"], "SUCCESS")
        self.assertEqual(res["format"], "docx")
        self.assertTrue(os.path.isfile(res["filePath"]))
        self.assertGreater(res["sizeBytes"], 0)

    def test_04_write_markdown_file(self) -> None:
        content = "# System Overview\n\nAll 25 agents verified."
        meta = {"title": "System Overview", "version": "2.2.0"}
        res = write_markdown_file("README", content, metadata=meta, output_dir=self.test_dir)
        self.assertEqual(res["status"], "SUCCESS")
        self.assertEqual(res["format"], "markdown")
        self.assertTrue(os.path.isfile(res["filePath"]))

    def test_05_generate_pdf_document(self) -> None:
        paras = [
            "This report summarizes multi-agent consensus and retrieval SLAs.",
            {"heading": "HNSW Benchmarks", "content": "Retrieval latency remained under 45ms across 120 vector items."},
        ]
        res = generate_pdf_document("Audit_Report", "Enterprise Audit Report", paras, output_dir=self.test_dir)
        self.assertEqual(res["status"], "SUCCESS")
        self.assertEqual(res["format"], "pdf")
        self.assertTrue(os.path.isfile(res["filePath"]))
        self.assertGreater(res["sizeBytes"], 0)

    def test_06_generate_presentation_deck(self) -> None:
        slides = [
            {
                "title": "Roadmap 2026",
                "content": "Phase 2.3 Multi-Format Factory",
                "bullet_points": ["Native .docx / .xlsx / .pptx export", "MCP v2026.1 integration"],
            },
            {
                "title": "Decentralized Compute",
                "content": "P2P Worker Matrix active across local and Colab nodes.",
            },
        ]
        res = generate_presentation_deck("Strategy_Deck", "SarembokVE Strategy", slides, output_dir=self.test_dir)
        self.assertEqual(res["status"], "SUCCESS")
        self.assertEqual(res["format"], "pptx")
        self.assertEqual(res["slideCount"], 3)
        self.assertTrue(os.path.isfile(res["filePath"]))

    def test_07_write_source_artifact_ast_validation(self) -> None:
        valid_code = "def compute(x: int) -> int:\n    return x * 2\n"
        res = write_source_artifact("math_util.py", valid_code, output_dir=self.test_dir)
        self.assertEqual(res["status"], "SUCCESS")
        self.assertTrue(res["syntaxValidated"])

        # Invalid Python code must raise ValueError
        invalid_code = "def compute(x: return x *\n"
        with self.assertRaises(ValueError):
            write_source_artifact("bad_code.py", invalid_code, output_dir=self.test_dir)

    def test_08_generate_config_envelopes(self) -> None:
        config_data = {
            "cluster_name": "sarembok-core",
            "retries": 3,
            "security": {"tls_enabled": True},
        }
        res_json = generate_config_envelope("app_cfg", "json", config_data, output_dir=self.test_dir)
        self.assertEqual(res_json["format"], "json")
        self.assertTrue(os.path.isfile(res_json["filePath"]))

        res_tf = generate_config_envelope("main", "tf", config_data, output_dir=self.test_dir)
        self.assertEqual(res_tf["format"], "tf")
        self.assertTrue(os.path.isfile(res_tf["filePath"]))

    def test_09_mcp_gateway_registration(self) -> None:
        gateway = MCPGateway()
        tools = gateway.list_tools()
        tool_names = [t["name"] for t in tools]

        self.assertIn("generate_csv_dataset", tool_names)
        self.assertIn("generate_excel_spreadsheet", tool_names)
        self.assertIn("generate_word_document", tool_names)
        self.assertIn("write_markdown_file", tool_names)
        self.assertIn("generate_pdf_document", tool_names)
        self.assertIn("generate_presentation_deck", tool_names)
        self.assertIn("write_source_artifact", tool_names)
        self.assertIn("generate_config_envelope", tool_names)

        # Execute a tool via MCP gateway execute_tool interface
        exec_res = gateway.execute_tool("generate_csv_dataset", {
            "filename": "mcp_test_export",
            "records": [{"metric": "load", "value": 0.42}],
        })
        self.assertIn("content", exec_res)
        parsed = json.loads(exec_res["content"][0]["text"])
        self.assertEqual(parsed["status"], "SUCCESS")

    def test_10_isolated_loop_teardown_artifact_preservation(self) -> None:
        export_dir = os.path.join(self.test_dir, "preserved_exports")
        teardown = IsolatedLoopTeardown(
            session_id="test_persist",
            timeout_seconds=2.0,
            export_target_dir=export_dir,
        )

        with teardown:
            scratch = teardown.scratch_dir
            self.assertIsNotNone(scratch)
            # Create a file inside scratch that should be preserved
            artifact_file = os.path.join(scratch, "important_audit.pdf")
            with open(artifact_file, "w") as f:
                f.write("%PDF-1.4 mock content")

        # After teardown exits and scratch is removed, file must exist in export_dir
        expected_export = os.path.join(export_dir, "important_audit.pdf")
        self.assertTrue(os.path.isfile(expected_export))


if __name__ == "__main__":
    unittest.main()
