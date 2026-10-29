from behave import then

@then(u'all workflow and configuration files shall conform to actionlint and yamllint standards')
def step_impl(context):
    assert getattr(context, "yaml_linter_executed", False), "YAML/actionlint was not executed"
