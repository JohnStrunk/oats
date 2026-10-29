from behave import given

@given(u'{test_job_count:d} test jobs have completed with conclusion "success"')
def step_impl(context, test_job_count):
    if not hasattr(context, "job_results"):
        context.job_results = {}
    for i in range(test_job_count):
        context.job_results[f"test_job_{i}"] = "success"
