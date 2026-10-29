from behave import when
from features.steps.workflow_helper import load_ci_workflow, get_workflow_triggers

@when(u'the CI workflow event dispatcher evaluates the dispatch event')
def step_impl(context):
    workflow = load_ci_workflow()
    workflow_on = get_workflow_triggers(workflow)
    if isinstance(workflow_on, dict):
        has_dispatch = "workflow_dispatch" in workflow_on
    elif isinstance(workflow_on, list):
        has_dispatch = "workflow_dispatch" in workflow_on
    else:
        has_dispatch = False
    assert has_dispatch, f"CI workflow does not configure 'workflow_dispatch' trigger: {workflow_on}"
    context.evaluated_event = "workflow_dispatch"
    context.workflow = workflow
