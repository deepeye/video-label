import { useEffect, useRef, useState } from 'react';
import type { ShotSegment } from '../../types';
import { tokens } from '../../styles/tokens';

interface StoryboardCardProps {
  segment: ShotSegment;
  isNew: boolean;
}

export function StoryboardCard({ segment, isNew }: StoryboardCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [thumbReady, setThumbReady] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handleLoaded = () => {
      video.currentTime = 0.5;
    };
    const handleSeeked = () => {
      setThumbReady(true);
    };
    video.addEventListener('loadeddata', handleLoaded);
    video.addEventListener('seeked', handleSeeked);
    return () => {
      video.removeEventListener('loadeddata', handleLoaded);
      video.removeEventListener('seeked', handleSeeked);
    };
  }, []);

  const duration = segment.end_ms - segment.start_ms;

  return (
    <div
      data-testid={`storyboard-card-${segment.id}`}
      style={{
        flexShrink: 0,
        width: 240,
        borderRadius: tokens.radius.md,
        overflow: 'hidden',
        background: tokens.color.neutral[0],
        border: `1px solid ${tokens.color.neutral[200]}`,
        boxShadow: tokens.shadow.sm,
        opacity: isNew ? 0 : 1,
        transform: isNew ? 'scale(0.85)' : 'scale(1)',
        transition: isNew
          ? `opacity ${tokens.duration.slow}ms ${tokens.ease.out}, transform 400ms ${tokens.ease.spring}`
          : 'none',
      }}
    >
      <div
        style={{
          width: '100%',
          height: 135,
          background: tokens.color.neutral[900],
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <video
          ref={videoRef}
          src={segment.clip_src}
          muted
          preload="metadata"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: thumbReady ? 1 : 0,
          }}
        />
        {!thumbReady && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: tokens.color.neutral[500],
              fontSize: 12,
            }}
          >
            加载中...
          </div>
        )}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '4px 8px',
            background: 'rgba(0,0,0,0.6)',
            color: '#fff',
            fontSize: 11,
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>{formatTime(segment.start_ms)}</span>
          <span>{formatTime(segment.end_ms)}</span>
        </div>
      </div>
      <div style={{ padding: tokens.space[3], display: 'flex', flexDirection: 'column', gap: tokens.space[2] }}>
        <div style={{ display: 'flex', gap: tokens.space[1], alignItems: 'center' }}>
          <span
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#6366F1',
            }}
          />
          <span style={{ fontSize: 13, fontWeight: 600, color: tokens.color.neutral[900] }}>
            {segment.camera_movement}
          </span>
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 11,
              color: tokens.color.neutral[500],
              padding: '2px 6px',
              borderRadius: tokens.radius.sm,
              background: tokens.color.neutral[100],
            }}
          >
            {segment.shot_type}
          </span>
        </div>
        <span style={{ fontSize: 11, color: tokens.color.neutral[400] }}>
          {formatDuration(duration)}
        </span>
      </div>
    </div>
  );
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function formatDuration(ms: number): string {
  const sec = (ms / 1000).toFixed(1);
  return `${sec}s`;
}
