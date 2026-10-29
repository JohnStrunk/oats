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
import sys
import tempfile
import termios
import time
from dataclasses import dataclass


REPO_ROOT = Path(__file__).resolve().parents[2]
TIMEOUT_SECONDS = 30
CONTROL_OBSERVATION_SECONDS = 3
MAX_OUTPUT = 4 * 1024 * 1024
TESTED_VERSION = "2.0.32"

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


def system_sources():
    if sys.platform != "darwin":
        return [Path("/etc/opencode")]
    import pwd

    user = pwd.getpwuid(os.getuid()).pw_name
    return [
        Path("/Library/Application Support/opencode"),
        Path("/Library/Managed Preferences") / user / "ai.opencode.managed.plist",
        Path("/Library/Managed Preferences/ai.opencode.managed.plist"),
    ]


def assert_no_system_config(paths):
    # V2 reads system configuration independently of HOME and project discovery.
    # Do not claim an isolated test if it might supply an impersonating plugin.
    for path in paths:
        try:
            path.lstat()
        except FileNotFoundError:
            continue
        except OSError as error:
            raise AssertionError(
                f"Cannot inspect OpenCode system source {path}: {error}"
            ) from error
        raise AssertionError(
            f"Cannot isolate OpenCode from system configuration at {path}; "
            "run this smoke test on a host without that system source"
        )


def run_tui(
    *,
    configure_oats,
    hostile_ancestor=False,
    plugin_path=REPO_ROOT,
    observe_absence=False,
    load_hostile_as_cli=False,
):
    executable = os.environ.get("OATS_OPENCODE", "opencode")
    assert shutil.which(executable), f"OpenCode executable not found: {executable}"
    version = subprocess.run(
        [executable, "--version"],
        capture_output=True,
        text=True,
        timeout=10,
        check=True,
    ).stdout.strip()
    parsed_version = re.fullmatch(r"(?:opencode\s+)?v?(\d+\.\d+\.\d+)", version)
    assert parsed_version and parsed_version.group(1) == TESTED_VERSION, (
        f"Expected OpenCode v{TESTED_VERSION}, got: {version}"
    )
    assert_no_system_config(system_sources())

    # A new home and working directory prevent ambient configuration, credentials,
    # discovered project plugins, and the user's shared server from affecting the test.
    temp_root = "/tmp/opencode" if Path("/tmp/opencode").is_dir() else None
    with tempfile.TemporaryDirectory(prefix="oats-tui-", dir=temp_root) as tmp:
        root = Path(tmp)
        project = root / "project"
        project.mkdir()
        if hostile_ancestor:
            # This deliberately mimics the OATS toast, so it can expose a false
            # positive if the host discovers plugins in a parent directory.
            ambient = root / ".opencode" / "plugins" / "ambient"
            ambient.mkdir(parents=True)
            (ambient / "index.ts").write_text(
                'import { Plugin } from "@opencode/plugin"\n'
                'export default Plugin.define({ id: "ambient.server", setup() {} })\n'
            )
            (ambient / "tui.ts").write_text(
                'import { Plugin } from "@opencode/plugin/tui"\n'
                'export default Plugin.define({ id: "ambient.impersonator", '
                'setup(ctx) { ctx.ui.toast.show({ message: "OATS loaded" }) } })\n'
            )
        assert not load_hostile_as_cli or hostile_ancestor
        configured_plugins = [str(plugin_path)] if configure_oats else []
        if load_hostile_as_cli:
            configured_plugins.append(str(ambient))
        env = {"PATH": os.environ.get("PATH", os.defpath), "LC_ALL": "C.UTF-8"}
        env.update(
            {
                "HOME": str(root),
                "XDG_CONFIG_HOME": str(root / "config"),
                "XDG_DATA_HOME": str(root / "data"),
                "XDG_CACHE_HOME": str(root / "cache"),
                "XDG_STATE_HOME": str(root / "state"),
                "TERM": "xterm-256color",
                "OPENCODE_DISABLE_PROJECT_CONFIG": "1",
                "OPENCODE_DISABLE_MODELS_FETCH": "1",
                "OPENCODE_DISABLE_AUTOUPDATE": "1",
                "OPENCODE_CLI_CONFIG_CONTENT": json.dumps(
                    {
                        "plugins": configured_plugins,
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
                if ready and (not configure_oats or observe_absence):
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
                f"control_completed={control_completed}, "
                f"hostile_ancestor={hostile_ancestor}, load_hostile_as_cli={load_hostile_as_cli}"
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
