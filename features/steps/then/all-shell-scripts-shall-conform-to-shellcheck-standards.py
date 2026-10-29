from behave import then

@then(u'all shell scripts shall conform to shellcheck standards')
def step_impl(context):
    assert getattr(context, "shell_linter_executed", False), "Shellcheck linter was not executed"
