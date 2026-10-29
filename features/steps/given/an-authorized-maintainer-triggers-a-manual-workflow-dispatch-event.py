from behave import given

@given(u'an authorized maintainer triggers a manual workflow dispatch event')
def step_impl(context):
    context.event_type = "workflow_dispatch"
