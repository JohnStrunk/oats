from behave import then

@then(u'a package rule shall match workflow file paths')
def step_impl(context):
    config = getattr(context, "renovate_config", {})
    package_rules = config.get("packageRules", [])
    matching_rule = None
    for rule in package_rules:
        if isinstance(rule, dict):
            file_names = rule.get("matchFileNames", [])
            if any(".github/workflows" in fn for fn in file_names):
                matching_rule = rule
                break
    assert matching_rule is not None, f"No package rule matching matchFileNames with .github/workflows found in: {package_rules}"
    context.workflow_package_rule = matching_rule
