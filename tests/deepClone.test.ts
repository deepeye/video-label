import { describe, it, expect } from 'vitest';
import { deepClone } from '@/lib/deepClone';

describe('deepClone', () => {
  it('clones nested objects without sharing references', () => {
    const src = { a: { b: { c: 1 } }, list: [1, 2, { d: 3 }] };
    const out = deepClone(src);
    expect(out).toEqual(src);
    expect(out).not.toBe(src);
    expect(out.a).not.toBe(src.a);
    expect(out.a.b).not.toBe(src.a.b);
    expect(out.list).not.toBe(src.list);
    expect(out.list[2]).not.toBe(src.list[2]);
  });

  it('handles arrays and primitives', () => {
    expect(deepClone([1, 2, 3])).toEqual([1, 2, 3]);
    expect(deepClone('hello')).toBe('hello');
    expect(deepClone(42)).toBe(42);
    expect(deepClone(null)).toBe(null);
  });

  it('mutating clone does not affect source', () => {
    const src: { items: number[] } = { items: [1, 2] };
    const out = deepClone(src);
    out.items.push(3);
    expect(src.items).toEqual([1, 2]);
    expect(out.items).toEqual([1, 2, 3]);
  });
});
