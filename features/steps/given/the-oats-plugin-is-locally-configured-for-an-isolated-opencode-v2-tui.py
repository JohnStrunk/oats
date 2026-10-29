from behave import given


@given("the OATS plugin is locally configured for an isolated OpenCode V2 TUI")
def step_impl(context):
    context.configure_oats = True
