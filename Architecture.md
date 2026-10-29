# Project Architecture

## Main Components

- **`repo-infrastructure`**: Repository automation, continuous integration workflows, automated dependency maintenance, verification pipelines, code quality linters, and merge gate coordination.

## External Interfaces

- **`github-actions`**: GitHub Actions event hooks (pull requests, branch pushes, workflow dispatches) and the GitHub Checks API for job conclusion reporting and branch protection merge gating.
- **`renovate`**: Renovate bot configuration interface for automated dependency updates, digest pinning, release age cooldowns, and pull request rebasing.
- **`mergify`**: Mergify bot automation interface for merge queue management, automated qualification gating against CI checks, and pull request merging.
- **`cli`**: Developer and automation command-line interfaces for executing build tools, linters, and test runners locally or within CI containers.



