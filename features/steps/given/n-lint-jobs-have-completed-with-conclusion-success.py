from behave import given

@given(u'{lint_job_count:d} lint jobs have completed with conclusion "success"')
def step_impl(context, lint_job_count):
    if not hasattr(context, "job_results"):
        context.job_results = {}
    for i in range(lint_job_count):
        context.job_results[f"lint_job_{i}"] = "success"
