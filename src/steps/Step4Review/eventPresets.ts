export const EVENT_TYPE_PRESETS = [
  { value: 'sudden_brake', label: '急刹' },
  { value: 'lane_change', label: '变道' },
  { value: 'pedestrian_crossing', label: '行人横穿' },
  { value: 'vehicle_cut_in', label: '车辆加塞' },
  { value: 'near_miss', label: '险情接近' },
  { value: 'text', label: '文本/字幕' },
  { value: 'person', label: '人物' },
  { value: 'logo', label: '商标/Logo' },
  { value: 'custom', label: '自定义' },
] as const;

export const SEVERITY_OPTIONS = [
  { value: 'high', label: '高' },
  { value: 'medium', label: '中' },
  { value: 'low', label: '低' },
] as const;
