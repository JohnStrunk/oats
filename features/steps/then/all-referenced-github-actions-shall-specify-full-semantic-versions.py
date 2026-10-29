import re
from behave import then

SEMVER_PATTERN = re.compile(r"^v?[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$")
SHA_PATTERN = re.compile(r"^[0-9a-fA-F]{40}$")

@then(u'all referenced GitHub Actions shall specify full semantic versions')
def step_impl(context):
    actions = getattr(context, "workflow_actions", [])
    assert len(actions) > 0, "No workflow actions to verify"

    failures = []
    for action in actions:
        action_ref = action["action_ref"]
        comment = action["comment"]
        file_loc = f"{action['file']}:{action['line']}"

        assert "@" in action_ref, f"Action reference '{action_ref}' at {file_loc} missing '@' separator"
        _name, ref = action_ref.split("@", 1)

        if SHA_PATTERN.match(ref):
            # Digest-pinned action: version must be specified in the trailing comment
            if not comment:
                failures.append(f"{file_loc}: digest '{ref[:7]}' missing version comment (# vX.Y.Z)")
            elif not SEMVER_PATTERN.match(comment):
                failures.append(
                    f"{file_loc}: digest comment '{comment}' is not a full semantic version vX.Y.Z"
                )
        else:
            # Tag-referenced action: ref itself must be a full semantic version
            if not SEMVER_PATTERN.match(ref):
                failures.append(
                    f"{file_loc}: action version ref '{ref}' is not a full semantic version vX.Y.Z"
                )

    assert not failures, "The following GitHub Actions are not specified via full vX.Y.Z:\n" + "\n".join(failures)
