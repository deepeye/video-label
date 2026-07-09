import type { Annotation, Dataset, DatasetId, FrameBoxesOverlay, FrameEntry, ShotSegment } from '../types';

export interface VideoMeta {
  durationMs: number;
  width: number;
  height: number;
  fps: number;
}

interface RealPart {
  part_id: number;
  text: string;
  // 四角点；真实 JSON 经 fetch 解析后为 number[][]，这里放宽以兼容内联测试字面量
  box: Array<[number, number]> | number[][];
}

interface RealObject {
  label: string;
  probability: number;
  // xyxy；放宽以兼容内联测试字面量（真实 JSON 经 fetch 解析为 any）
  box_px: [number, number, number, number] | number[];
  prompt_used?: string;
}

interface RealFrame {
  frame_index: number;
  subtitle_text: string;
  parts: RealPart[];
  objects: RealObject[];
}

export interface RealJson {
  video_name: string;
  concatenated_subtitles: string;
  all_frames: RealFrame[];
}

function convertFrame(frame: RealFrame): FrameEntry {
  return {
    frame_index: frame.frame_index,
    timestamp_ms: 0, // will be computed below
    subtitle_text: frame.subtitle_text || null,
    parts: frame.parts.map((p) => ({
      part_id: p.part_id,
      text: p.text,
      box: p.box as Array<[number, number]>,
    })),
    boxes: frame.objects.map((obj) => ({
      label: (obj.label === 'person' || obj.label === 'logo') ? obj.label : 'text' as const,
      probability: obj.probability,
      prompt_used: obj.prompt_used,
      box: [obj.box_px[0], obj.box_px[1], obj.box_px[2] - obj.box_px[0], obj.box_px[3] - obj.box_px[1]] as [number, number, number, number],
    })),
  };
}

/**
 * 把每帧的检测对象转为 Annotation 轨道：每个对象实例一条 track，
 * 单关键帧 bbox。用于 Step5 导出真实检测内容。
 */
function buildAnnotations(frames: RealFrame[], fps: number): Annotation[] {
  const annotations: Annotation[] = [];
  for (const frame of frames) {
    const timestampMs = Math.round((frame.frame_index / fps) * 1000);
    frame.objects.forEach((obj, objIdx) => {
      const labelId = obj.label === 'person' || obj.label === 'logo' ? obj.label : 'text';
      const [x1, y1, x2, y2] = obj.box_px as [number, number, number, number];
      annotations.push({
        version: '2.0-demo',
        track_id: `trk_${frame.frame_index}_${objIdx}`,
        label_id: labelId,
        label_display: labelId,
        source: 'machine',
        confidence: obj.probability,
        needs_review: obj.probability < 0.5,
        keyframes: [
          {
            timestamp_ms: timestampMs,
            frame_no: frame.frame_index,
            geometry: {
              type: 'bbox',
              coords: [x1, y1, x2 - x1, y2 - y1],
            },
            is_keyframe: true,
          },
        ],
        review: {
          status: 'pending',
          changed_frames: 0,
          reviewed_at: null,
        },
      });
    });
  }
  return annotations;
}

/**
 * Demo 分镜叙事：5 段对应 5 个真实视频片段，用于 Step3 揭示动画。
 * 真实 JSON 无 segments 字段，此处提供与视频内容对齐的固定分镜。
 */
const STORYBOARD_SEGMENTS: ShotSegment[] = [
  { id: 'seg-1', clip_src: '/mock/storyboard/jiazhengnvhuang_13.mp4', start_ms: 0, end_ms: 10680, title: '家政女皇：软炒肉片', content_type: '美食' },
  { id: 'seg-2', clip_src: '/mock/storyboard/jiazhengnvhuang_5-result.mp4', start_ms: 10680, end_ms: 43760, title: '广告：益安宁丸', content_type: '广告' },
  { id: 'seg-3', clip_src: '/mock/storyboard/meilihebeisegment_001_2-result.mp4', start_ms: 43760, end_ms: 92000, title: '张家口康巴诺尔湿地', content_type: '纪录片' },
  { id: 'seg-4', clip_src: '/mock/storyboard/mingyilaile_17-0-result.mp4', start_ms: 92000, end_ms: 152000, title: '名医来了：访谈节目', content_type: '访谈' },
  { id: 'seg-5', clip_src: '/mock/storyboard/mingyilaile_17-4-result.mp4', start_ms: 152000, end_ms: 185080, title: '名医来了：科学应对儿童遗尿症', content_type: '医疗' },
];

export function adaptRealData(
  json: RealJson,
  videoMeta: VideoMeta,
  datasetId: DatasetId,
  display: string,
  videoSrc: string,
): Dataset {
  const fps = videoMeta.fps > 0 ? videoMeta.fps : 30;
  const frames = json.all_frames.map((f) => {
    const entry = convertFrame(f);
    entry.timestamp_ms = Math.round((f.frame_index / fps) * 1000);
    return entry;
  });

  const frameBoxes: FrameBoxesOverlay = {
    fps,
    video_size: [videoMeta.width, videoMeta.height],
    frames,
  };

  const annotations = buildAnnotations(json.all_frames, fps);

  return {
    version: '2.0-demo',
    dataset_id: datasetId,
    display,
    video_src: videoSrc,
    thumb: '',
    metadata: {
      duration_ms: videoMeta.durationMs,
      frame_count: Math.round((videoMeta.durationMs / 1000) * fps),
      fps,
      width: videoMeta.width,
      height: videoMeta.height,
      codec: 'h264',
      audio_tracks: 1,
      sampled_frames: frames.length,
    },
    annotations,
    demo_script: {
      metadata_reveal_ms: 3000,
      inference_reveal_ms: 5000,
      review_focus_ids: [],
    },
    segments: STORYBOARD_SEGMENTS,
    frame_boxes: frameBoxes,
  };
}
