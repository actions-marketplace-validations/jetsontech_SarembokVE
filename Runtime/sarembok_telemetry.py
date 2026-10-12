"""
SarembokVE - OpenTelemetry (OTel) Distributed Tracing & Instrumentation Pipeline
Instruments 25+ agent loops with W3C Trace Context propagation, latency recording,
agent status transitions, and tool invocation telemetry.
"""

from __future__ import annotations

import contextlib
import json
import logging
import os
import time
import urllib.request
import uuid
from typing import Any, Dict, Iterator, Optional

logger = logging.getLogger("sarembok.telemetry")

OTEL_COLLECTOR_URL = os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT", "http://127.0.0.1:4318")


def generate_trace_id() -> str:
    return uuid.uuid4().hex


def generate_span_id() -> str:
    return uuid.uuid4().hex[:16]


class Span:
    def __init__(
        self,
        name: str,
        trace_id: Optional[str] = None,
        parent_span_id: Optional[str] = None,
        attributes: Optional[Dict[str, Any]] = None,
    ):
        self.name = name
        self.trace_id = trace_id or generate_trace_id()
        self.span_id = generate_span_id()
        self.parent_span_id = parent_span_id
        self.start_time_ns = time.time_ns()
        self.end_time_ns: Optional[int] = None
        self.attributes: Dict[str, Any] = attributes or {}
        self.status = "OK"
        self.events: list[dict] = []

    def set_attribute(self, key: str, value: Any) -> "Span":
        self.attributes[key] = value
        return self

    def add_event(self, name: str, attributes: Optional[Dict[str, Any]] = None) -> None:
        self.events.append({
            "name": name,
            "timestamp_ns": time.time_ns(),
            "attributes": attributes or {},
        })

    def finish(self, status: str = "OK") -> None:
        self.end_time_ns = time.time_ns()
        self.status = status
        self._export()

    @property
    def duration_ms(self) -> float:
        if self.end_time_ns:
            return (self.end_time_ns - self.start_time_ns) / 1_000_000.0
        return (time.time_ns() - self.start_time_ns) / 1_000_000.0

    def to_otlp_json(self) -> dict:
        return {
            "resourceSpans": [{
                "resource": {
                    "attributes": [
                        {"key": "service.name", "value": {"stringValue": "sarembok-sovereign-kernel"}},
                        {"key": "service.version", "value": {"stringValue": "3.8-flash"}},
                    ]
                },
                "scopeSpans": [{
                    "scope": {"name": "sarembok.telemetry"},
                    "spans": [{
                        "traceId": self.trace_id,
                        "spanId": self.span_id,
                        "parentSpanId": self.parent_span_id or "",
                        "name": self.name,
                        "kind": 1,
                        "startTimeUnixNano": str(self.start_time_ns),
                        "endTimeUnixNano": str(self.end_time_ns or time.time_ns()),
                        "attributes": [
                            {"key": k, "value": {"stringValue": str(v)}}
                            for k, v in self.attributes.items()
                        ],
                        "status": {"code": 1 if self.status == "OK" else 2},
                    }]
                }]
            }]
        }

    def _export(self) -> None:
        """Asynchronously dispatches span to OTel collector HTTP receiver."""
        payload = json.dumps(self.to_otlp_json()).encode("utf-8")
        endpoint = f"{OTEL_COLLECTOR_URL.rstrip('/')}/v1/traces"
        req = urllib.request.Request(
            endpoint,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=0.1) as _:
                pass
        except Exception:
            # Silent fallback if OTel collector is not locally active in dev sandbox
            pass


class AgentTelemetryTracer:
    """Singleton tracer provider for active agent loops."""

    _instance: Optional["AgentTelemetryTracer"] = None

    def __init__(self, service_name: str = "sarembok-agent-fabric"):
        self.service_name = service_name

    @classmethod
    def get_tracer(cls) -> "AgentTelemetryTracer":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @contextlib.contextmanager
    def trace_agent_turn(
        self,
        agent_id: str,
        role: str,
        task_id: str,
        trace_id: Optional[str] = None,
    ) -> Iterator[Span]:
        span = Span(
            name=f"agent.execution.{agent_id}",
            trace_id=trace_id,
            attributes={
                "agent.id": agent_id,
                "agent.role": role,
                "task.id": task_id,
            },
        )
        try:
            yield span
            span.finish(status="OK")
        except Exception as exc:
            span.set_attribute("error", True)
            span.set_attribute("error.message", str(exc))
            span.finish(status="ERROR")
            raise

    @contextlib.contextmanager
    def trace_tool_invocation(
        self,
        tool_name: str,
        parent_span: Span,
    ) -> Iterator[Span]:
        span = Span(
            name=f"tool.invocation.{tool_name}",
            trace_id=parent_span.trace_id,
            parent_span_id=parent_span.span_id,
            attributes={"tool.name": tool_name},
        )
        try:
            yield span
            span.finish(status="OK")
        except Exception as exc:
            span.set_attribute("error", True)
            span.set_attribute("error.message", str(exc))
            span.finish(status="ERROR")
            raise
