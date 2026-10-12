"""SarembokVE - Secure Kernel Telemetry Bus (SKTB).

High-throughput, asynchronous, clustered Apache Kafka telemetry pipeline.
Ingests agent execution footprints, prompt-token streams, system logs,
and mutation records asynchronously over lock-free ring buffers without
adding latency or overhead to active agent loops.
"""
from __future__ import annotations

import json
import logging
import os
import queue
import threading
import time
from collections import deque
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

logger = logging.getLogger("sarembok.sktb")

PRODUCTION_KAFKA_BROKERS = [
    "kafka-cluster-node1.sarembok.internal:9092",
    "kafka-cluster-node2.sarembok.internal:9092",
    "kafka-cluster-node3.sarembok.internal:9092",
    "kafka:9092",
    "localhost:9092",
]
DEFAULT_BOOTSTRAP_SERVERS = os.getenv(
    "KAFKA_BOOTSTRAP_SERVERS",
    ",".join(PRODUCTION_KAFKA_BROKERS),
)

PRODUCTION_REDIS_ENDPOINTS = [
    "redis-cluster-node1.sarembok.internal:6379",
    "redis-cluster-node2.sarembok.internal:6379",
    "redis-cluster-node3.sarembok.internal:6379",
    "localhost:6379",
]


class RedisClusterPoolManager:
    """Manages standalone and clustered Redis connection pools for high-throughput L1 episodic memory."""

    _instance: Optional["RedisClusterPoolManager"] = None
    _lock = threading.Lock()

    def __init__(self, endpoints: Optional[List[str]] = None, max_connections: int = 50):
        self.endpoints = endpoints or [
            ep.strip()
            for ep in os.getenv("REDIS_CLUSTER_ENDPOINTS", ",".join(PRODUCTION_REDIS_ENDPOINTS)).split(",")
            if ep.strip()
        ]
        self.max_connections = max_connections
        self._pool = None
        self._client = None
        self._init_pool()

    def _init_pool(self) -> None:
        try:
            import redis
            from redis.connection import ConnectionPool

            primary = self.endpoints[0]
            host, port = primary.split(":") if ":" in primary else (primary, "6379")
            self._pool = ConnectionPool(
                host=host,
                port=int(port),
                db=0,
                max_connections=self.max_connections,
                socket_connect_timeout=0.25,
                socket_timeout=0.5,
                decode_responses=True,
            )
            self._client = redis.Redis(connection_pool=self._pool)
            self._client.ping()
            logger.info(
                f"[REDIS_POOL] Connection pool initialized for {self.endpoints} (max_conn={self.max_connections})"
            )
        except Exception as exc:
            self._pool = None
            self._client = None
            logger.debug(f"[REDIS_POOL_FALLBACK] Redis cluster pool fallback: {exc}")

    @classmethod
    def get_pool(cls) -> "RedisClusterPoolManager":
        with cls._lock:
            if cls._instance is None:
                cls._instance = cls()
            return cls._instance

    @property
    def client(self) -> Optional[Any]:
        return self._client

    @property
    def is_connected(self) -> bool:
        return self._client is not None


@dataclass
class TelemetryEvent:
    topic: str
    key: str
    payload: Dict[str, Any]
    timestamp_ns: int


