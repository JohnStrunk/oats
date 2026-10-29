import importlib.util
import pathlib
import sys

# Ensure repository root is in sys.path
_repo_root = pathlib.Path(__file__).resolve().parent.parent.parent
if str(_repo_root) not in sys.path:
    sys.path.insert(0, str(_repo_root))

# Dynamically import all step definitions from given/, when/, and then/ subdirectories
_steps_dir = pathlib.Path(__file__).resolve().parent
for _subdir in ["given", "when", "then"]:
    _dir_path = _steps_dir / _subdir
    if _dir_path.is_dir():
        for _py_file in sorted(_dir_path.glob("*.py")):
            if not _py_file.name.startswith(("_", ".")):
                _mod_name = f"steps_{_subdir}_{_py_file.stem.replace('-', '_')}"
                _spec = importlib.util.spec_from_file_location(_mod_name, _py_file)
                if _spec and _spec.loader:
                    _module = importlib.util.module_from_spec(_spec)
                    sys.modules[_mod_name] = _module
                    _spec.loader.exec_module(_module)
