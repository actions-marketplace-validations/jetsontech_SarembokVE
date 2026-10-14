#!/usr/bin/env python3
"""SarembokVE — Local Inference Acceptance & Regression Test Suite."""

import asyncio
import json
import os
import sqlite3
import time
import urllib.request
import websockets

AUTH_TOKEN = os.getenv("SAREMBOK_AUTH_TOKEN", "SqExWVt8fZF67e5azVC5f429cClU6Yje7zqZYya-hAtbme7MlonOgqU-Vd31PCd_")
WS_URL = "ws://127.0.0.1:9000"
DB_PATH = os.getenv("SAREMBOK_DB_PATH", "/data/sarembok_cloud.db")
VOICE_URL = os.getenv("SAREMBOK_VOICE_URL", "http://sarembok-voice:9200")


async def test_1_normal_inference():
    print("\n--- TEST 1: Normal Local Inference via SarembokChat ---")
    async with websockets.connect(WS_URL, max_size=1048576) as ws:
        req = {
            "jsonrpc": "2.0",
            "id": "test-local-norm-1",
            "method": "SarembokChat",
            "params": {
                "prompt": "What is the capital city of France? Answer in a complete sentence.",
                "model": "local",
                "authToken": AUTH_TOKEN,
                "sessionId": "test-session-local-1",
            }
        }
        t0 = time.time()
        await ws.send(json.dumps(req))
        resp_raw = await ws.recv()
        elapsed = time.time() - t0
        resp = json.loads(resp_raw)

        assert "result" in resp, f"Expected result in response: {resp}"
        res = resp["result"]
        print(f"  [OK] Response received in {elapsed*1000:.1f}ms")
        print(f"  [OK] Source: {res.get('source')} | Model: {res.get('model')}")
        print(f"  [OK] Text: {res.get('response', '').strip()[:80]}")
        assert res.get("source") == "LocalGemma", f"Expected source LocalGemma, got {res.get('source')}"
        return {"ok": True, "latency_ms": elapsed * 1000, "source": res.get("source"), "model": res.get("model")}


async def test_2_streaming_inference():
    print("\n--- TEST 2: Streaming Local Inference via SarembokChat ---")
    async with websockets.connect(WS_URL, max_size=1048576) as ws:
        req = {
            "jsonrpc": "2.0",
            "id": "test-local-stream-2",
            "method": "SarembokChat",
            "params": {
                "prompt": "Count from 1 to 5.",
                "model": "local",
                "stream": True,
                "authToken": AUTH_TOKEN,
                "sessionId": "test-session-local-2",
            }
        }
        t0 = time.time()
        await ws.send(json.dumps(req))
        chunks = []
        ttft = None
        final_result = None

        while True:
            msg_raw = await ws.recv()
            msg = json.loads(msg_raw)
            if msg.get("method") == "SarembokChat.delta":
                if ttft is None:
                    ttft = (time.time() - t0) * 1000
                chunks.append(msg.get("params", {}).get("text", ""))
            elif "result" in msg:
                final_result = msg["result"]
                break
            elif "error" in msg:
                raise RuntimeError(f"Streaming error: {msg['error']}")

        elapsed = (time.time() - t0) * 1000
        full_text = "".join(chunks)
        print(f"  [OK] Streamed {len(chunks)} deltas")
        print(f"  [OK] TTFT: {ttft:.1f}ms | Total Latency: {elapsed:.1f}ms")
        print(f"  [OK] Assembled Stream Output: {full_text.strip()[:80]}")
        assert len(chunks) > 0, "No stream chunks received"
        assert final_result is not None, "Final result not received"
        return {"ok": True, "ttft_ms": ttft, "total_ms": elapsed, "chunks": len(chunks)}


