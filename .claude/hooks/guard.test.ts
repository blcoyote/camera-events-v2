import { describe, expect, it } from 'vitest'
import { evaluate } from './guard'

const decision = (command: string, branch = 'feat/x') =>
  evaluate(command, branch)?.decision ?? null

describe('evaluate', () => {
  describe('allowed', () => {
    it.each([
      'git checkout -b feat/foo',
      'git switch -c feat/foo',
      'git push',
      'git push -u origin feat/foo',
      'git commit -m "x"',
      'gh pr create --title t --body b',
      'gh pr view 12',
      'gh api repos/o/r/pulls',
      'cat .env.example',
      'bun run test',
      "ssh -o BatchMode=yes pi5.local 'docker ps --format x'",
    ])('%s', (cmd) => expect(decision(cmd)).toBeNull())

    it('allows a push from a feature branch, denies bare push from main', () => {
      expect(decision('git push', 'feat/x')).toBeNull()
      expect(decision('git push', 'main')).toBe('deny')
    })
  })

  describe('denied', () => {
    it.each([
      'git push --force',
      'git push -f origin feat',
      'git push --force-with-lease origin feat',
      'git push origin --delete feat',
      'git push origin +feat',
      'git push origin main',
      'git push origin HEAD:main',
      'git -C . push --force',
      'bash -c "git push -f"',
      'git add . && git push --force',
      'rm -rf /',
      'rm -rf ~',
      'rm -fr $HOME',
      'rm -rf .',
      'rm -rf *',
      'docker volume rm ce-v2-data',
      'docker volume prune -f',
      'docker system prune -a',
      'docker compose down -v',
      'rm data/camera-events.db',
      'rm data/camera-events.db-wal',
      'sqlite3 data/camera-events.db "DROP TABLE x"',
      'gh api -X DELETE repos/o/r',
      'gh api --method PATCH repos/o/r',
      'gh repo delete o/r',
      'cat .env',
      'grep SECRET .env.local',
      'printenv',
      'echo $SESSION_SECRET',
    ])('%s', (cmd) => expect(decision(cmd)).toBe('deny'))
  })

  describe('ask', () => {
    it.each([
      'git reset --hard HEAD~1',
      'git branch -D feat',
      'git clean -fd',
      'git checkout .',
      'git restore .',
      'git stash drop',
      'rm -r src/old',
      'rm -rf ./dist',
      'rm -rf node_modules',
      "ssh pi5.local 'docker restart x'",
      'bd delete ce-1',
    ])('%s', (cmd) => expect(decision(cmd)).toBe('ask'))
  })

  it('returns a reason', () => {
    expect(evaluate('git push -f', 'x')?.reason).toMatch(/force/i)
  })
})
