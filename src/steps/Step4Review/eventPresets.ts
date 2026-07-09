export const EVENT_TYPE_PRESETS = [
  { value: 'sudden_brake', label: '急刹' },
  { value: 'lane_change', label: '变道' },
  { value: 'pedestrian_crossing', label: '行人横穿' },
  { value: 'vehicle_cut_in', label: '车辆加塞' },
  { value: 'near_miss', label: '险情接近' },
  { value: 'custom', label: '自定义' },
] as const;

export const SEVERITY_OPTIONS = [
  { value: 'high', label: '高' },
  { value: 'medium', label: '中' },
  { value: 'low', label: '低' },
] as const;
