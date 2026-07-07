import '@tanstack/react-start/server-only'

/**
 * Runtime half of the /api/test-auth guard: whether the E2E test harness has
 * explicitly opted in via E2E_TEST=true. ANDed at the call site with the
 * build-time `import.meta.env.DEV` constant so that production builds — in
 * which `import.meta.env.DEV` is statically `false` — can never reach the
 * session-minting code, regardless of any runtime environment variable.
 */
export function isTestAuthEnabled(e2eTestEnv: string | undefined): boolean {
  return e2eTestEnv === 'true'
}
