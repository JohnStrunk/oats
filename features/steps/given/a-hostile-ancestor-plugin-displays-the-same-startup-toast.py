from behave import given


@given("a hostile ancestor plugin displays the same startup toast")
def step_impl(context):
    context.hostile_ancestor = True
