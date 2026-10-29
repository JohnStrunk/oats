#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
mkdir -p "$root/.ci-linters/bin"
GOBIN="$root/.ci-linters/bin" go install github.com/rhysd/actionlint/cmd/actionlint@v1.7.11
python3 -m venv "$root/.ci-linters/venv"
# The requirements file pins every Python dependency to hashes, so pip refuses
# tampered or unexpected artifacts. `go install` relies on the Go checksum
# database for actionlint.
"$root/.ci-linters/venv/bin/python" -m pip install --require-hashes --disable-pip-version-check -r "$root/scripts/ci-linters-requirements.txt"
