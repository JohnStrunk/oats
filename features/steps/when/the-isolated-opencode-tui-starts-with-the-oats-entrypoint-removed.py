import shutil
import tempfile
from pathlib import Path

from behave import when

from features.steps.tui_smoke_helper import REPO_ROOT, run_tui


@when("the isolated OpenCode TUI starts with the OATS entrypoint removed")
def step_impl(context):
    # Keep the real checkout untouched: reproduce its package in a disposable
    # directory and remove the actual exported implementation from the copy.
    with tempfile.TemporaryDirectory(prefix="oats-missing-entrypoint-") as tmp:
        copy = Path(tmp)
        shutil.copy2(REPO_ROOT / "package.json", copy)
        shutil.copy2(REPO_ROOT / "tui.js", copy)
        shutil.copytree(REPO_ROOT / "src", copy / "src")
        (copy / "src" / "tui.js").unlink()
        context.tui_result = run_tui(
            configure_oats=True,
            hostile_ancestor=context.hostile_ancestor,
            plugin_path=copy,
            observe_absence=True,
        )
