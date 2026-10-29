from behave import then

@then(u'the global minimum release age shall be "{age}"')
def step_impl(context, age):
    config = getattr(context, "renovate_config", {})
    actual = config.get("minimumReleaseAge")
    assert actual == age, f"Expected global minimumReleaseAge '{age}', got '{actual}'"
