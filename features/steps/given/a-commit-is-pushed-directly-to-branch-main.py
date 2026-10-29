from behave import given

@given(u'a commit is pushed directly to branch "main"')
def step_impl(context):
    context.event_type = "push"
    context.target_branch = "main"
