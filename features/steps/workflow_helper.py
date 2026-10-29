import pathlib
import yaml

def get_repo_root() -> pathlib.Path:
    return pathlib.Path(__file__).resolve().parent.parent.parent

def load_ci_workflow() -> dict:
    workflow_path = get_repo_root() / ".github" / "workflows" / "ci.yml"
    assert workflow_path.exists(), f"CI workflow file not found at {workflow_path}"
    with open(workflow_path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    assert isinstance(data, dict), f"Expected YAML dict in {workflow_path}, got {type(data)}"
    return data

def get_workflow_triggers(workflow: dict) -> dict:
    triggers = workflow.get("on")
    if triggers is None:
        triggers = workflow.get(True, {})
    return triggers if isinstance(triggers, (dict, list)) else {}

def find_successful_ci_job(workflow: dict) -> tuple[str, dict]:
    jobs = workflow.get("jobs", {})
    for job_id, job in jobs.items():
        if isinstance(job, dict):
            if job.get("name") == "Successful CI" or job_id == "successful-ci":
                return job_id, job
    raise AssertionError("No job named 'Successful CI' found in CI workflow")

def evaluate_gate_conclusion(prereq_results: dict[str, str]) -> str:
    # If any prerequisite job is not success, gate fails
    for job_name, conclusion in prereq_results.items():
        if conclusion != "success":
            return "failure"
    return "success"
