import type { Dataset, DatasetId, FrameBoxesOverlay, FrameEntry } from '../types';

export interface VideoMeta {
  durationMs: number;
  width: number;
  height: number;
  fps: number;
}

interface RealPart {
  part_id: number;
  text: string;
  box: Array<[number, number]>;
}

interface RealObject {
  label: string;
  probability: number;
  box_px: [number, number, number, number];
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
      box: p.box,
    })),
    boxes: frame.objects.map((obj) => ({
      label: (obj.label === 'person' || obj.label === 'logo') ? obj.label : 'text' as const,
      probability: obj.probability,
      prompt_used: obj.prompt_used,
      box: [obj.box_px[0], obj.box_px[1], obj.box_px[2] - obj.box_px[0], obj.box_px[3] - obj.box_px[1]] as [number, number, number, number],
    })),
  };
}

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
    annotations: [],
    demo_script: {
      metadata_reveal_ms: 3000,
      inference_reveal_ms: 5000,
      review_focus_ids: [],
    },
    segments: [],
    frame_boxes: frameBoxes,
  };
}
