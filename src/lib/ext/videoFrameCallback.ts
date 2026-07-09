/**
 * requestVideoFrameCallback 兼容包装。
 *
 * - 浏览器环境且支持: 走原生 API
 * - 浏览器环境不支持: 降级到 requestAnimationFrame + 30fps polyfill
 * - jsdom 测试环境: 直接 no-op (返回 0)
 */

export interface FrameCallbackHandle {
  cancel(): void;
}

export type VideoFrameCallback = (
  now: number,
  metadata: { mediaTime: number; presentedFrames?: number },
) => void;

export function watchVideoFrames(video: HTMLVideoElement, cb: VideoFrameCallback): FrameCallbackHandle {
  // jsdom (test env): video 不会真播放, no-op
  if (typeof window === 'undefined') {
    return { cancel: () => {} };
  }

  // 原生 API (Chrome 83+ / Edge 84+ / Safari 16+)
  type V = HTMLVideoElement & {
    requestVideoFrameCallback?: (cb: (now: number, m: { mediaTime: number }) => void) => number;
    cancelVideoFrameCallback?: (id: number) => void;
  };
  const v = video as V;

  if (v.requestVideoFrameCallback) {
    let handle = 0;
    const tick = (now: number, metadata: { mediaTime: number }) => {
      cb(now, metadata);
      handle = v.requestVideoFrameCallback!(tick);
    };
    handle = v.requestVideoFrameCallback(tick);
    return {
      cancel: () => {
        if (v.cancelVideoFrameCallback) v.cancelVideoFrameCallback(handle);
      },
    };
  }

  // 降级: rAF 30fps 轮询
  let raf = 0;
  let lastT = 0;
  const tick = (t: number) => {
    if (t - lastT >= 1000 / 30) {
      lastT = t;
      cb(t, { mediaTime: video.currentTime });
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return { cancel: () => cancelAnimationFrame(raf) };
}

/**
 * 检测当前浏览器是否支持原生 requestVideoFrameCallback。
 * 用于启动期向用户提示「请使用最新 Chrome」(spec §7.3.1)。
 */
export function isNativeVideoFrameCallbackSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'requestVideoFrameCallback' in HTMLVideoElement.prototype;
}