async def test_3_structured_tool_calls():
    print("\n--- TEST 3: Structured Tool Calls via Runtime ---")
    session_id = f"test-session-local-3-{time.time_ns()}"

    try:
        async with websockets.connect(WS_URL, max_size=1048576) as ws:
            req = {
                "jsonrpc": "2.0",
                "id": "test-tool-3",
                "method": "SarembokChat",
                "params": {
                    "prompt": "Remember that server alpha is configured for CPU inference only",
                    "model": "local",
                    "authToken": AUTH_TOKEN,
                    "sessionId": session_id,
                }
            }
            await ws.send(json.dumps(req))
            resp = json.loads(await ws.recv())
            assert "result" in resp, f"Expected result: {resp}"
            action = resp["result"].get("action")
            print(f"  [OK] Tool intent resolved: {action}")
            assert action and action.get("type") == "STORE_MEMORY", (
                f"Unexpected action: {action}"
            )
            return {"ok": True, "action": action}
    finally:
        conn = sqlite3.connect(DB_PATH)
        try:
            conn.execute("BEGIN IMMEDIATE")
            mem_deleted = conn.execute(
                "DELETE FROM memories WHERE session_id = ?", (session_id,)
            ).rowcount
            conv_deleted = conn.execute(
                "DELETE FROM conversations WHERE session_id = ?", (session_id,)
            ).rowcount
            conn.commit()
            remaining = conn.execute(
                "SELECT (SELECT COUNT(*) FROM memories WHERE session_id = ?) + "
                "(SELECT COUNT(*) FROM conversations WHERE session_id = ?)",
                (session_id, session_id),
            ).fetchone()[0]
            print(
                f"  [CLEANUP] Removed {mem_deleted} memory and "
                f"{conv_deleted} conversation row(s); remaining={remaining}"
            )
            if remaining:
                raise RuntimeError("Test 3 cleanup left records behind")
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()


async def test_4_malformed_arguments():
    print("\n--- TEST 4: Malformed Arguments Handling ---")
    async with websockets.connect(WS_URL, max_size=1048576) as ws:
        # Invalid params (string instead of dict)
        req_bad = {"jsonrpc": "2.0", "id": "test-bad-4", "method": "SarembokChat", "params": "not-a-dict"}
        await ws.send(json.dumps(req_bad))
        resp = json.loads(await ws.recv())
        assert "error" in resp, f"Expected error for malformed params: {resp}"
        print(f"  [OK] Clean rejection of malformed params: {resp['error']}")
        return {"ok": True, "code": resp["error"]["code"]}


async def test_5_authorization_failure():
    print("\n--- TEST 5: Authorization Failure Handling ---")
    async with websockets.connect(WS_URL, max_size=1048576) as ws:
        req_unauth = {
            "jsonrpc": "2.0",
            "id": "test-unauth-5",
            "method": "SarembokChat",
            "params": {
                "prompt": "Hello",
                "model": "local",
                "authToken": "completely-invalid-auth-token-xyz",
            }
        }
        await ws.send(json.dumps(req_unauth))
        resp = json.loads(await ws.recv())
        assert "error" in resp, f"Expected auth error: {resp}"
        assert resp["error"]["code"] == -32001, f"Expected -32001, got {resp['error']}"
        print(f"  [OK] Properly rejected unauthenticated request: {resp['error']}")
        return {"ok": True, "code": resp["error"]["code"]}


async def test_6_sqlite_persistence():
    print("\n--- TEST 6: SQLite Conversation Persistence Verification ---")
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    row = cur.execute(
        "SELECT session_id, role, content FROM conversations WHERE session_id='test-session-local-1' ORDER BY id DESC LIMIT 2"
    ).fetchall()
    conn.close()
    print(f"  [OK] Retrieved {len(row)} persisted rows for session test-session-local-1")
    assert len(row) >= 1, "Expected conversations to be persisted in SQLite"
    print(f"  [OK] Persisted content sample: role={row[0][1]} content={row[0][2][:60]}")
    return {"ok": True, "persisted_rows": len(row)}


