import type { ReactNode } from 'react';
import { isNativeVideoFrameCallbackSupported } from '../lib/ext/videoFrameCallback';
import { tokens } from '../styles/tokens';

interface BrowserCompatGuardProps {
  children: ReactNode;
}

/**
 * 启动期检测关键浏览器特性。不满足直接显示遮罩, 不渲染主应用。
 *
 * 当前检测项:
 *   - requestVideoFrameCallback (Chrome 83+ / Edge 84+ / Safari 16+)
 */
export function BrowserCompatGuard({ children }: BrowserCompatGuardProps) {
  const missingFeatures: string[] = [];

  if (!isNativeVideoFrameCallbackSupported()) {
    missingFeatures.push('requestVideoFrameCallback');
  }

  if (missingFeatures.length > 0) {
    return (
      <div
        data-testid="browser-compat-guard"
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: tokens.space[3],
          padding: tokens.space[6],
          background: tokens.color.neutral[50],
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 28 }}>⚠️</div>
        <h2 style={{ margin: 0, color: tokens.color.neutral[900] }}>建议使用最新版 Chrome 或 Edge 演示</h2>
        <p style={{ margin: 0, color: tokens.color.neutral[500], maxWidth: 460 }}>
          当前浏览器缺少以下特性: <code>{missingFeatures.join(', ')}</code>
          <br />
          演示功能依赖这些特性，请升级浏览器后重试。
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: tokens.space[3],
            padding: `${tokens.space[2]}px ${tokens.space[4]}px`,
            borderRadius: tokens.radius.md,
            background: 'transparent',
            backgroundImage: tokens.brandGradient,
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            boxShadow: tokens.shadow.brand,
          }}
        >
          ↻ 刷新页面
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
