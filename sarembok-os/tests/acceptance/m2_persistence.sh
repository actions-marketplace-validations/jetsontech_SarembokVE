#!/usr/bin/env bash
# ============================================================================
# Copyright (c) 2026 Timothy Hall Jr. / Jetsontech. All rights reserved.
#
# This source code is licensed under the Business Source License 1.1 (BSL).
# Commercial use, deployment in production environments, or redistribution 
# for profit is strictly prohibited without a valid commercial license.
#
# For commercial inquiries, licensing, or partnerships, contact the Licensor.
# ============================================================================

set -e
python3 - <<'PY'
import sys, os, tempfile
sys.path.insert(0, "sim")
from kernel import Kernel
fd, path = tempfile.mkstemp(suffix=".wal"); os.close(fd); os.remove(path)
k = Kernel(wal_path=path)
aid = k.spawn_agent("alice", [])
k.remember(aid, "project", "Sarembok OS", "CORE")
k.remember(aid, "mood", "focused", "WORKING")
del k
k2 = Kernel(wal_path=path)
refs = k2.recall(aid, "project")
assert any(e.value == "Sarembok OS" for e in refs), "CORE memory not restored from WAL"
assert len(k2.list_agents()) >= 1, "agent identity not restored"
os.remove(path)
print("[ok] m2_persistence")
PY
