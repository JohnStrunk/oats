"""Regression tests for smoke-harness preconditions (run with unittest)."""

import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from features.steps.tui_smoke_helper import assert_no_system_config, run_tui


class HostVersionTests(unittest.TestCase):
    def test_wrong_versions_are_rejected_before_tui_start(self):
        for version in ("opencode v1.2.0", "opencode v2.0.320", "opencode v2.0.32-rc1"):
            with self.subTest(version=version), tempfile.TemporaryDirectory() as tmp:
                executable = Path(tmp) / "opencode"
                marker = Path(tmp) / "started"
                executable.write_text(
                    f'#!/bin/sh\nif [ "$1" = "--version" ]; then echo "{version}"; '
                    f'else touch "{marker}"; fi\n'
                )
                executable.chmod(0o755)
                with patch.dict(os.environ, {"OATS_OPENCODE": str(executable)}):
                    with self.assertRaisesRegex(
                        AssertionError, "Expected OpenCode v2.0.32"
                    ):
                        run_tui(configure_oats=False)
                self.assertFalse(
                    marker.exists(), "unsupported host reached TUI startup"
                )

    def test_system_source_fails_closed(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "opencode"
            assert_no_system_config([source])
            source.mkdir()
            with self.assertRaisesRegex(AssertionError, "Cannot isolate OpenCode"):
                assert_no_system_config([source])


if __name__ == "__main__":
    unittest.main()
