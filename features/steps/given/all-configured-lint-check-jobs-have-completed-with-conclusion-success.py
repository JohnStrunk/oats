from behave import given

@given(u'all configured lint check jobs have completed with conclusion "success"')
def step_impl(context):
    if not hasattr(context, "job_results"):
        context.job_results = {}
    context.job_results["lint-markdown"] = "success"
    context.job_results["lint-yaml-and-workflows"] = "success"
    context.job_results["lint-shell"] = "success"
