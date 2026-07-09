import { describe, it, expect } from 'vitest';
import { createSnapshot } from '@/store/snapshots';
import { getDataset } from '@/data';

describe('snapshot factory', () => {
  it('creates a deep clone of dataset annotations', () => {
    const snap = createSnapshot('city-road');
    const source = getDataset('city-road');
    expect(snap.annotations).toEqual(source.annotations);
    expect(snap.annotations).not.toBe(source.annotations);
    expect(snap.annotations[0]).not.toBe(source.annotations[0]);
  });

  it('mutating snapshot does not affect source dataset', () => {
    const snap = createSnapshot('city-road');
    const source = getDataset('city-road');
    snap.annotations[0]!.review.status = 'accepted';
    expect(source.annotations[0]!.review.status).toBe('pending');
  });

  it('two snapshots are independent', () => {
    const a = createSnapshot('city-road');
    const b = createSnapshot('city-road');
    a.annotations[0]!.review.status = 'accepted';
    expect(b.annotations[0]!.review.status).toBe('pending');
  });

  it('snapshot includes initial timestamping demo state', () => {
    const snap = createSnapshot('city-road');
    expect(snap.demoStep).toBe(1);
    expect(snap.speed).toBe('1x');
    expect(snap.dirty).toBe(false);
    expect(snap.events).toEqual([]);
    expect(snap.selectedEventId).toBeNull();
    expect(snap.timelineTool).toBe('browse');
    expect(snap.currentTimeMs).toBe(0);
    expect(snap.playbackState).toBe('paused');
    expect(snap.pendingSeekMs).toBeNull();
    expect(snap.seekNonce).toBe(0);
    expect(snap.undoStack).toEqual([]);
    expect(snap.revealProgress).toEqual({
      metadataFieldsShown: 0,
      inferenceProgress: 0,
      boxesRevealed: 0,
    });
  });
});