async def test_7_cancellation():
    print("\n--- TEST 7: Stream Cancellation / Barge-In ---")
    active_stream_id = f"test-cancel-active-{int(time.time())}"

    # 1. Non-existent stream cancellation check (must return cancelled: False)
    async with websockets.connect(WS_URL, max_size=1048576) as ws_ctrl:
        req_idle = {
            "jsonrpc": "2.0",
            "id": "test-cancel-idle",
            "method": "CancelActiveStream",
            "params": {
                "streamId": "non-existent-stream-id",
                "authToken": AUTH_TOKEN,
            }
        }
        await ws_ctrl.send(json.dumps(req_idle))
        resp_idle = json.loads(await ws_ctrl.recv())
        assert resp_idle.get("result", {}).get("cancelled") is False, f"Expected cancelled=False for idle stream: {resp_idle}"
        print("  [OK] Idle stream cancellation properly reported cancelled=False")

    # 2. Real active stream cancellation test
    async with websockets.connect(WS_URL, max_size=1048576) as ws_stream:
        # Start a long-running streaming inference request
        chat_req = {
            "jsonrpc": "2.0",
            "id": active_stream_id,
            "method": "SarembokChat",
            "params": {
                "prompt": "Count slowly from 1 to 50, writing each number on a separate line.",
                "model": "local",
                "stream": True,
                "streamId": active_stream_id,
                "authToken": AUTH_TOKEN,
                "sessionId": f"test-session-cancel-{int(time.time())}",
            }
        }
        await ws_stream.send(json.dumps(chat_req))

        # Wait until at least 1 delta chunk arrives to prove inference is active
        received_chunks_before_cancel = 0
        while received_chunks_before_cancel < 2:
            raw = await asyncio.wait_for(ws_stream.recv(), timeout=25.0)
            msg = json.loads(raw)
            if msg.get("method") == "SarembokChat.delta":
                received_chunks_before_cancel += 1

        print(f"  [OK] Active stream confirmed emitting tokens ({received_chunks_before_cancel} chunks received)")

        # Send CancelActiveStream while streaming is underway
        async with websockets.connect(WS_URL, max_size=1048576) as ws_cancel:
            cancel_req = {
                "jsonrpc": "2.0",
                "id": "cancel-dispatch",
                "method": "CancelActiveStream",
                "params": {
                    "streamId": active_stream_id,
                    "authToken": AUTH_TOKEN,
                }
            }
            await ws_cancel.send(json.dumps(cancel_req))
            cancel_resp = json.loads(await ws_cancel.recv())
            res = cancel_resp.get("result", {})
            print(f"  [OK] Cancellation response: {res}")
            assert res.get("cancelled") is True, f"Expected cancelled=True for active stream, got: {res}"
            assert res.get("streamId") == active_stream_id, f"Stream ID mismatch: {res}"

        # Verify stream terminates and client receives final payload or closure
        post_cancel_chunks = 0
        try:
            while True:
                raw = await asyncio.wait_for(ws_stream.recv(), timeout=3.0)
                msg = json.loads(raw)
                if msg.get("method") == "SarembokChat.delta":
                    post_cancel_chunks += 1
                elif "result" in msg or "error" in msg:
                    break
        except asyncio.TimeoutError:
            pass

        print(f"  [OK] Stream terminated cleanly (post-cancel chunks: {post_cancel_chunks})")

    # 3. Verify concurrency lock was freed by immediately executing a new inference turn
    async with websockets.connect(WS_URL, max_size=1048576) as ws_verify:
        verify_req = {
            "jsonrpc": "2.0",
            "id": "verify-semaphore-free",
            "method": "SarembokChat",
            "params": {
                "prompt": "What is 10 plus 10? Answer in one word.",
                "model": "local",
                "authToken": AUTH_TOKEN,
                "sessionId": f"test-session-cancel-verify-{int(time.time())}",
            }
        }
        t_free = time.time()
        await ws_verify.send(json.dumps(verify_req))
        verify_resp = json.loads(await asyncio.wait_for(ws_verify.recv(), timeout=15.0))
        assert "result" in verify_resp, f"Inference failed after cancellation: {verify_resp}"
        print(f"  [OK] Inference semaphore successfully released; post-cancel turn took {(time.time()-t_free)*1000:.1f}ms")

    return {"ok": True, "active_cancellation_verified": True, "idle_cancellation_verified": True}


