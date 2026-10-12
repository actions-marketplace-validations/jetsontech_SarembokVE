"""Sarembok Model Context Protocol (MCP) Gateway.

Implements the MCP JSON-RPC surface and exposes Sarembok skills as standard
MCP tools. Runtime resources are derived from live state; this module never
hard-codes worker or GPU availability.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Callable

try:
    from skills_engine import get_skills_engine
except ImportError:
    try:
        from Deployment.cloud.skills_engine import get_skills_engine
    except ImportError:
        from .skills_engine import get_skills_engine

logger = logging.getLogger("sarembok.mcp_gateway")

MCP_PROTOCOL_VERSION = "2026.1"
SUPPORTED_PROTOCOL_VERSIONS = ["2026.1", "2024-11-05"]
SERVER_INFO = {"name": "sarembok-mcp-gateway", "version": "2.2.0", "mcpSpec": "v2026.1"}


class MCPGateway:
    def __init__(self, db_store: Any = None) -> None:
        self.skills_engine = get_skills_engine()
        self.store = db_store
        self._custom_tool_handlers: dict[str, Callable[[dict[str, Any]], Any]] = {}
        self._custom_tool_metadata: dict[str, dict[str, Any]] = {}

    def register_tool_handler(self, tool_name: str, handler: Callable[[dict[str, Any]], Any]) -> None:
        """Register a handler for a tool by name."""
        self._custom_tool_handlers[tool_name] = handler
        if tool_name not in self._custom_tool_metadata:
            self._custom_tool_metadata[tool_name] = {
                "name": tool_name,
                "description": f"Dynamic MCP tool: {tool_name}",
                "inputSchema": {"type": "object", "properties": {}},
                "capability": "compute",
            }

    def register_tool(
        self,
        name: str,
        description: str,
        input_schema: dict[str, Any],
        handler: Callable[[dict[str, Any]], Any],
        capability: str = "compute",
    ) -> None:
        """Register a tool with full MCP v2026.1 JSON schema metadata and required capability."""
        tool_name = str(name).strip()
        self._custom_tool_handlers[tool_name] = handler
        self._custom_tool_metadata[tool_name] = {
            "name": tool_name,
            "description": description or f"Dynamic MCP tool: {tool_name}",
            "inputSchema": input_schema if isinstance(input_schema, dict) else {"type": "object", "properties": {}},
            "capability": capability or "compute",
        }

    def list_tools(self) -> list[dict[str, Any]]:
        """Return all discovered skills and custom registered tools in MCP v2026.1 format."""
        tools: list[dict[str, Any]] = []
        # 1. Tools discovered by skills engine
        if hasattr(self.skills_engine, "get_mcp_tools"):
            tools.extend(self.skills_engine.get_mcp_tools())
        # 2. Dynamically registered custom tools
        for tool_name, meta in self._custom_tool_metadata.items():
            if not any(t.get("name") == tool_name for t in tools):
                tools.append({
                    "name": tool_name,
                    "description": meta.get("description", ""),
                    "inputSchema": meta.get("inputSchema", {"type": "object", "properties": {}}),
                })
        return tools

    def has_tool(self, tool_name: str) -> bool:
        """Check if tool is known via custom registration or skills engine."""
        clean = str(tool_name).strip()
        if clean in self._custom_tool_handlers or clean in self._custom_tool_metadata:
            return True
        if hasattr(self.skills_engine, "get_skill") and self.skills_engine.get_skill(clean) is not None:
            return True
        return False

    def get_tool_capability(self, tool_name: str) -> str:
        """Return the execution capability required for this tool."""
        clean = str(tool_name).strip()
        if clean in self._custom_tool_metadata:
            return str(self._custom_tool_metadata[clean].get("capability", "compute"))
        if hasattr(self.skills_engine, "get_skill"):
            skill = self.skills_engine.get_skill(clean)
            if skill and hasattr(skill, "domain"):
                return str(skill.domain)
        return "compute"

    def execute_tool(self, tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        """Direct execution interface for workers and agent task routers."""
        params = {"name": tool_name, "arguments": arguments}
        return self._call_tool(params)

    def handle_request(self, payload: dict[str, Any] | str) -> dict[str, Any] | None:
        if isinstance(payload, str):
            try:
                data = json.loads(payload)
            except json.JSONDecodeError as exc:
                return {"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": f"Parse error: {exc}"}}
        else:
            data = payload

        req_id = data.get("id")
        method = data.get("method")
        params = data.get("params") or {}

        if req_id is None and method == "notifications/initialized":
            logger.info("MCP client initialized notification received.")
            return None
        if not method:
            return {"jsonrpc": "2.0", "id": req_id, "error": {"code": -32600, "message": "Invalid Request: missing method"}}

        try:
            return {"jsonrpc": "2.0", "id": req_id, "result": self._dispatch_method(method, params)}
        except Exception as exc:
            logger.error("Error handling MCP method %s: %s", method, exc)
            return {"jsonrpc": "2.0", "id": req_id, "error": {"code": -32603, "message": str(exc)}}

    def _dispatch_method(self, method: str, params: dict[str, Any]) -> dict[str, Any]:
        if method == "initialize":
            req_ver = str(params.get("protocolVersion") or "").strip()
            negotiated_version = req_ver if req_ver in SUPPORTED_PROTOCOL_VERSIONS else MCP_PROTOCOL_VERSION
            return {
                "protocolVersion": negotiated_version,
                "capabilities": {
                    "tools": {"listChanged": True},
                    "resources": {"subscribe": True, "listChanged": False},
                    "prompts": {"listChanged": False},
                },
                "serverInfo": SERVER_INFO,
            }
        if method == "ping":
            return {}
        if method == "tools/list":
            return {"tools": self.list_tools()}
        if method == "tools/call":
            return self._call_tool(params)
        if method == "resources/list":
            return {"resources": self._resources()}
        if method == "resources/read":
            return self._read_resource(params.get("uri", ""))
        raise ValueError(f"Unsupported MCP method: {method}")

    def _call_tool(self, params: dict[str, Any]) -> dict[str, Any]:
        tool_name = params.get("name", "")
        arguments = params.get("arguments") or {}
        if tool_name in self._custom_tool_handlers:
            output = self._custom_tool_handlers[tool_name](arguments)
            text_out = output if isinstance(output, str) else json.dumps(output, indent=2)
            return {"content": [{"type": "text", "text": text_out}], "isError": False}

        result = self.skills_engine.execute_skill(tool_name, arguments)
        if not result.get("success"):
            return {"content": [{"type": "text", "text": result.get("error", "Skill execution failed")}], "isError": True}
        out = result.get("output", "")
        text_out = out if isinstance(out, str) else json.dumps(out, indent=2)
        return {"content": [{"type": "text", "text": text_out}], "isError": False}

    def _resources(self) -> list[dict[str, Any]]:
        return [
            {
                "uri": "sarembok://cluster/workers",
                "name": "Compute Workers",
                "description": "Live registered worker status. GPU availability is reported only when a live worker advertises it.",
                "mimeType": "application/json",
            },
            {
                "uri": "sarembok://memory/entries",
                "name": "Persistent Memory",
                "description": "Stored long-term runtime memory entries.",
                "mimeType": "application/json",
            },
            {
                "uri": "sarembok://system/health",
                "name": "Runtime Health",
                "description": "Authoritative runtime and MCP state.",
                "mimeType": "application/json",
            },
        ]

    def _worker_snapshot(self) -> dict[str, Any]:
        workers: list[dict[str, Any]] = []
        if self.store and hasattr(self.store, "db"):
            try:
                rows = self.store.db.execute("SELECT worker_id, status, last_heartbeat FROM workers").fetchall()
                workers = [{"id": r[0], "status": r[1], "lastHeartbeat": r[2]} for r in rows]
            except Exception as exc:
                logger.debug("Worker snapshot unavailable: %s", exc)

        active = [w for w in workers if str(w.get("status", "")).upper() in {"ONLINE", "READY", "ACTIVE"}]
        gpu_workers = [
            w for w in active
            if any(token in json.dumps(w).lower() for token in ("gpu", "cuda", "nvidia"))
        ]
        return {
            "status": "ONLINE" if active else "NO_ACTIVE_WORKERS",
            "registeredWorkers": len(workers),
            "activeWorkers": len(active),
            "gpuWorkers": len(gpu_workers),
            "workers": workers,
        }

    def _read_resource(self, uri: str) -> dict[str, Any]:
        if uri == "sarembok://cluster/workers":
            data = self._worker_snapshot()
        elif uri == "sarembok://memory/entries":
            data: list[dict[str, Any]] = []
            if self.store and hasattr(self.store, "db"):
                try:
                    rows = self.store.db.execute("SELECT key, value, tier, created_at FROM memories ORDER BY created_at DESC LIMIT 20").fetchall()
                    data = [{"key": r[0], "value": r[1], "tier": r[2], "createdAt": r[3]} for r in rows]
                except Exception as exc:
                    logger.debug("Memory resource unavailable: %s", exc)
        elif uri == "sarembok://system/health":
            data = {"service": "sarembok-ve-cloud-runtime", "status": "ONLINE", "mcp": "enabled"}
        else:
            raise ValueError(f"Resource not found: {uri}")

        return {"contents": [{"uri": uri, "mimeType": "application/json", "text": json.dumps(data, indent=2)}]}


_GLOBAL_MCP_GATEWAY: MCPGateway | None = getattr(__import__("sys"), "_sarembok_global_mcp_gateway", None)


def get_mcp_gateway(store: Any = None) -> MCPGateway:
    global _GLOBAL_MCP_GATEWAY
    sys = __import__("sys")
    if _GLOBAL_MCP_GATEWAY is None:
        _GLOBAL_MCP_GATEWAY = getattr(sys, "_sarembok_global_mcp_gateway", None)
    if _GLOBAL_MCP_GATEWAY is None:
        _GLOBAL_MCP_GATEWAY = MCPGateway(db_store=store)
        setattr(sys, "_sarembok_global_mcp_gateway", _GLOBAL_MCP_GATEWAY)
    elif store is not None:
        _GLOBAL_MCP_GATEWAY.store = store
    return _GLOBAL_MCP_GATEWAY
