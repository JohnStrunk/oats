from behave import when

from features.steps.tui_smoke_helper import run_tui


@when("the isolated OpenCode TUI starts")
def step_impl(context):
    context.tui_result = run_tui(configure_oats=context.configure_oats)
