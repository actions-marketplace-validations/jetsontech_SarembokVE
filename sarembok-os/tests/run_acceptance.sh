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
echo "== Sarembok acceptance suite =="
python3 sim/run_tests.py
echo "== per-claim acceptance scripts =="
for t in tests/acceptance/m1_agent_lifecycle.sh \
         tests/acceptance/m1_fault_isolation.sh \
         tests/acceptance/m2_persistence.sh \
         tests/acceptance/m2_eviction.sh ; do
  bash "$t"
done
echo "== all acceptance tests passed =="
