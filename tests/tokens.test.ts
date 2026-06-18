import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tokens } from '@/styles/tokens';

const cssFile = readFileSync(resolve(__dirname, '../src/styles/globals.css'), 'utf-8');

function readVar(name: string): string {
  const match = cssFile.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!match) throw new Error(`CSS var --${name} not found`);
  return match[1]!.trim();
}

describe('tokens TS / CSS consistency', () => {
  it('brand colors match', () => {
    expect(readVar('brand-400')).toBe(tokens.color.brand[400]);
    expect(readVar('brand-500')).toBe(tokens.color.brand[500]);
    expect(readVar('brand-600')).toBe(tokens.color.brand[600]);
    expect(readVar('accent-500')).toBe(tokens.color.accent[500]);
  });

  it('neutral colors match', () => {
    expect(readVar('neutral-0')).toBe(tokens.color.neutral[0]);
    expect(readVar('neutral-50')).toBe(tokens.color.neutral[50]);
    expect(readVar('neutral-100')).toBe(tokens.color.neutral[100]);
    expect(readVar('neutral-200')).toBe(tokens.color.neutral[200]);
    expect(readVar('neutral-400')).toBe(tokens.color.neutral[400]);
    expect(readVar('neutral-500')).toBe(tokens.color.neutral[500]);
    expect(readVar('neutral-700')).toBe(tokens.color.neutral[700]);
    expect(readVar('neutral-900')).toBe(tokens.color.neutral[900]);
  });

  it('functional colors match', () => {
    expect(readVar('success-500')).toBe(tokens.color.success[500]);
    expect(readVar('warning-500')).toBe(tokens.color.warning[500]);
    expect(readVar('info-500')).toBe(tokens.color.info[500]);
    expect(readVar('danger-500')).toBe(tokens.color.danger[500]);
  });

  it('radius matches (CSS adds px suffix)', () => {
    expect(readVar('radius-sm')).toBe(`${tokens.radius.sm}px`);
    expect(readVar('radius-md')).toBe(`${tokens.radius.md}px`);
    expect(readVar('radius-lg')).toBe(`${tokens.radius.lg}px`);
    expect(readVar('radius-xl')).toBe(`${tokens.radius.xl}px`);
  });

  it('spacing matches', () => {
    expect(readVar('space-1')).toBe(`${tokens.space[1]}px`);
    expect(readVar('space-4')).toBe(`${tokens.space[4]}px`);
    expect(readVar('space-8')).toBe(`${tokens.space[8]}px`);
  });

  it('duration matches (CSS adds ms suffix)', () => {
    expect(readVar('duration-fast')).toBe(`${tokens.duration.fast}ms`);
    expect(readVar('duration-base')).toBe(`${tokens.duration.base}ms`);
    expect(readVar('duration-slow')).toBe(`${tokens.duration.slow}ms`);
  });
});
