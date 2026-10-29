from behave import then
from features.steps.workflow_helper import load_ci_workflow

@then(u'the CI workflow shall schedule all configured lint check jobs')
def step_impl(context):
    workflow = load_ci_workflow()
    jobs = workflow.get("jobs", {})
    # Check that lint jobs are defined
    lint_jobs = [j_id for j_id, j in jobs.items() if "lint" in j_id.lower() or "lint" in str(j.get("name", "")).lower()]
    assert len(lint_jobs) > 0, f"No lint check jobs found in workflow jobs: {list(jobs.keys())}"
