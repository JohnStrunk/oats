from behave import then
from features.steps.mergify_helper import get_default_queue_rule

@then(u'the default queue rule shall require zero change requests')
def step_impl(context):
    config = getattr(context, "mergify_config", {})
    queue_rule = get_default_queue_rule(config)
    queue_conditions = queue_rule.get("queue_conditions", [])
    has_zero_changes = any("#changes-requested-reviews-by=0" in cond for cond in queue_conditions if isinstance(cond, str))
    assert has_zero_changes, f"Expected '#changes-requested-reviews-by=0' in queue_conditions: {queue_conditions}"
