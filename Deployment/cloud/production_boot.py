# ============================================================================
# Copyright (c) 2026 Timothy Hall Jr. / Jetsontech. All rights reserved.
#
# This source code is licensed under the Business Source License 1.1 (BSL).
# Commercial use, deployment in production environments, or redistribution 
# for profit is strictly prohibited without a valid commercial license.
#
# For commercial inquiries, licensing, or partnerships, contact the Licensor.
# ============================================================================

"""SarembokVE production entrypoint.

Wraps server.py with production safeguards:
- removes synthetic/demo workers from the registry
- refuses image generation unless a real backend is configured and reachable
- refuses YouTube results that are known hard-coded fallbacks
- refuses compute tasks when no real GPU worker is registered
- appends a short honesty guard to every model request
"""
from __future__ import annotations

import asyncio

import server


SYNTHETIC_WORKER_IDS = {"sarembok-edge-frontier-01"}
KNOWN_FALLBACK_VIDEO_IDS = {"4xDzrJKXOOY", "jfKfPfyJRdk"}

HONESTY_GUARD = """
SAREMBOKVE HONESTY RULES (highest priority)
- Only state facts supported by the runtime context, tool results, or retrieved evidence in this request.
- Do not claim capabilities that the runtime context does not show as available. If something is unavailable, say so plainly.
- Third-party models and services must be named as such. Never call them SarembokVE proprietary technology.
- For a URL or research request, use retrieved evidence. If none was retrieved, say live evidence was not retrieved.
- Never invent citations, papers, links, media IDs, prices, or benchmark numbers.
""".strip()


def _remove_synthetic_workers() -> None:
    try:
        marks = ",".join("?" for _ in SYNTHETIC_WORKER_IDS)
        server.store.db.execute(
            f"DELETE FROM workers WHERE worker_id IN ({marks})", tuple(SYNTHETIC_WORKER_IDS)
        )
        server.store.db.commit()
    except Exception as exc:
        server.LOG.warning("synthetic worker cleanup failed: %s", exc)


_ORIGINAL_IMAGE_GENERATION = server.resolve_image_generation
_ORIGINAL_YOUTUBE = server.resolve_youtube_search
_ORIGINAL_PROVIDER_GENERATE = server.PROVIDER_ROUTER.generate
_ORIGINAL_DISPATCH = server.dispatch


def _image_backend_ready() -> bool:
    status = server.get_visual_engine_status()
    if (status.get("tier1_sovereign") or {}).get("status") == "ONLINE":
        return True
    tier2 = status.get("tier2_enterprise") or {}
    if any((tier2.get(name) or {}).get("configured") for name in ("fal", "together", "openai")):
        return True
    return (status.get("tier3_community") or {}).get("status") == "ONLINE"


def _strict_image_generation(*args, **kwargs):
    if not _image_backend_ready():
        raise RuntimeError("image_generation_unavailable: no image backend is configured")
    return _ORIGINAL_IMAGE_GENERATION(*args, **kwargs)


def _strict_youtube(query: str):
    q = (query or "").strip()
    if not q:
        raise ValueError("media_query_required")
    cached = getattr(server, "_YT_CACHE", {}).get(q.lower())
    if cached:
        return {"videoId": cached, "url": f"https://www.youtube.com/watch?v={cached}", "title": q}
    result = _ORIGINAL_YOUTUBE(q)
    if result and result.get("videoId") in KNOWN_FALLBACK_VIDEO_IDS:
        search_url = f"https://www.youtube.com/results?search_query={server.urllib.parse.quote(q)}"
        return {"videoId": None, "url": search_url, "searchUrl": search_url,
                "title": f"Search results for {q}", "verified": False, "matchScore": 0.0}
    return result


def _guarded_generate(system_prompt, user_prompt, messages, **kwargs):
    return _ORIGINAL_PROVIDER_GENERATE(f"{system_prompt}\n\n{HONESTY_GUARD}", user_prompt, messages, **kwargs)


def _guarded_dispatch(method, params):
    if method == "ExecuteComputeTask" and not server.select_worker("gpu"):
        raise RuntimeError("compute_worker_not_available: no online GPU worker is registered")
    return _ORIGINAL_DISPATCH(method, params)


server.ensure_sovereign_worker = _remove_synthetic_workers
server.resolve_image_generation = _strict_image_generation
server.resolve_youtube_search = _strict_youtube
server.PROVIDER_ROUTER.generate = _guarded_generate
server.dispatch = _guarded_dispatch
_remove_synthetic_workers()


if __name__ == "__main__":
    asyncio.run(server.main())
