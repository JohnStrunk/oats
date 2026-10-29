import pathlib
import yaml

def get_repo_root() -> pathlib.Path:
    return pathlib.Path(__file__).resolve().parent.parent.parent

def load_mergify_config() -> dict:
    repo_root = get_repo_root()
    path = repo_root / ".github" / "mergify.yml"
    assert path.exists(), f"Mergify configuration file not found at {path}"
    with open(path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    assert isinstance(data, dict), f"Expected dict in {path}, got {type(data)}"
    return data

def get_default_queue_rule(config: dict) -> dict:
    rules = config.get("queue_rules", [])
    for rule in rules:
        if isinstance(rule, dict) and rule.get("name") == "default":
            return rule
    raise AssertionError(f"Default queue rule not found in queue_rules: {rules}")
