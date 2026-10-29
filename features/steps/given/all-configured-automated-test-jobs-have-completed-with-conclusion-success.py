from behave import given

@given(u'all configured automated test jobs have completed with conclusion "success"')
def step_impl(context):
    if not hasattr(context, "job_results"):
        context.job_results = {}
    context.job_results["test"] = "success"
