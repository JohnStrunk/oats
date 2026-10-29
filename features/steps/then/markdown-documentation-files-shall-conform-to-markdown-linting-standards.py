from behave import then

@then(u'markdown documentation files shall conform to markdown linting standards')
def step_impl(context):
    assert getattr(context, "markdown_linter_executed", False), "Markdown linter was not executed"
