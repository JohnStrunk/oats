@ears:state-driven @component:repo-infrastructure @interface:cli
Feature: While a runner-contract subprocess executes, the repository infrastructure shall prevent its writes from extending regular files beyond approximately 8 MiB

  The per-file ceiling applies during writes, including writes by inherited
  descendants and writes to the report, probe, or other regular files. The permitted
  ceiling is at least 8 MiB and at most 8 MiB plus 512 bytes. It is not an
  aggregate disk quota or isolation from other processes of the same user.
  The limit does not truncate pre-existing files that are already larger.
  Existing report and probe read limits remain 8 MiB and 64 KiB respectively.

  Scenario: Files below the ceiling remain writable
    When the runner contract executes a sandbox that writes varying permitted file sizes
    Then the sandbox file writes and runner shall succeed

  Scenario Outline: Oversized writes are stopped during execution
    When the runner contract executes a sandbox that writes an oversized <file> using a <writer>
    Then the oversized sandbox write shall fail at the per-file ceiling

    Examples:
      | file   | writer     |
      | other  | direct     |
      | probe  | direct     |
      | report | direct     |
      | other  | descendant |
