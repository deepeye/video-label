import { describe, it, expect } from 'vitest';
import { formatDuration } from '@/lib/format/duration';

describe('formatDuration', () => {
  it('formats 30000 as 00:00:30.000', () => {
    expect(formatDuration(30000)).toBe('00:00:30.000');
  });
  it('formats 65500 as 00:01:05.500', () => {
    expect(formatDuration(65500)).toBe('00:01:05.500');
  });
  it('formats 3661123 as 01:01:01.123', () => {
    expect(formatDuration(3661123)).toBe('01:01:01.123');
  });
  it('formats 0 as 00:00:00.000', () => {
    expect(formatDuration(0)).toBe('00:00:00.000');
  });
});
