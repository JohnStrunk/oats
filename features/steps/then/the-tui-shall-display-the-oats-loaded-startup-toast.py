from behave import then


@then('the TUI shall display the "OATS loaded" startup toast')
def step_impl(context):
    result = context.tui_result
    assert result.host_ready, f"OpenCode TUI did not start ({result.diagnostic})"
    assert result.toast_visible, (
        f"OATS startup toast was not rendered ({result.diagnostic})"
    )
