import { useDemoStore } from '../../store/demoStore';
import { tokens } from '../../styles/tokens';
import type { DatasetId } from '../../types';

interface SampleCardData {
  id: DatasetId;
  display: string;
  duration: string;
  resolution: string;
  thumb: string;
}

const SAMPLES: SampleCardData[] = [
  { id: 'city-road',    display: '城市道路', duration: '0:30', resolution: '1080p', thumb: '/mock/city-road/road_thumb.jpg' },
  { id: 'meeting-room', display: '室内会议', duration: '0:45', resolution: '720p',  thumb: '/mock/meeting-room/meeting_thumb.jpg' },
  { id: 'retail-cam',   display: '商超监控', duration: '1:00', resolution: '1080p', thumb: '/mock/retail-cam/retail_thumb.jpg' },
];

export function SampleCards() {
  const activeId = useDemoStore((s) => s.activeDatasetId);
  const selectDataset = useDemoStore((s) => s.selectDataset);
  const goToStep = useDemoStore((s) => s.goToStep);

  const handleSelect = (id: DatasetId) => {
    selectDataset(id);
    goToStep(2);
  };

  return (
    <div data-testid="sample-cards" style={{ display: 'flex', gap: tokens.space[4] }}>
      {SAMPLES.map((s) => {
        const active = activeId === s.id;
        return (
          <button
            key={s.id}
            data-testid={`sample-card-${s.id}`}
            onClick={() => handleSelect(s.id)}
            style={{
              width: 200,
              padding: 0,
              border: `2px solid ${active ? tokens.color.brand[500] : tokens.color.neutral[200]}`,
              borderRadius: tokens.radius.lg,
              overflow: 'hidden',
              background: tokens.color.neutral[0],
              cursor: 'pointer',
              boxShadow: active ? tokens.shadow.brand : tokens.shadow.sm,
              textAlign: 'left',
            }}
          >
            <div
              style={{
                width: '100%',
                aspectRatio: '16/9',
                background: tokens.color.neutral[100],
                backgroundImage: `url(${s.thumb})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />
            <div style={{ padding: tokens.space[3] }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: tokens.color.neutral[900] }}>
                {s.display}
              </div>
              <div className="tabular" style={{ fontSize: 12, color: tokens.color.neutral[500], marginTop: 2 }}>
                {s.duration} · {s.resolution}
              </div>
              <div
                style={{
                  marginTop: tokens.space[2],
                  padding: '6px 10px',
                  borderRadius: tokens.radius.md,
                  background: active ? tokens.brandGradient : tokens.color.neutral[100],
                  color: active ? '#fff' : tokens.color.neutral[700],
                  fontSize: 12,
                  fontWeight: 500,
                  textAlign: 'center',
                }}
              >
                {active ? '✓ 当前' : '使用 →'}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
