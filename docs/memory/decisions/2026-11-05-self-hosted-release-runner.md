---
tags: [decision, ci, deployment, portainer]
created: 2026-11-05
---

# Release workflow runs on a self-hosted runner in its own stack

> `promote-release.yml` runs on one self-hosted GitHub Actions runner, the
> `github-runner` service in `docker-compose.runner.yml`, deployed as its own
> Portainer stack. Neither app stack has a runner.

## Context

The app is deployed as two Portainer stacks: prod from `docker-compose.yml` and
test from `docker-compose.test.yml`. The release workflow re-tags the image in
GHCR and calls the Portainer stack webhooks. We wanted it to run on a local
runner so the webhooks can target Portainer on the LAN. A runner in both stacks
would register two runners for the same jobs.

## Decision

- **One runner, in its own stack.** `github-runner` is in
  `docker-compose.runner.yml`, not in either app compose file. Its label is
  `camera-events-deploy`. (Until 2026-11-11 it lived in the prod stack; it
  moved out so the prod webhook it calls cannot redeploy it mid-job.)
  Both promote jobs use `runs-on: [self-hosted, camera-events-deploy]`.
- **GitHub's official image,** `ghcr.io/actions/actions-runner`, pinned to a
  version. The image's user is `runner` and it has no entrypoint script, so
  nothing in the container runs as root.
- **No long-lived credential in the container.** It registers once with a
  one-hour registration token (stack variable
  `GITHUB_RUNNER_REGISTRATION_TOKEN`, from
  `POST /repos/{owner}/{repo}/actions/runners/registration-token`). The
  runner's install and registration live on the `ce-v2-runner` volume
  (mounted at `/home/runner`), so restarts skip registration and the expired
  token is never needed again. The start script unsets it before `run.sh`.
  To register again: remove the volume, set a fresh token, redeploy.
- **Persistent, not ephemeral.** Ephemeral needs a new registration per job,
  which means a credential that can mint tokens (a PAT or GitHub App key) in
  the container. Jobs run as the same user as the runner, so they could read
  it.
- **Hardening:**
  - No Docker socket.
  - `no-new-privileges` blocks the image's passwordless `sudo`, so jobs
    cannot become root in the container.
  - Its own `ci-runner` network keeps it off `ce-v2-network`.
  - It reaches Portainer over `portainer-webhooks`, an external network shared
    only with the Portainer container. The webhook secrets point at
    `http://portainer:9000/api/stacks/webhooks/<id>`, so the calls never leave
    Docker. We did not use the `proxy` network: that would also put the runner
    next to Traefik and everything it routes to.
- **Pinned image.** The runner binary updates itself inside the volume.
  Because the volume holds the install, bumping the image tag only takes
  effect after the volume is recreated (and the runner registered again).
  GHCR publishes no major-only tag (`:2`), only exact versions and `:latest`.
- **No Docker daemon in the workflow:** the retag uses `crane tag` (via
  `imjasonh/setup-crane`) instead of `docker buildx imagetools create`. `crane`
  talks to the registry directly and keeps the multi-arch index digest.
- **Known limits (accepted):**
  - Jobs share one filesystem and user with the runner. A compromised job can
    read the runner's own credentials (which only let it act as this runner)
    and leave files that affect later jobs. It cannot get root or repo admin
    rights.
  - Host-published ports stay reachable through the host's address, like from
    any LAN machine. That covers MQTT on 1883 (password-protected). Blocking
    that needs host firewall rules, not compose.

## Alternatives

- **Runner in the prod app stack (first version).** Replaced: the prod job
  calls the prod stack webhook, which redeployed the stack holding the runner,
  so a changed image could recreate the container mid-job. That needed
  `pull_policy: missing` as a workaround.
- **Compose profile enabled in one stack only.** Not needed: test and prod
  already use separate compose files.
- **Mount the Docker socket and keep `buildx imagetools`.** Rejected: the
  socket gives root on the host.
- **`myoung34/github-runner` with a PAT (first version of this PR).**
  Rejected: its entrypoint runs as root and executes `config.sh` from the
  runner-writable install, both at registration and in the exit trap. A job
  could rewrite it and get root with the PAT in the environment;
  `no-new-privileges` does not stop that.

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
