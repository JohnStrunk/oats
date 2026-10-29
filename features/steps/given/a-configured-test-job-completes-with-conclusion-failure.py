from behave import given

@given(u'a configured test job completes with conclusion "failure"')
def step_impl(context):
    if not hasattr(context, "job_results"):
        context.job_results = {}
    context.job_results["test"] = "failure"
