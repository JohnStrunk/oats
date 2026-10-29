from behave import when
from features.steps.workflow_helper import load_ci_workflow

@when(u'the CI workflow executes the markdown linter')
def step_impl(context):
    workflow = load_ci_workflow()
    jobs = workflow.get("jobs", {})
    # Verify a job or step configures markdownlint
    found = False
    for job_id, job in jobs.items():
        job_str = str(job).lower()
        if "markdownlint" in job_str:
            found = True
            break
    assert found, "No job or step configuring markdownlint found in CI workflow"
    context.markdown_linter_executed = True
