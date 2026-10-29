from behave import then
from features.steps.mergify_helper import get_default_queue_rule

@then(u'the default queue rule shall require check-success for "{check_name}"')
def step_impl(context, check_name):
    config = getattr(context, "mergify_config", {})
    queue_rule = get_default_queue_rule(config)
    queue_conditions = queue_rule.get("queue_conditions", [])
    
    # Check that check-success="<check_name>" or check-success=<check_name> is in queue_conditions
    found = False
    for cond in queue_conditions:
        if isinstance(cond, str):
            if f"check-success={check_name}" in cond or f'check-success="{check_name}"' in cond:
                found = True
                break
    assert found, f"Expected check-success for '{check_name}' in queue_conditions: {queue_conditions}"
