# ============================================================================
# Copyright (c) 2026 Timothy Hall Jr. / Jetsontech. All rights reserved.
#
# This source code is licensed under the Business Source License 1.1 (BSL).
# Commercial use, deployment in production environments, or redistribution 
# for profit is strictly prohibited without a valid commercial license.
#
# For commercial inquiries, licensing, or partnerships, contact the Licensor.
# ============================================================================

"""Sarembok Runtime RPC Server - High-Performance Vector and Execution Bridge.

Enforces strict 768-dimensional float32 vector database contract alignment,
validates payload geometry, and routes semantic queries to the L2 HNSW vector index.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Union

try:
    import numpy as np
except ImportError:
    np = None

from Runtime.dual_tier_memory import DualTierMemoryRouter, HNSWVectorIndex

logger = logging.getLogger("sarembok.rpc_server")

VECTOR_DATABASE_DIM = 768


class VectorValidationError(ValueError):
    """Raised when vector payload violates the 768-dimensional float32 database contract."""
    pass


class SarembokRpcServer:
    """Enterprise RPC Server handling high-throughput vector queries and memory routing."""

    def __init__(self, memory_router: Optional[DualTierMemoryRouter] = None):
        self.memory_router = memory_router or DualTierMemoryRouter()
        # Initialize dedicated 768-dimensional HNSW index for high-dimensional embedding space
        self.hnsw_index = HNSWVectorIndex(dim=VECTOR_DATABASE_DIM, m=16, ef_construction=64, ef_search=64)

    def validate_and_cast_vector(self, raw_vector: Union[List[float], Any]) -> Any:
        """Validates and explicitly casts input vector to float32 with strict 768-dim shape enforcement."""
        if raw_vector is None:
            raise VectorValidationError("Vector payload cannot be null or empty.")

        if np is not None:
            try:
                vec = np.asarray(raw_vector, dtype=np.float32)
            except Exception as exc:
                raise VectorValidationError(f"Failed to cast vector to float32: {exc}") from exc

            if vec.ndim != 1 or vec.shape[0] != VECTOR_DATABASE_DIM:
                raise VectorValidationError(
                    f"Vector shape mismatch: expected ({VECTOR_DATABASE_DIM},), got {vec.shape}"
                )
            return vec
        else:
            if not isinstance(raw_vector, (list, tuple)):
                raise VectorValidationError("Vector payload must be an array or list.")
            if len(raw_vector) != VECTOR_DATABASE_DIM:
                raise VectorValidationError(
                    f"Vector dimension mismatch: expected {VECTOR_DATABASE_DIM}, got {len(raw_vector)}"
                )
            return [float(x) for x in raw_vector]

    def vector_insert_and_query(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """RPC Endpoint: vector_insert_and_query.
        
        Inserts a 768-dimensional float32 vector and/or queries the HNSW router.
        """
        doc_id = params.get("id") or params.get("doc_id") or "rpc_vec"
        metadata = params.get("metadata") or {}
        inserted = False

        # 1. Process Vector Insertion (if vector payload provided)
        if "vector" in params:
            vector_arr = self.validate_and_cast_vector(params["vector"])
            vec_list = vector_arr.tolist() if np is not None and isinstance(vector_arr, np.ndarray) else list(vector_arr)
            self.hnsw_index.nodes[doc_id] = (vec_list, metadata)
            inserted = True
        elif "document" in params:
            # Fallback text embedding projection into 768-dim space
            text = str(params["document"])
            self.hnsw_index.insert(doc_id=doc_id, text=text, metadata=metadata)
            inserted = True

        # 2. Process Vector Query
        query_results = []
        if "query_vector" in params:
            query_arr = self.validate_and_cast_vector(params["query_vector"])
            query_list = query_arr.tolist() if np is not None and isinstance(query_arr, np.ndarray) else list(query_arr)
            # Search using explicit query vector
            scored = []
            for d_id, (node_vec, node_meta) in self.hnsw_index.nodes.items():
                sim = self.hnsw_index._cosine_similarity(query_list, node_vec)
                scored.append({"id": d_id, "score": round(sim, 4), "metadata": node_meta})
            scored.sort(key=lambda x: x["score"], reverse=True)
            top_k = int(params.get("top_k", 5))
            query_results = scored[:top_k]
        elif "query" in params:
            top_k = int(params.get("top_k", 5))
            res = self.hnsw_index.search(params["query"], top_k=top_k)
            query_results = [{"id": r["doc_id"], "score": r["similarity"], "metadata": r["metadata"]} for r in res]

        return {
            "status": "OK",
            "inserted": inserted,
            "id": doc_id,
            "dimensions": VECTOR_DATABASE_DIM,
            "results": query_results,
        }

    def dispatch(self, method: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Dispatches RPC methods supported by the Sarembok Runtime RPC Server."""
        if method in ("vector_insert_and_query", "VectorInsertAndQuery"):
            return self.vector_insert_and_query(params)
        raise ValueError(f"Unknown RPC method: {method}")


__all__ = [
    "SarembokRpcServer",
    "VectorValidationError",
    "VECTOR_DATABASE_DIM",
]
