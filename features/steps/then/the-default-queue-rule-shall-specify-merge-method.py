from behave import then
from features.steps.mergify_helper import get_default_queue_rule

@then(u'the default queue rule shall specify merge_method as "{merge_method}"')
def step_impl(context, merge_method):
    config = getattr(context, "mergify_config", {})
    queue_rule = get_default_queue_rule(config)
    actual = queue_rule.get("merge_method")
    assert actual == merge_method, f"Expected merge_method '{merge_method}', got '{actual}' in queue rule: {queue_rule}"
