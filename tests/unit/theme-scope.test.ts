import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// FR-034 — next-themes mounts ONLY in the (auth), (landing-page) and
// (dashboard) group layouts; never in the root layout or the (redirect)
// public device surface. This static check guards the invariant cheaply.
const ROOT = path.resolve(import.meta.dirname, '../..');
const SCOPED = ['ThemeWrap', 'ThemeProvider', 'next-themes'];

describe('theme scope (FR-034)', () => {
  const themedGroups = [
    'app/(auth)/layout.tsx',
    'app/(landing-page)/layout.tsx',
    'app/(dashboard)/layout.tsx',
  ];

  it.each(themedGroups)('mounts the theme provider in %s', (group) => {
    const src = readFileSync(path.join(ROOT, group), 'utf8');
    expect(SCOPED.some((t) => src.includes(t))).toBe(true);
  });

  it('never mounts a theme provider in the root layout', () => {
    const src = readFileSync(path.join(ROOT, 'app/layout.tsx'), 'utf8');
    for (const token of SCOPED) expect(src).not.toContain(token);
  });

  it('never mounts a theme provider in the public (redirect) group', () => {
    const dir = path.join(ROOT, 'app/(redirect)');
    const files: string[] = [];
    for (const name of ['layout.tsx', 'error.tsx']) {
      try {
        files.push(readFileSync(path.join(dir, name), 'utf8'));
      } catch {
        /* child layouts may add more */
      }
    }
    for (const src of files) {
      for (const token of SCOPED) expect(src).not.toContain(token);
    }
  });
});
