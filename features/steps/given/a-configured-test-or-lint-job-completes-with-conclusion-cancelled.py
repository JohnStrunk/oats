from behave import given

@given(u'a configured test or lint job completes with conclusion "cancelled"')
def step_impl(context):
    if not hasattr(context, "job_results"):
        context.job_results = {}
    context.job_results["test"] = "cancelled"
