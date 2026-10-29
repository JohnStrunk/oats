from behave import then

@then(u'a pull request rule named "{rule_name}" shall specify the "{action}" action')
def step_impl(context, rule_name, action):
    config = getattr(context, "mergify_config", {})
    rules = config.get("pull_request_rules", [])
    matching_rule = None
    for rule in rules:
        if isinstance(rule, dict) and rule.get("name") == rule_name:
            matching_rule = rule
            break
    assert matching_rule is not None, f"No pull_request_rules found named '{rule_name}' in: {rules}"
    actions = matching_rule.get("actions", {})
    assert action in actions, f"Expected action '{action}' in rule actions: {actions}"
