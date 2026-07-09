import { tokens } from '../../styles/tokens';
import { DropZone } from './DropZone';
import { SampleCards } from './SampleCards';

export function Step1Upload() {
  return (
    <div
      data-testid="step1-upload"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: tokens.space[8],
        gap: tokens.space[6],
        overflow: 'auto',
      }}
    >
      <h2 style={{ margin: 0, fontSize: 28, fontWeight: 600, color: tokens.color.neutral[900] }}>
        ① 上传视频
      </h2>
      <DropZone />
      <div style={{ width: '100%', maxWidth: 720 }}>
        <div
          style={{
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: tokens.color.neutral[400],
            marginBottom: tokens.space[3],
          }}
        >
          推荐样例（点击即用，数据已就绪）
        </div>
        <SampleCards />
      </div>
    </div>
  );
}