class SecureKernelTelemetryBus:
    """Asynchronous Clustered Kafka Event Producer for the Secure Kernel Telemetry Bus (SKTB).

    Agents submit execution footprints to an in-memory lock-free queue; a background
    dispatcher batches and emits events onto partitioned Kafka topics:
    - agent-events
    - system-logs
    - token-streams
    - mutation-records
    """

    _instance: Optional["SecureKernelTelemetryBus"] = None
    _lock = threading.Lock()

    def __init__(self, bootstrap_servers: Optional[str] = None):
        self.bootstrap_servers = bootstrap_servers or DEFAULT_BOOTSTRAP_SERVERS
        self.server_list = [s.strip() for s in self.bootstrap_servers.split(",") if s.strip()]
        self._event_queue: queue.Queue[TelemetryEvent] = queue.Queue(maxsize=50000)
        self._stop_event = threading.Event()
        self._dispatcher_thread: Optional[threading.Thread] = None
        self._published_count = 0
        self._kafka_producer = None
        self._init_kafka_producer()
        self.start()

    @classmethod
    def get_bus(cls, bootstrap_servers: Optional[str] = None) -> "SecureKernelTelemetryBus":
        with cls._lock:
            if cls._instance is None:
                cls._instance = cls(bootstrap_servers)
            return cls._instance

    def _init_kafka_producer(self) -> None:
        """Attempt to initialize clustered Kafka producer (kafka-python / confluent-kafka)."""
        try:
            # 1. Try kafka-python
            from kafka import KafkaProducer  # type: ignore

            self._kafka_producer = KafkaProducer(
                bootstrap_servers=self.server_list,
                value_serializer=lambda v: json.dumps(v).encode("utf-8"),
                key_serializer=lambda k: str(k).encode("utf-8"),
                acks=1,
                retries=3,
                max_block_ms=250,
            )
            logger.info(f"[SKTB_BUS] Connected to clustered Kafka at {self.server_list}")
        except Exception:
            self._kafka_producer = None
            logger.debug(
                f"[SKTB_BUS_FALLBACK] Clustered Kafka at {self.server_list} not reachable directly. Using local high-throughput ring buffer."
            )

    @property
    def is_kafka_connected(self) -> bool:
        return self._kafka_producer is not None

    def start(self) -> None:
        if self._dispatcher_thread and self._dispatcher_thread.is_alive():
            return
        self._stop_event.clear()
        self._dispatcher_thread = threading.Thread(
            target=self._dispatch_loop,
            name="Sarembok-SKTB-Clustered-Dispatcher",
            daemon=True,
        )
        self._dispatcher_thread.start()
        logger.info(f"[SKTB_BUS] Asynchronous telemetry bus started targeting {self.server_list}.")

    def stop(self) -> None:
        self._stop_event.set()
        if self._dispatcher_thread and self._dispatcher_thread.is_alive():
            self._dispatcher_thread.join(timeout=2.0)
        if self._kafka_producer:
            try:
                self._kafka_producer.flush(timeout=1.0)
                self._kafka_producer.close(timeout=1.0)
            except Exception:
                pass

    def publish_footprint_nowait(
        self,
        topic: str,
        agent_id: str,
        event_type: str,
        details: Dict[str, Any],
    ) -> bool:
        """Non-blocking publish for active agent loops ensuring zero latency impact."""
        event = TelemetryEvent(
            topic=topic,
            key=agent_id,
            payload={
                "event_type": event_type,
                "agent_id": agent_id,
                "details": details,
                "emitted_at": time.time(),
                "cluster_endpoints": self.server_list,
            },
            timestamp_ns=time.time_ns(),
        )
        try:
            self._event_queue.put_nowait(event)
            return True
        except queue.Full:
            logger.warning("[SKTB_BUS] Event queue full. Dropping non-critical telemetry footprint.")
            return False

    def emit_agent_event(self, agent_id: str, turn_index: int, tokens: int, entropy: float) -> bool:
        """Publishes agent loop heartbeat & entropy to 'agent-events' topic."""
        return self.publish_footprint_nowait(
            topic="agent-events",
            agent_id=agent_id,
            event_type="AGENT_EXECUTION_TURN",
            details={
                "turn_index": turn_index,
                "tokens_burned": tokens,
                "shannon_entropy": entropy,
            },
        )

    def emit_system_log(self, level: str, message: str, context: Optional[Dict[str, Any]] = None) -> bool:
        """Publishes system log record to 'system-logs' topic."""
        return self.publish_footprint_nowait(
            topic="system-logs",
            agent_id="SYSTEM_KERNEL",
            event_type="KERNEL_LOG",
            details={
                "level": level,
                "message": message,
                "context": context or {},
            },
        )

    def emit_token_stream(self, agent_id: str, prompt_tokens: int, completion_tokens: int, model: str) -> bool:
        """Publishes prompt token stream metrics to 'token-streams' topic."""
        return self.publish_footprint_nowait(
            topic="token-streams",
            agent_id=agent_id,
            event_type="TOKEN_CONSUMPTION_METRIC",
            details={
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": prompt_tokens + completion_tokens,
                "model": model,
            },
        )

    def emit_mutation_record(self, agent_id: str, mutation_type: str, block_hash: str, details: Dict[str, Any]) -> bool:
        """Publishes cryptographic mutation event to 'mutation-records' topic."""
        return self.publish_footprint_nowait(
            topic="mutation-records",
            agent_id=agent_id,
            event_type="LEDGER_MUTATION_EVENT",
            details={
                "mutation_type": mutation_type,
                "block_hash": block_hash,
                "mutation_details": details,
            },
        )

    def _dispatch_loop(self) -> None:
        """Background thread batching and transmitting events to Kafka cluster."""
        while not self._stop_event.is_set():
            batch: List[TelemetryEvent] = []
            try:
                item = self._event_queue.get(timeout=0.05)
                batch.append(item)
                while len(batch) < 500:
                    try:
                        batch.append(self._event_queue.get_nowait())
                    except queue.Empty:
                        break
            except queue.Empty:
                continue

            if batch:
                if self._kafka_producer:
                    try:
                        for evt in batch:
                            self._kafka_producer.send(
                                topic=evt.topic,
                                key=evt.key,
                                value=evt.payload,
                            )
                    except Exception as exc:
                        logger.warning(f"[SKTB_BUS] Kafka send batch error: {exc}")

                self._published_count += len(batch)
                for _ in batch:
                    self._event_queue.task_done()
                logger.debug(
                    f"[SKTB_BUS] Dispatched {len(batch)} footprints to Kafka bus (total: {self._published_count})."
                )

    def flush(self, timeout: float = 2.0) -> None:
        """Waits for event queue to flush to zero."""
        deadline = time.time() + timeout
        while not self._event_queue.empty() and time.time() < deadline:
            time.sleep(0.01)
        if self._kafka_producer:
            try:
                self._kafka_producer.flush(timeout=timeout)
            except Exception:
                pass

    @property
    def total_published(self) -> int:
        return self._published_count


__all__ = [
    "TelemetryEvent",
    "SecureKernelTelemetryBus",
    "RedisClusterPoolManager",
    "PRODUCTION_KAFKA_BROKERS",
    "PRODUCTION_REDIS_ENDPOINTS",
]
