import pathlib
import json5

def get_repo_root() -> pathlib.Path:
    return pathlib.Path(__file__).resolve().parent.parent.parent

def load_renovate_config() -> dict:
    repo_root = get_repo_root()
    path = repo_root / ".github" / "renovate.json5"
    if not path.exists():
        path = repo_root / ".github" / "renovate.json"
    assert path.exists(), f"Renovate configuration file not found at {path}"
    with open(path, "r", encoding="utf-8") as f:
        data = json5.load(f)
    assert isinstance(data, dict), f"Expected dictionary in {path}, got {type(data)}"
    return data
