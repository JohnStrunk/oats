from behave import given

@given(u'a pull request targeting "main" is opened or updated')
def step_impl(context):
    context.event_type = "pull_request"
    context.target_branch = "main"
