# Agentic development template

This template is designed to help you create an agentic development
environment for your projects. It is based on the dark-factory model, which
emphasizes the use of autonomous agents to manage and execute tasks in a
development workflow.

## How to Use This Template

1. Work with your agent to define the project vision: [Vision.md](Vision.md).
   This document should describe the overall, high-level vision for the
   project, including what is being built, who it is being built for, and why
   it is being built.
2. Work with your agent to define the system architecture:
   [Architecture.md](Architecture.md). This document should describe the
   overall system architecture, including the components, interfaces, and data
   flows.
3. Work with your agent to iteratively define the requirements for what the
   system should do, and how it should behave. These requirements will be
   expressed in EARS (Easy Approach to Requirements Syntax) and will drive the
   creation of Gherkin feature files and step definitions. The team of agents
   will then implement the system to satisfy these requirements, and verify
   that the implementation meets the requirements.

## Initial set of requirements

This template includes an initial set of requirements for setting up CI,
linting, Renovate dependency management, and Mergify merge queue automation in
`features/repo-infrastructure/`. While the EARS requirements should be able to be
used and refined as desired, you may want to have your agent re-write the step
files into whatever language is chosen for the project as a whole.

### Running the Verification Suite

To verify the repository infrastructure specifications without installing local
virtual environments or project manifests:

```bash
uvx --with pyyaml --with json5 behave
```