async def test_8_local_unavailability_zero_fallback():
    print("\n--- TEST 8: Local Unavailability & Zero-Cloud-Fallback Verification ---")
    keys = (
        "SAREMBOK_LOCAL_URL",
        "SAREMBOK_LOCAL_GEMMA_URL",
        "SAREMBOK_LOCAL_ONLY_MODE",
    )
    original = {key: os.environ.get(key) for key in keys}
    dead_url = "http://127.0.0.1:9999/v1/chat/completions"

    try:
        os.environ["SAREMBOK_LOCAL_URL"] = dead_url
        os.environ["SAREMBOK_LOCAL_GEMMA_URL"] = dead_url
        os.environ["SAREMBOK_LOCAL_ONLY_MODE"] = "true"

        import provider_router
        router = provider_router.ProviderRouter()
        providers = router.configured(requested_model="local")
        names = [provider.name for provider in providers]
        print(f"  [OK] Local-only providers: {names}")
        assert names == ["LocalGemma"], f"Unexpected provider list: {names}"

        try:
            router.generate(
                "You are an assistant",
                "Hello",
                [{"role": "user", "content": "Hello"}],
                requested_model="local",
            )
        except RuntimeError as exc:
            message = str(exc)
            print(f"  [OK] Expected local failure: {message}")
            assert "local_only_inference_failed" in message, message
            assert "prohibited in local-only mode" in message, message
        else:
            raise AssertionError("Unavailable local model unexpectedly succeeded")

        return {"ok": True, "zero_fallback_verified": True}
    finally:
        for key, value in original.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value


