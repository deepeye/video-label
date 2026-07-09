import { useState } from 'react';
import { useDemoStore } from '../../store/demoStore';
import { tokens } from '../../styles/tokens';
import { UploadingToast, InfoToast } from './UploadingToast';

type Phase = 'idle' | 'uploading' | 'just-fallback';

export function DropZone() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [filename, setFilename] = useState('');
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [fallbackToast, setFallbackToast] = useState<string | null>(null);
  const selectDataset = useDemoStore((s) => s.selectDataset);
  const goToStep = useDemoStore((s) => s.goToStep);

  const handleFiles = (files: FileList) => {
    const f = files[0];
    if (!f) return;
    if (!f.type.startsWith('video/')) {
      setErrorToast('请拖入视频文件，或直接选用样例');
      setTimeout(() => setErrorToast(null), 3000);
      return;
    }
    setFilename(f.name);
    setPhase('uploading');
  };

  const onUploadDone = () => {
    setPhase('just-fallback');
    setFallbackToast(
      '为了让演示更贴近真实标注效果，已为您切换至『城市道路』样例数据。您上传的文件不会上传至任何服务器。',
    );
    selectDataset('jiazhengnvhuang_13');
    setTimeout(() => {
      setFallbackToast(null);
      goToStep(2);
    }, 2000);
  };

  return (
    <div data-testid="drop-zone">
      <div
        onDrop={(e) => {
          e.preventDefault();
          if (phase === 'idle') handleFiles(e.dataTransfer.files);
        }}
        onDragOver={(e) => e.preventDefault()}
        style={{
          padding: tokens.space[8],
          borderRadius: tokens.radius.lg,
          border: `2px dashed ${tokens.color.neutral[200]}`,
          background: tokens.color.neutral[0],
          textAlign: 'center',
          maxWidth: 640,
        }}
      >
        <div style={{ fontSize: 14, color: tokens.color.neutral[500], marginBottom: tokens.space[3] }}>
          拖入视频或选择下方样例
        </div>
        <label
          style={{
            display: 'inline-block',
            padding: `${tokens.space[2]}px ${tokens.space[4]}px`,
            borderRadius: tokens.radius.md,
            background: 'transparent',
            backgroundImage: tokens.brandGradient,
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: tokens.shadow.brand,
          }}
        >
          选择文件
          <input
            type="file"
            accept="video/*"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
            style={{ display: 'none' }}
            data-testid="file-input"
          />
        </label>
      </div>

      {phase === 'uploading' && <UploadingToast filename={filename} onDone={onUploadDone} />}
      {errorToast && <InfoToast text={errorToast} onClose={() => setErrorToast(null)} />}
      {fallbackToast && <InfoToast text={fallbackToast} onClose={() => setFallbackToast(null)} />}
    </div>
  );
}
