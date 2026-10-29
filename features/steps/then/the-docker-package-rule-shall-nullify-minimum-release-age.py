from behave import then

@then(u'the docker package rule shall nullify the minimum release age')
def step_impl(context):
    rule = getattr(context, "docker_rule", {})
    # In Renovate JSON, minimumReleaseAge: null is parsed as None in Python
    assert "minimumReleaseAge" in rule, f"Rule does not specify 'minimumReleaseAge': {rule}"
    assert rule["minimumReleaseAge"] is None, f"Expected minimumReleaseAge to be null/None, got {rule['minimumReleaseAge']}"
