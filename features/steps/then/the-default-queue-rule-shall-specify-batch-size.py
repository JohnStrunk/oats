from behave import then
from features.steps.mergify_helper import get_default_queue_rule

@then(u'the default queue rule shall specify a batch_size of {batch_size:d}')
def step_impl(context, batch_size):
    config = getattr(context, "mergify_config", {})
    queue_rule = get_default_queue_rule(config)
    actual = queue_rule.get("batch_size")
    assert actual == batch_size, f"Expected batch_size {batch_size}, got {actual} in queue rule: {queue_rule}"
