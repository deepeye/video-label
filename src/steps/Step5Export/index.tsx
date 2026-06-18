import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useDemoStore } from '../../store/demoStore';
import { getDataset } from '../../data';
import { tokens } from '../../styles/tokens';
import { FormatSwitch } from './FormatSwitch';
import { JsonPreview } from './JsonPreview';
import { downloadExportZip } from './exportZip';
import { toNative } from '../../lib/format/native';
import { toCocoVideo } from '../../lib/format/cocoVideo';
import type { ExportFormat } from './manifest';

export function Step5Export() {
  const datasetId = useDemoStore((s) => s.activeDatasetId);
  const annotations = useDemoStore((s) => s.annotations);
  const [format, setFormat] = useState<ExportFormat>('native');
  const [downloading, setDownloading] = useState(false);

  const dataset = getDataset(datasetId);
  // 预览用稳定的 exported_at (0), 避免每次 render 时间变化
  const previewJson = useMemo(() => {
    return format === 'native'
      ? toNative(annotations, dataset, 0)
      : toCocoVideo(annotations, dataset, 0);
  }, [format, annotations, dataset]);

  const stats = useMemo(() => {
    const s = { total: annotations.length, accepted: 0, corrected: 0, rejected: 0, pending: 0 };
    for (const a of annotations) s[a.review.status]++;
    return s;
  }, [annotations]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadExportZip({
        format,
        annotations,
        dataset,
        exportedAt: Date.now(),
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      data-testid="step5-export"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: tokens.space[6],
        gap: tokens.space[4],
        overflow: 'auto',
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: 28,
          fontWeight: 600,
          color: tokens.color.neutral[900],
        }}
      >
        ⑤ 导出标注结果
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: tokens.space[5] }}>
        <section>
          <Header text="格式" />
          <FormatSwitch value={format} onChange={setFormat} />

          <div style={{ marginTop: tokens.space[5] }}>
            <Header text="本次导出统计" />
            <div
              style={{
                padding: tokens.space[4],
                borderRadius: tokens.radius.md,
                background: tokens.color.neutral[0],
                border: `1px solid ${tokens.color.neutral[200]}`,
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: tokens.space[2],
                fontSize: 13,
              }}
            >
              <Stat label="总计" value={stats.total} />
              <Stat label="已接受" value={stats.accepted} color={tokens.color.success[500]} />
              <Stat label="已纠正" value={stats.corrected} color={tokens.color.info[500]} />
              <Stat label="已否决" value={stats.rejected} color={tokens.color.neutral[500]} />
              <Stat label="待审核" value={stats.pending} color={tokens.color.warning[500]} />
            </div>
          </div>

          <button
            data-testid="download-btn"
            onClick={handleDownload}
            disabled={downloading}
            style={downloadBtnStyle(downloading)}
          >
            {downloading ? '⏳ 打包中...' : `↓ 下载导出包 (${dataset.dataset_id}_export.zip)`}
          </button>
        </section>

        <section>
          <Header text="预览 (实时反映你刚才的审核改动)" />
          <JsonPreview json={previewJson} />
        </section>
      </div>
    </div>
  );
}

function downloadBtnStyle(downloading: boolean): CSSProperties {
  return {
    marginTop: tokens.space[5],
    width: '100%',
    height: 44,
    borderRadius: tokens.radius.md,
    background: 'transparent',
    backgroundImage: tokens.brandGradient,
    color: '#fff',
    border: 'none',
    fontSize: 14,
    fontWeight: 600,
    cursor: downloading ? 'wait' : 'pointer',
    boxShadow: tokens.shadow.brand,
    opacity: downloading ? 0.7 : 1,
  };
}

function Header({ text }: { text: string }) {
  return (
    <div
      style={{
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: tokens.color.neutral[400],
        marginBottom: tokens.space[2],
      }}
    >
      {text}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ color: tokens.color.neutral[500] }}>{label}</span>
      <span className="tabular" style={{ fontWeight: 600, color: color ?? tokens.color.neutral[900] }}>
        {value}
      </span>
    </div>
  );
}
