from behave import then

@then(u'the configuration shall extend container digest pinning')
def step_impl(context):
    config = getattr(context, "renovate_config", {})
    extends = config.get("extends", [])
    assert "docker:pinDigests" in extends, f"Expected 'docker:pinDigests' in extends: {extends}"