async def test_9_concurrent_kokoro_tts_load():
    print("\n--- TEST 9: Concurrent Kokoro TTS Load + Local Model Inference ---")
    # Trigger Kokoro TTS audio generation
    async def call_kokoro():
        def synthesize():
            t0 = time.time()
            payload = json.dumps({
                "text": "Sarembok sovereign audio engine active.",
                "voice": "af_heart",
            }).encode("utf-8")
            req = urllib.request.Request(
                f"{VOICE_URL}/tts/stream",
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                audio_bytes = resp.read()
            return time.time() - t0, len(audio_bytes)

        # Keep blocking HTTP I/O off the event loop so chat can run concurrently.
        return await asyncio.to_thread(synthesize)

    async def call_local_chat():
        async with websockets.connect(WS_URL, max_size=1048576) as ws:
            req = {
                "jsonrpc": "2.0",
                "id": "concurrent-test-9",
                "method": "SarembokChat",
                "params": {
                    "prompt": "What is the square root of 64? Answer in a complete sentence.",
                    "model": "local",
                    "authToken": AUTH_TOKEN,
                    "sessionId": "test-session-concurrent",
                }
            }
            t0 = time.time()
            await ws.send(json.dumps(req))
            resp = json.loads(await ws.recv())
            if "error" in resp:
                raise RuntimeError(f"Concurrent chat RPC error: {resp['error']}")
            result = resp.get("result")
            if not isinstance(result, dict):
                raise AssertionError(f"Missing chat result: {resp}")
            return time.time() - t0, result.get("response", ""), result.get("source"), result.get("model")

    # Run simultaneously
    (tts_time, tts_size), (chat_time, chat_reply, chat_source, chat_model) = await asyncio.gather(call_kokoro(), call_local_chat())
    print(f"  [OK] Kokoro TTS completed in {tts_time*1000:.1f}ms ({tts_size} bytes)")
    print(f"  [OK] Local Chat completed in {chat_time*1000:.1f}ms; source={chat_source}, model={chat_model}; reply={chat_reply.strip()}")
    assert tts_size > 1000, "TTS audio synthesis failed"
    assert chat_source == "LocalGemma", f"Expected LocalGemma, got {chat_source}"
    assert chat_model == "gemma2:2b", f"Expected gemma2:2b, got {chat_model}"
    assert "8" in chat_reply or "eight" in chat_reply.lower(), f"Unexpected chat reply: {chat_reply}"
    return {"ok": True, "tts_ms": tts_time * 1000, "chat_ms": chat_time * 1000, "chat_source": chat_source, "chat_model": chat_model, "chat_reply": chat_reply.strip()}


async def test_10_tts_stream_cancellation():
    print("\n--- TEST 10: TTS Stream Cancellation and Registry Cleanup ---")
    stream_id = f"test-tts-cancel-{time.time_ns()}"

    async def start_stream(ws, text, timeout=15, wait_for_audio=True):
        req = {
            "jsonrpc": "2.0",
            "id": stream_id,
            "method": "SynthesizeSpeechStream",
            "params": {
                "text": text,
                "voice": "af_heart",
                "authToken": AUTH_TOKEN,
            },
        }
        await ws.send(json.dumps(req))
        deadline = time.monotonic() + timeout
        started = False
        while time.monotonic() < deadline:
            raw = await asyncio.wait_for(
                ws.recv(), timeout=max(0.1, deadline - time.monotonic())
            )
            if isinstance(raw, bytes):
                if started and raw:
                    return len(raw)
                continue

            msg = json.loads(raw)
            if msg.get("method") == "SynthesizeSpeechStream.started":
                assert msg.get("params", {}).get("id") == stream_id
                started = True
                if not wait_for_audio:
                    return 0
            elif msg.get("method") == "SynthesizeSpeechStream.error":
                raise RuntimeError(f"TTS stream error: {msg}")
        raise TimeoutError("Did not receive TTS audio bytes within the deadline")

    async def cancel_stream(ws, require_active=True):
        cancel_id = f"cancel-{time.time_ns()}"
        req = {
            "jsonrpc": "2.0",
            "id": cancel_id,
            "method": "CancelActiveStream",
            "params": {"streamId": stream_id, "authToken": AUTH_TOKEN},
        }
        await ws.send(json.dumps(req))
        deadline = time.monotonic() + 5
        done_seen = False

        while time.monotonic() < deadline:
            raw = await asyncio.wait_for(
                ws.recv(), timeout=max(0.1, deadline - time.monotonic())
            )
            if isinstance(raw, bytes):
                continue

            msg = json.loads(raw)
            if (
                msg.get("method") == "SynthesizeSpeechStream.done"
                and msg.get("params", {}).get("id") == stream_id
            ):
                done_seen = True

            if msg.get("id") == cancel_id:
                cancelled = msg.get("result", {}).get("cancelled") is True
                if require_active:
                    assert cancelled and not done_seen, (
                        f"Expected cancellation before completion: {msg}; "
                        f"done_seen={done_seen}"
                    )
                return cancelled

        raise TimeoutError("No CancelActiveStream response received")

    async with websockets.connect(WS_URL, max_size=1048576) as ws:
        try:
            first_bytes = await start_stream(
                ws,
                "Sarembok voice cancellation test. " * 3,
            )
            print(f"  [OK] Active TTS stream produced {first_bytes} audio bytes")
            assert await cancel_stream(ws)
            print("  [OK] Active TTS cancellation acknowledged")

            # Drain already-buffered frames; a cancelled stream must not report done.
            quiet_since = time.monotonic()
            while time.monotonic() - quiet_since < 0.6:
                try:
                    raw = await asyncio.wait_for(ws.recv(), timeout=0.2)
                except asyncio.TimeoutError:
                    continue
                quiet_since = time.monotonic()
                if isinstance(raw, str):
                    msg = json.loads(raw)
                    assert msg.get("method") != "SynthesizeSpeechStream.done", (
                        "Cancelled stream incorrectly reported completion"
                    )

            # Reuse the ID. A new "started" event proves the previous entry was removed.
            second_bytes = await start_stream(
                ws,
                "TTS cleanup verification. " * 3,
            )
            print(
                f"  [OK] Stream ID reused after cleanup; received {second_bytes} audio bytes"
            )
            assert await cancel_stream(ws)
            print("  [OK] Second TTS stream cancelled")
        finally:
            # Best-effort cleanup if an assertion or timeout interrupts the test.
            try:
                await cancel_stream(ws, require_active=False)
            except Exception:
                pass

    return {"ok": True, "stream_id_reused": True, "tts_cancelled": True}


async def main():
    print("==================================================================")
    print(" SAREMBOK VE — STAGE 1 LOCAL INFERENCE ACCEPTANCE SUITE")
    print("==================================================================")
    results = {}
    results["test_1"] = await test_1_normal_inference()
    results["test_2"] = await test_2_streaming_inference()
    results["test_3"] = await test_3_structured_tool_calls()
    results["test_4"] = await test_4_malformed_arguments()
    results["test_5"] = await test_5_authorization_failure()
    results["test_6"] = await test_6_sqlite_persistence()
    results["test_7"] = await test_7_cancellation()
    results["test_8"] = await test_8_local_unavailability_zero_fallback()
    results["test_9"] = await test_9_concurrent_kokoro_tts_load()
    results["test_10"] = await test_10_tts_stream_cancellation()

    print("\n==================================================================")
    print(" ALL 10 ACCEPTANCE TESTS COMPLETED SUCCESSFULLY!")
    print("==================================================================")
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
