/**
 * Resolve the supported OpenCode host version from the dependency pin.
 *
 * `.github/tooling/opencode-host/package.json` is the single source of truth
 * for the host version. Harnesses must derive their expected version from it
 * instead of keeping a second literal that silently drifts on upgrade.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
export const HOST_MANIFEST_PATH = path.join(
  REPO_ROOT,
  ".github/tooling/opencode-host/package.json",
);

// Ranges, tags, and prereleases do not identify one reproducible host build,
// so only an exact release may select the tested host. Each numeric component
// must be `0` or start with a nonzero digit so that invalid semantic versions
// such as `02.0.32` are rejected.
const EXACT_RELEASE = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/;

// npm's semver parser rejects versions whose numeric components exceed
// Number.MAX_SAFE_INTEGER. Compare digit strings rather than parsing numbers so
// that an oversized component cannot lose precision and pass validation.
const MAX_SAFE_COMPONENT = "9007199254740991";

function isSafeComponent(component) {
  return (
    component.length < MAX_SAFE_COMPONENT.length ||
    (component.length === MAX_SAFE_COMPONENT.length &&
      component <= MAX_SAFE_COMPONENT)
  );
}

export function isExactRelease(value) {
  return (
    typeof value === "string" &&
    EXACT_RELEASE.test(value) &&
    value.split(".").every(isSafeComponent)
  );
}

export function configuredHostVersion() {
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(HOST_MANIFEST_PATH, "utf8"));
  } catch (error) {
    throw new Error(
      `Cannot read the configured OpenCode host pin from ${HOST_MANIFEST_PATH}: ${error.message}`,
      { cause: error },
    );
  }
  const pin = manifest?.dependencies?.["@opencode/cli"];
  if (!isExactRelease(pin)) {
    throw new Error(
      `The configured @opencode/cli pin in ${HOST_MANIFEST_PATH} must be an exact release (x.y.z), got: ${JSON.stringify(pin)}`,
    );
  }
  return pin;
}
