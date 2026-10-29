from behave import when
from features.steps.workflow_helper import load_ci_workflow

@when(u'the CI workflow executes the shell script linter')
def step_impl(context):
    workflow = load_ci_workflow()
    jobs = workflow.get("jobs", {})
    # Verify a job or step configures shellcheck
    found_shellcheck = False
    for job_id, job in jobs.items():
        job_str = str(job).lower()
        if "shellcheck" in job_str:
            found_shellcheck = True
            break
    assert found_shellcheck, "No shellcheck configuration found in CI workflow jobs"
    context.shell_linter_executed = True
