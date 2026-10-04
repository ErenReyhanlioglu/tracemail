# TraceMail

A data system that processes a job-application mailbox every hour, tracks the
status of each application, matches postings against a hand-written profile,
and publishes its own operational and LLM-quality metrics on a public health
panel.

- What it does and why: [SUMMARY.md](SUMMARY.md)
- Architecture decisions: [docs/adr/](docs/adr/README.md)
- Build order and current phase: [docs/roadmap.md](docs/roadmap.md)

## Development

Requires [uv](https://docs.astral.sh/uv/) and [just](https://just.systems/).

```sh
uv sync          # create the environment from uv.lock
just check       # lint, typecheck, test
```
