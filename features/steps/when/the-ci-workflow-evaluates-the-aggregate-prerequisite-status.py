from behave import when
from features.steps.workflow_helper import load_ci_workflow, find_successful_ci_job, evaluate_gate_conclusion

@when(u'the CI workflow evaluates the aggregate prerequisite status')
def step_impl(context):
    workflow = load_ci_workflow()
    job_id, job = find_successful_ci_job(workflow)
    
    # Verify the Successful CI job depends on upstream jobs via needs
    needs = job.get("needs", [])
    if isinstance(needs, str):
        needs = [needs]
    assert len(needs) > 0, f"'Successful CI' job must have non-empty 'needs' dependency list, got {needs}"
    
    # Verify if: always() is set so it handles failure or cancellation
    job_condition = str(job.get("if", ""))
    assert "always()" in job_condition, f"'Successful CI' job must specify 'if: always()', got {job_condition}"
    
    # Evaluate aggregate conclusion based on input job results
    job_results = getattr(context, "job_results", {})
    context.gate_executed = True
    context.actual_conclusion = evaluate_gate_conclusion(job_results)
