from behave import when
from features.steps.workflow_helper import load_ci_workflow

@when(u'the CI workflow executes the YAML and workflow linter')
def step_impl(context):
    workflow = load_ci_workflow()
    jobs = workflow.get("jobs", {})
    # Verify a job or step configures actionlint and yamllint
    found_actionlint = False
    found_yamllint = False
    for job_id, job in jobs.items():
        job_str = str(job).lower()
        if "actionlint" in job_str:
            found_actionlint = True
        if "yamllint" in job_str:
            found_yamllint = True
    assert found_actionlint, "No actionlint configuration found in CI workflow jobs"
    assert found_yamllint, "No yamllint configuration found in CI workflow jobs"
    context.yaml_linter_executed = True
