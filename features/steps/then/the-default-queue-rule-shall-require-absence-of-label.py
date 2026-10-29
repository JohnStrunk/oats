from behave import then
from features.steps.mergify_helper import get_default_queue_rule

@then(u'the default queue rule shall require absence of the "{label}" label')
def step_impl(context, label):
    config = getattr(context, "mergify_config", {})
    queue_rule = get_default_queue_rule(config)
    queue_conditions = queue_rule.get("queue_conditions", [])
    expected = f"label!={label}"
    has_label_cond = any(expected in cond for cond in queue_conditions if isinstance(cond, str))
    assert has_label_cond, f"Expected '{expected}' in queue_conditions: {queue_conditions}"
