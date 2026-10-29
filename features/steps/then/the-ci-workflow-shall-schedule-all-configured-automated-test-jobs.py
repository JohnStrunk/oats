from behave import then
from features.steps.workflow_helper import load_ci_workflow

@then(u'the CI workflow shall schedule all configured automated test jobs')
def step_impl(context):
    workflow = load_ci_workflow()
    jobs = workflow.get("jobs", {})
    # Check that at least one test job is defined
    test_jobs = [j_id for j_id, j in jobs.items() if "test" in j_id.lower() or "test" in str(j.get("name", "")).lower()]
    assert len(test_jobs) > 0, f"No automated test jobs found in workflow jobs: {list(jobs.keys())}"
