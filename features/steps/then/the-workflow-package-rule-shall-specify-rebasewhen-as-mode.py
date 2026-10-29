from behave import then

@then(u'the workflow package rule shall specify rebaseWhen as "{mode}"')
def step_impl(context, mode):
    rule = getattr(context, "workflow_package_rule", {})
    actual = rule.get("rebaseWhen")
    assert actual == mode, f"Expected rebaseWhen '{mode}', got '{actual}' in rule: {rule}"
