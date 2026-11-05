---
tags: [decision, ci, deployment, portainer]
created: 2026-11-05
---

# Release workflow runs on a self-hosted runner in the prod stack

> `promote-release.yml` runs on one self-hosted GitHub Actions runner, the
> `github-runner` service in `docker-compose.yml` (the Portainer **prod**
> stack). The test stack has no runner.

## Context

The app is deployed as two Portainer stacks: prod from `docker-compose.yml` and
test from `docker-compose.test.yml`. The release workflow re-tags the image in
GHCR and calls the Portainer stack webhooks. We wanted it to run on a local
runner so the webhooks can target Portainer on the LAN. A runner in both stacks
would register two runners for the same jobs.

## Decision

- **One runner, prod stack only.** `github-runner` (`myoung34/github-runner`)
  is in `docker-compose.yml` and not in `docker-compose.test.yml`. Its label is
  `camera-events-deploy`. Both promote jobs use
  `runs-on: [self-hosted, camera-events-deploy]`.
- **Registration:** `ACCESS_TOKEN` comes from the stack variable
  `GITHUB_RUNNER_TOKEN`, a fine-grained PAT for this repo only, with
  "Administration: Read and write". The container registers itself again on
  every start.
- **Hardening:** ephemeral (re-registers after each job), runs as a non-root
  user, no Docker socket, its own `ci-runner` network (no route to the app or
  RabbitMQ).
- **No Docker daemon in the workflow:** the retag uses `crane tag` (via
  `imjasonh/setup-crane`) instead of `docker buildx imagetools create`. `crane`
  talks to the registry directly and keeps the multi-arch index digest.
- **`pull_policy: missing`** on the runner. The prod job calls the prod stack
  webhook, which redeploys the stack that holds the runner. With `always`, a
  new runner image would recreate the container while it is finishing that
  job. The runner binary updates itself inside the container. To update the
  image, pull it by hand in Portainer.

## Alternatives

- **Separate `ci-runner` stack.** Avoids the self-redeploy edge case
  completely. Not chosen because the request was to keep it in the app stack.
  Moving it out later only means copying the service into its own compose file.
- **Compose profile enabled in one stack only.** Not needed: test and prod
  already use separate compose files.
- **Mount the Docker socket and keep `buildx imagetools`.** Rejected: the
  socket gives root on the host.

## Why it matters

- The repo is **public**. A pull request from a fork can change a workflow to
  `runs-on: self-hosted` and run code on this machine. Repo setting
  _Actions → General → "Require approval for all external contributors"_ must
  stay on. The hardening above limits the damage if that fails.
- If the runner is offline, release jobs wait in the queue (up to 24 h) and do
  not fail over to GitHub-hosted runners.
- Build and PR workflows still run on GitHub-hosted runners.

## Related

- [[Home]]
