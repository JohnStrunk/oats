from behave import then


@then('the TUI shall start without displaying the "OATS loaded" startup toast')
def step_impl(context):
    result = context.tui_result
    assert result.host_ready, f"OpenCode TUI did not start ({result.diagnostic})"
    assert not result.toast_visible, (
        f"Toast appeared without OATS configured ({result.diagnostic})"
    )
    assert result.control_completed, (
        f"Control observation ended early ({result.diagnostic})"
    )
