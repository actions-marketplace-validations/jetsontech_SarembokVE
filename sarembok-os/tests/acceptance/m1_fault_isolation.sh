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
a = k.spawn_agent("crash_test", [])
b = k.spawn_agent("survivor", [])
k.remember(b, "important", "stay alive", "CORE")
k.handle_fault(a, "SIGSEGV")
live = [x.id for x in k.list_agents()]
assert a not in live, "faulted agent still live"
assert b in live, "survivor died ? kernel not isolated"
refs = k.recall(b, "important")
assert any(e.value == "stay alive" for e in refs), "survivor memory lost"
os.remove(path)
print("[ok] m1_fault_isolation")
PY
