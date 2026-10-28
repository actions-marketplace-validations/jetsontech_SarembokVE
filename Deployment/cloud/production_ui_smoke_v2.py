#!/usr/bin/env python3
# ============================================================================
# Copyright (c) 2026 Timothy Hall Jr. / Jetsontech. All rights reserved.
#
# This source code is licensed under the Business Source License 1.1 (BSL).
# Commercial use, deployment in production environments, or redistribution 
# for profit is strictly prohibited without a valid commercial license.
#
# For commercial inquiries, licensing, or partnerships, contact the Licensor.
# ============================================================================

"""Compatibility entry point for the production UI smoke suite.

The V3 harness is authoritative. This module remains as a stable filename for
older deployment references while delegating to the corrected implementation.
"""
from __future__ import annotations

from production_ui_smoke_v3 import main


if __name__ == "__main__":
    raise SystemExit(main())
