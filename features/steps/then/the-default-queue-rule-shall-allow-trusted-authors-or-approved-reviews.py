from behave import then
from features.steps.mergify_helper import get_default_queue_rule

@then(u'the default queue rule shall allow trusted authors or approved reviews')
def step_impl(context):
    config = getattr(context, "mergify_config", {})
    queue_rule = get_default_queue_rule(config)
    queue_conditions = queue_rule.get("queue_conditions", [])
    
    # Check that an 'or' block exists containing authors and approval reviews
    found_or = False
    for cond in queue_conditions:
        if isinstance(cond, dict) and "or" in cond:
            or_list = cond["or"]
            has_author = any("author=" in item for item in or_list if isinstance(item, str))
            has_reviews = any("approved-reviews-by" in item for item in or_list if isinstance(item, str))
            if has_author and has_reviews:
                found_or = True
                break
    assert found_or, f"Expected 'or' block with author and approved-reviews conditions in queue_conditions: {queue_conditions}"
