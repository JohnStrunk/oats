from behave import given


@given("no plugin is configured for an isolated OpenCode V2 TUI")
def step_impl(context):
    context.configure_oats = False
