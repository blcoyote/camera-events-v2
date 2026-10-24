// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const css = readFileSync(
  fileURLToPath(new URL('./styles.css', import.meta.url)),
  'utf8',
)

describe('destructive fill token', () => {
  it('defines --gl-danger-fill as a primitive in :root', () => {
    expect(css).toContain('--gl-danger-fill: #c81e3a;')
  })

  it('points --destructive at the fill token, not the text token', () => {
    expect(css).toContain('--destructive: var(--gl-danger-fill);')
  })
})

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1
}

function rootBlock(): string {
  const start = css.indexOf(':root {')
  return css.slice(start, css.indexOf('\n}', start))
}

describe('glass fallback surface token', () => {
  it('defines --gl-surface-solid as a primitive in :root', () => {
    expect(css).toContain('--gl-surface-solid: rgba(255, 255, 255, 0.94);')
  })

  it('keeps the literal rgba(255, 255, 255, 0.94) only in :root', () => {
    expect(count(css, 'rgba(255, 255, 255, 0.94)')).toBe(1)
  })

  it('uses the token in the no-backdrop-filter fallback of glass, glass-flat and glass-strong', () => {
    expect(count(css, 'background: var(--gl-surface-solid);')).toBe(3)
  })
})

describe('backdrop blob tokens', () => {
  it('defines --gl-blob-1 and --gl-blob-2 as primitives in :root', () => {
    expect(css).toContain('--gl-blob-1: rgba(79, 140, 255, 0.45);')
    expect(css).toContain('--gl-blob-2: rgba(24, 86, 255, 0.28);')
  })

  it('body::before reads both blob tokens', () => {
    expect(css).toContain('rgba(79, 140, 255, 0.45)')
    expect(css).toMatch(/body::before\s*\{[\s\S]*?var\(--gl-blob-1\)/)
    expect(css).toMatch(/body::before\s*\{[\s\S]*?var\(--gl-blob-2\)/)
  })

  it('keeps each blob literal only in :root', () => {
    expect(count(css, 'rgba(79, 140, 255, 0.45)')).toBe(1)
    expect(count(css, 'rgba(24, 86, 255, 0.28)')).toBe(1)
    expect(rootBlock()).toContain('rgba(79, 140, 255, 0.45)')
    expect(rootBlock()).toContain('rgba(24, 86, 255, 0.28)')
  })
})

describe('event-card hover elevation token', () => {
  it('defines --gl-elev-raised-hover as a primitive in :root', () => {
    expect(css).toContain(
      '--gl-elev-raised-hover: 0 28px 88px rgba(79, 140, 255, 0.26);',
    )
  })

  it('.event-card:hover uses the token for its box-shadow', () => {
    expect(css).toMatch(
      /\.event-card:hover\s*\{[^}]*box-shadow: var\(--gl-elev-raised-hover\);/,
    )
  })

  it('keeps the hover shadow literal only in :root', () => {
    expect(count(css, '0 28px 88px rgba(79, 140, 255, 0.26)')).toBe(1)
    expect(rootBlock()).toContain('0 28px 88px rgba(79, 140, 255, 0.26)')
  })
})

// ---------------------------------------------------------------------------
// Guard: colour literals may only live inside :root / :root.dark blocks.
// ---------------------------------------------------------------------------

const COLOUR_DEFINITION_SELECTOR = /^:root(\.dark)?$/

function blankKeepingNewlines(text: string): string {
  return text.replace(/[^\n]/g, '')
}

/**
 * Removes CSS comments and the bodies of every top-level `:root {…}` and
 * `:root.dark {…}` block (brace-matched). Newlines are preserved so line
 * numbers in the result match the source.
 */
function stripColourDefinitionBlocks(source: string): string {
  const noComments = source.replace(/\/\*[\s\S]*?\*\//g, blankKeepingNewlines)
  let out = ''
  let depth = 0
  let selectorStart = 0
  for (let i = 0; i < noComments.length; i++) {
    const ch = noComments[i]
    if (ch === '{') {
      if (
        depth === 0 &&
        COLOUR_DEFINITION_SELECTOR.test(
          noComments.slice(selectorStart, i).trim(),
        )
      ) {
        let level = 1
        let j = i + 1
        while (j < noComments.length && level > 0) {
          if (noComments[j] === '{') level++
          else if (noComments[j] === '}') level--
          j++
        }
        out +=
          noComments.slice(selectorStart, i) +
          blankKeepingNewlines(noComments.slice(i, j))
        i = j - 1
        selectorStart = j
        continue
      }
      depth++
    } else if (ch === '}') {
      depth = Math.max(0, depth - 1)
      if (depth === 0) {
        out += noComments.slice(selectorStart, i + 1)
        selectorStart = i + 1
      }
    } else if (ch === ';' && depth === 0) {
      out += noComments.slice(selectorStart, i + 1)
      selectorStart = i + 1
    }
  }
  return out + noComments.slice(selectorStart)
}

/**
 * Finds colour literals (`rgb(`, `rgba(`, `#hex`) left after stripping the
 * definition blocks. Any text in `allowed` is removed from a line before it is
 * scanned.
 */
function findColourLiterals(
  source: string,
  allowed: string[] = [],
): { line: number; literal: string }[] {
  const found: { line: number; literal: string }[] = []
  stripColourDefinitionBlocks(source)
    .split('\n')
    .forEach((rawLine, index) => {
      const line = allowed.reduce((acc, a) => acc.split(a).join(''), rawLine)
      for (const m of line.matchAll(/rgba?\(|#[0-9a-fA-F]{3,8}\b/g)) {
        found.push({ line: index + 1, literal: m[0] })
      }
    })
  return found
}

describe('stripColourDefinitionBlocks', () => {
  it('blanks the body of a :root block but keeps its line count', () => {
    const src = ':root {\n  --a: #fff;\n}\n.x { color: red; }'
    const out = stripColourDefinitionBlocks(src)
    expect(out).not.toContain('#fff')
    expect(out).toContain('.x { color: red; }')
    expect(out.split('\n')).toHaveLength(src.split('\n').length)
  })

  it('strips every :root block and :root.dark blocks', () => {
    const src =
      ':root {\n--a: #111;\n}\n:root.dark {\n--a: #222;\n}\n:root {\n--b: rgb(1, 2, 3);\n}'
    const out = stripColourDefinitionBlocks(src)
    expect(out).not.toMatch(/#111|#222|rgb\(/)
  })

  it('handles nested braces inside a :root block', () => {
    const src =
      ':root {\n  --a: { x: 1 };\n  --b: #abc;\n}\n.y { color: #def; }'
    const out = stripColourDefinitionBlocks(src)
    expect(out).not.toContain('#abc')
    expect(out).toContain('#def')
  })

  it('removes CSS comments', () => {
    const out = stripColourDefinitionBlocks('/* #abc123 */\n.x { top: 0; }')
    expect(out).not.toContain('#abc123')
  })

  it('does not strip :root appearing inside a longer selector or nested at-rule block', () => {
    const src = '@layer base {\n  html:root-ish { color: #123; }\n}'
    expect(stripColourDefinitionBlocks(src)).toContain('#123')
  })
})

describe('findColourLiterals', () => {
  it('ignores literals inside :root', () => {
    expect(findColourLiterals(':root {\n  --a: #fff;\n}')).toEqual([])
  })

  it('reports literals outside :root with 1-based line numbers', () => {
    const src =
      ':root {\n  --a: #fff;\n}\n.x {\n  color: #abcdef;\n  background: rgba(1, 2, 3, 0.5);\n  border-color: rgb(0 0 0);\n}'
    expect(findColourLiterals(src)).toEqual([
      { line: 5, literal: '#abcdef' },
      { line: 6, literal: 'rgba(' },
      { line: 7, literal: 'rgb(' },
    ])
  })

  it('does not flag hex-like text inside a comment', () => {
    expect(findColourLiterals('/* #abc */\n.x { top: 0; }')).toEqual([])
  })
})

describe('styles.css colour-literal guard', () => {
  // Black image scrims / scanlines, intentionally not themeable.
  const ALLOWED = [
    'rgba(0, 0, 0, 0.035)',
    'rgba(0, 0, 0, 0.55)',
    'rgba(0, 0, 0, 0.15)',
  ]

  function violations(source: string): string[] {
    return findColourLiterals(source, ALLOWED).map(
      ({ line, literal }) => `line ${line}: ${literal}`,
    )
  }

  it('flags a stray literal in an inline stylesheet (guard self-check)', () => {
    const src = ':root {\n  --a: #fff;\n}\n.x {\n  color: #123456;\n}'
    expect(violations(src)).toEqual(['line 5: #123456'])
  })

  it('allows the black scrim values outside :root', () => {
    const src = '.x {\n  background: rgba(0, 0, 0, 0.55);\n}'
    expect(violations(src)).toEqual([])
  })

  it('flags a non-allow-listed rgba outside :root', () => {
    const src = '.x {\n  background: rgba(0, 0, 0, 0.9);\n}'
    expect(violations(src)).toEqual(['line 2: rgba('])
  })

  it('has no colour literals outside :root blocks in src/styles.css', () => {
    expect(violations(css), 'stray colour literals').toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Dark theme: :root.dark overrides (docs/specs/glassmorphism-dark-mode.md,
// table "Dark values (`:root.dark`)"). Rows marked "unchanged" are omitted.
// ---------------------------------------------------------------------------

const DARK_VALUES: [string, string][] = [
  ['color-scheme', 'dark'],
  ['--gl-bg', '#0b1424'],
  ['--gl-surface', 'rgba(22, 34, 58, 0.62)'],
  ['--gl-surface-warm', 'rgba(18, 30, 52, 0.55)'],
  ['--gl-surface-hover', 'rgba(30, 46, 76, 0.82)'],
  ['--gl-surface-solid', 'rgba(22, 34, 58, 0.96)'],
  ['--gl-fg', '#e6eefc'],
  ['--gl-fg-2', '#b6c4dc'],
  ['--gl-muted', '#8c9dba'],
  ['--gl-border', 'rgba(255, 255, 255, 0.1)'],
  ['--gl-border-soft', 'rgba(255, 255, 255, 0.06)'],
  ['--gl-accent-strong', '#8ab4ff'],
  ['--gl-accent-strong-hover', '#a9c7ff'],
  ['--gl-success-text', '#4ade80'],
  ['--gl-warn-text', '#fbbf24'],
  ['--gl-danger-text', '#fb7185'],
  ['--gl-danger-fill', '#dc2626'],
  ['--gl-overlay', 'rgba(2, 6, 14, 0.6)'],
  ['--gl-blob-1', 'rgba(79, 140, 255, 0.22)'],
  ['--gl-blob-2', 'rgba(24, 86, 255, 0.14)'],
  ['--gl-elev-raised', '0 24px 80px rgba(0, 0, 0, 0.45)'],
  ['--gl-elev-raised-hover', '0 28px 88px rgba(0, 0, 0, 0.55)'],
  ['--gl-elev-ring', '0 0 0 1px rgba(255, 255, 255, 0.1)'],
  ['--gl-focus-ring', '0 0 0 4px rgba(138, 180, 255, 0.45)'],
]

/** Declarations of the top-level block with the given selector, as a map. */
function declarationsOf(selector: string): Map<string, string> {
  const start = css.indexOf(`\n${selector} {`)
  const open = start === -1 ? css.indexOf(`${selector} {`) : start + 1
  if (open === -1) return new Map()
  const body = css.slice(open, css.indexOf('\n}', open))
  const decls = new Map<string, string>()
  for (const m of body.matchAll(
    /^\s*(--[\w-]+|color-scheme)\s*:\s*(.+?);\s*$/gm,
  )) {
    decls.set(m[1], m[2])
  }
  return decls
}

describe('dark token block (:root.dark)', () => {
  const dark = declarationsOf(':root.dark')

  it('is declared in src/styles.css', () => {
    expect(css).toContain(':root.dark {')
  })

  it('sits directly after the layer-1 :root block', () => {
    const rootEnd = css.indexOf('\n}', css.indexOf(':root {')) + 2
    const darkStart = css.indexOf(':root.dark {')
    expect(darkStart).toBeGreaterThan(rootEnd)
    const between = css
      .slice(rootEnd, darkStart)
      .replace(/\/\*[\s\S]*?\*\//g, '')
    expect(between.trim()).toBe('')
  })

  it.each(DARK_VALUES)('sets %s to its dark value', (name, value) => {
    expect(dark.get(name)).toBe(value)
  })

  it('declares no properties beyond the spec table', () => {
    const expected = new Set(DARK_VALUES.map(([name]) => name))
    expect([...dark.keys()].filter((name) => !expected.has(name))).toEqual([])
  })

  it('every non-unchanged spec property is also declared in :root', () => {
    const root = declarationsOf(':root')
    const missing = DARK_VALUES.map(([name]) => name).filter(
      (name) => !root.has(name),
    )
    expect(missing).toEqual([])
  })

  it('every non-unchanged spec property is declared in :root.dark', () => {
    const missing = DARK_VALUES.map(([name]) => name).filter(
      (name) => !dark.has(name),
    )
    expect(missing).toEqual([])
  })
})
