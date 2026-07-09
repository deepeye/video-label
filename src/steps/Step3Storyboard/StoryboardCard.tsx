import { useCallback, useEffect, useRef, useState } from 'react';
import type { ShotSegment } from '../../types';
import { tokens } from '../../styles/tokens';

const CONTENT_TYPE_COLORS: Record<string, string> = {
  '美食': '#6366F1',
  '广告': '#F97316',
  '纪录片': '#10B981',
  '访谈': '#3B82F6',
  '医疗': '#EF4444',
};

interface StoryboardCardProps {
  segment: ShotSegment;
  isNew: boolean;
}

export function StoryboardCard({ segment, isNew }: StoryboardCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [thumbReady, setThumbReady] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const thumbAttemptedRef = useRef(false);

  // 截取第一帧作为封面
  const captureThumbnail = useCallback(() => {
    const video = videoRef.current;
    if (!video || thumbAttemptedRef.current) return;
    thumbAttemptedRef.current = true;

    const seekTo = video.duration >= 0.1 ? 0.1 : 0;

    const trySeek = () => {
      try {
        video.currentTime = seekTo;
      } catch {
        // seek 可能失败，标记加载完成让视频自己渲染
        setThumbReady(true);
      }
    };

    const handleSeeked = () => {
      setThumbReady(true);
    };

    const handleError = () => {
      // 加载失败时也标记完成
      setThumbReady(true);
    };

    video.addEventListener('seeked', handleSeeked, { once: true });
    video.addEventListener('error', handleError, { once: true });

    // 如果视频已加载足够数据，直接 seek
    if (video.readyState >= 2) {
      trySeek();
    } else {
      // 否则等 loadedmetadata 后再 seek
      const handleMeta = () => trySeek();
      video.addEventListener('loadedmetadata', handleMeta, { once: true });
      // canplay 作为后备
      const handleCanPlay = () => {
        if (!thumbAttemptedRef.current) {
          trySeek();
        }
      };
      video.addEventListener('canplay', handleCanPlay, { once: true });
    }
  }, []);

  // 初始化加载
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // 如果视频已经 ready，立即尝试截取
    if (video.readyState >= 1) {
      captureThumbnail();
    } else {
      const handleLoad = () => captureThumbnail();
      const handleError = () => setThumbReady(true);
      video.addEventListener('loadedmetadata', handleLoad, { once: true });
      video.addEventListener('error', handleError, { once: true });
      return () => {
        video.removeEventListener('loadedmetadata', handleLoad);
        video.removeEventListener('error', handleError);
      };
    }
  }, [captureThumbnail]);

  // 鼠标悬停播放
  const handleMouseEnter = useCallback(() => {
    setIsHovering(true);
    const video = videoRef.current;
    if (video) {
      video.muted = true;
      video.play().catch(() => {});
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovering(false);
    const video = videoRef.current;
    if (video) {
      video.pause();
      // 回到封面帧
      try {
        video.currentTime = video.duration >= 0.1 ? 0.1 : 0;
      } catch {
        // ignore
      }
    }
  }, []);

  const duration = segment.end_ms - segment.start_ms;

  return (
    <div
      data-testid={`storyboard-card-${segment.id}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        flexShrink: 0,
        width: 240,
        borderRadius: tokens.radius.md,
        overflow: 'hidden',
        background: tokens.color.neutral[0],
        border: `1px solid ${tokens.color.neutral[200]}`,
        boxShadow: tokens.shadow.sm,
        cursor: 'pointer',
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
          aspectRatio: '16 / 9',
          background: tokens.color.neutral[900],
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <video
          ref={videoRef}
          src={segment.clip_src}
          muted
          playsInline
          preload="auto"
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
        {/* 悬停指示器 */}
        {thumbReady && !isHovering && (
          <div
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              padding: '2px 6px',
              borderRadius: tokens.radius.sm,
              background: 'rgba(0,0,0,0.55)',
              color: '#fff',
              fontSize: 10,
              lineHeight: '16px',
              pointerEvents: 'none',
            }}
          >
            ▶ 预览
          </div>
        )}
        {isHovering && (
          <div
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              padding: '2px 6px',
              borderRadius: tokens.radius.sm,
              background: 'rgba(239,68,68,0.8)',
              color: '#fff',
              fontSize: 10,
              lineHeight: '16px',
              pointerEvents: 'none',
            }}
          >
            ● 播放中
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
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: tokens.color.neutral[900], lineHeight: '20px' }}>
            {segment.title}
          </span>
        </div>
        <div style={{ display: 'flex', gap: tokens.space[2], alignItems: 'center' }}>
          <span
            style={{
              fontSize: 11,
              color: tokens.color.neutral[0],
              padding: '1px 6px',
              borderRadius: tokens.radius.sm,
              background: CONTENT_TYPE_COLORS[segment.content_type] ?? tokens.color.neutral[400],
              fontWeight: 500,
            }}
          >
            {segment.content_type}
          </span>
          <span style={{ fontSize: 11, color: tokens.color.neutral[400] }}>
            {formatDuration(duration)}
          </span>
        </div>
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
