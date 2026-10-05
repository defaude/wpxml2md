# Project instructions

This project converts WordPress XML exports to Markdown using Deno.

- Read `.agents/skills/deno/SKILL.md` for Deno work.
- Use Deno 2.9 or newer and keep dependencies in `deno.json` and `deno.lock`.
- Use the built-in formatter, linter, type checker, and test runner.
- When Node or npm is needed, use the installation in `~/.n/bin`.
- Keep tests offline and use temporary directories for generated output.
- Do not modify a user's export or existing output while testing.

The Deno skill is vendored from <https://github.com/denoland/skills>, following
<https://deno.com/agents.md>.
