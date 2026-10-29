from behave import then

@then(u'a package rule shall match the "{category}" category')
def step_impl(context, category):
    config = getattr(context, "renovate_config", {})
    package_rules = config.get("packageRules", [])
    matching_rule = None
    for rule in package_rules:
        if isinstance(rule, dict) and category in rule.get("matchCategories", []):
            matching_rule = rule
            break
    assert matching_rule is not None, f"No package rule matching matchCategories: ['{category}'] found in {package_rules}"
    context.docker_rule = matching_rule
