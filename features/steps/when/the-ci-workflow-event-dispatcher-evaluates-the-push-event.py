from behave import when
from features.steps.workflow_helper import load_ci_workflow, get_workflow_triggers

@when(u'the CI workflow event dispatcher evaluates the push event')
def step_impl(context):
    workflow = load_ci_workflow()
    workflow_on = get_workflow_triggers(workflow)
    if isinstance(workflow_on, dict):
        push_config = workflow_on.get("push")
    elif isinstance(workflow_on, list):
        push_config = "push" if "push" in workflow_on else None
    else:
        push_config = None
    assert push_config is not None, f"CI workflow does not configure 'push' trigger: {workflow_on}"
    context.evaluated_event = "push"
    context.workflow = workflow
