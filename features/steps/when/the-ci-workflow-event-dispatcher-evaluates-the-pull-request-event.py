from behave import when
from features.steps.workflow_helper import load_ci_workflow, get_workflow_triggers

@when(u'the CI workflow event dispatcher evaluates the pull request event')
def step_impl(context):
    workflow = load_ci_workflow()
    workflow_on = get_workflow_triggers(workflow)
    if isinstance(workflow_on, dict):
        pr_config = workflow_on.get("pull_request")
    elif isinstance(workflow_on, list):
        pr_config = "pull_request" if "pull_request" in workflow_on else None
    else:
        pr_config = None
    assert pr_config is not None, f"CI workflow does not configure 'pull_request' trigger: {workflow_on}"
    context.evaluated_event = "pull_request"
    context.workflow = workflow
