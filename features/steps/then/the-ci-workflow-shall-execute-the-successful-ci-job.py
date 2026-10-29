from behave import then

@then(u'the CI workflow shall execute the "Successful CI" job')
def step_impl(context):
    assert getattr(context, "gate_executed", False), "Expected 'Successful CI' job to be executed"
