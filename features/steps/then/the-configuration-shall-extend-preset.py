from behave import then

@then(u'the configuration shall extend "{preset}"')
def step_impl(context, preset):
    config = getattr(context, "renovate_config", {})
    extends = config.get("extends", [])
    assert preset in extends, f"Expected '{preset}' in extends list, got: {extends}"
