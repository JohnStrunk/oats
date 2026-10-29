"""Exercise the real OpenCode TUI in an isolated pseudo-terminal."""

import fcntl
import json
import os
from pathlib import Path
import pty
import re
import select
import shutil
import signal
import struct
import subprocess
import tempfile
import termios
import time
from dataclasses import dataclass


REPO_ROOT = Path(__file__).resolve().parents[2]
TIMEOUT_SECONDS = 30
CONTROL_OBSERVATION_SECONDS = 3
MAX_OUTPUT = 4 * 1024 * 1024

# OpenTUI emits cursor-positioned text. Requiring a rendered screen update,
# rather than a bare substring, avoids confusing diagnostics with a toast.
RENDERED_TOAST = re.compile(rb"\x1b\[\d+;\d+H(?:\x1b\[[0-9;]*m)*OATS loaded")
RENDERED_HOME = re.compile(rb"\x1b\[\d+;\d+H(?:\x1b\[[0-9;]*m)*ctrl\+p ")


@dataclass(frozen=True)
class TuiResult:
    host_ready: bool
    toast_visible: bool
    control_completed: bool
    diagnostic: str


def run_tui(*, configure_oats):
    executable = os.environ.get("OATS_OPENCODE", "opencode")
    assert shutil.which(executable), f"OpenCode executable not found: {executable}"
    version = subprocess.run(
        [executable, "--version"],
        capture_output=True,
        text=True,
        timeout=10,
        check=True,
    ).stdout.strip()
    assert re.search(r"\bv?2\.", version), f"Expected OpenCode V2, got: {version}"

    # A new home and working directory prevent ambient configuration, credentials,
    # discovered project plugins, and the user's shared server from affecting the test.
    temp_root = "/tmp/opencode" if Path("/tmp/opencode").is_dir() else None
    with tempfile.TemporaryDirectory(prefix="oats-tui-", dir=temp_root) as tmp:
        root = Path(tmp)
        project = root / "project"
        project.mkdir()
        env = {"PATH": os.environ.get("PATH", os.defpath), "LC_ALL": "C.UTF-8"}
        env.update(
            {
                "HOME": str(root),
                "XDG_CONFIG_HOME": str(root / "config"),
                "XDG_DATA_HOME": str(root / "data"),
                "XDG_CACHE_HOME": str(root / "cache"),
                "XDG_STATE_HOME": str(root / "state"),
                "TERM": "xterm-256color",
                "OPENCODE_CLI_CONFIG_CONTENT": json.dumps(
                    {
                        "plugins": [str(REPO_ROOT)] if configure_oats else [],
                        "highlights": False,
                    }
                ),
            }
        )

        master, slave = pty.openpty()
        proc = None
        output = bytearray()
        try:
            fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", 40, 120, 0, 0))
            proc = subprocess.Popen(
                [executable, "--standalone", str(project)],
                cwd=project,
                env=env,
                stdin=slave,
                stdout=slave,
                stderr=slave,
                start_new_session=True,
                close_fds=True,
            )
            os.close(slave)
            slave = None
            deadline = time.monotonic() + TIMEOUT_SECONDS
            control_deadline = None
            control_completed = False
            while time.monotonic() < deadline:
                ready = bool(RENDERED_HOME.search(output))
                toast = bool(RENDERED_TOAST.search(output))
                if ready and toast:
                    break
                if ready and not configure_oats:
                    if control_deadline is None:
                        control_deadline = (
                            time.monotonic() + CONTROL_OBSERVATION_SECONDS
                        )
                    if time.monotonic() >= control_deadline and proc.poll() is None:
                        control_completed = True
                        break
                if proc.poll() is not None:
                    break
                readable, _, _ = select.select([master], [], [], 0.1)
                if readable:
                    try:
                        chunk = os.read(master, 65536)
                    except OSError:
                        break
                    if not chunk:
                        break
                    output.extend(chunk)
                    if len(output) > MAX_OUTPUT:
                        raise AssertionError("OpenCode TUI exceeded the output limit")
            host_ready = bool(RENDERED_HOME.search(output))
            toast_visible = bool(RENDERED_TOAST.search(output))
            diagnostic = (
                f"host={version}, configured={configure_oats}, "
                f"process_status={proc.poll()}, captured_bytes={len(output)}, "
                f"control_completed={control_completed}"
            )
            return TuiResult(host_ready, toast_visible, control_completed, diagnostic)
        finally:
            if proc is not None:
                try:
                    os.killpg(proc.pid, signal.SIGTERM)
                except ProcessLookupError:
                    pass
                try:
                    proc.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    os.killpg(proc.pid, signal.SIGKILL)
                    proc.wait(timeout=5)
            if slave is not None:
                os.close(slave)
            os.close(master)
