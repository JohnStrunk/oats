from behave import when

from features.steps.tui_smoke_helper import run_tui


@when("the OpenCode TUI explicitly loads the hostile plugin without OATS")
def step_impl(context):
    # Demonstrate that the hostile fixture can produce a false positive without
    # allowing discovery of any uncontrolled plugin in a parent directory.
    context.tui_result = run_tui(
        configure_oats=False,
        hostile_ancestor=context.hostile_ancestor,
        load_hostile_as_cli=True,
    )
