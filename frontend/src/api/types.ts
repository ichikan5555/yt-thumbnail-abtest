export interface Variant {
  id: number;
  label: string;
  image_path: string;
  thumbnail_url: string | null;
  avg_velocity: number;
  measurement_count: number;
}

export interface Measurement {
  id: number;
  variant_id: number;
  variant_label: string | null;
  cycle: number;
  view_count_start: number;
  view_count_end: number | null;
  started_at: string | null;
  ended_at: string | null;
  duration_minutes: number | null;
  velocity: number | null;
}

export interface TestSummary {
  id: number;
  video_id: string;
  video_title: string;
  status: string;
  current_cycle: number;
  cycles: number;
  rotation_interval: number;
  scheduled_start: string | null;
  scheduled_end: string | null;
  winner_label: string | null;
  created_at: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface TestDetail {
  id: number;
  video_id: string;
  video_title: string;
  status: string;
  cycles: number;
  current_cycle: number;
  current_variant_index: number;
  rotation_order: string;
  rotation_interval: number;
  scheduled_start: string | null;
  scheduled_end: string | null;
  winner_variant_id: number | null;
  created_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  variants: Variant[];
  measurements: Measurement[];
}

export interface MetricScore {
  raw_value: number;
  normalized: number;
  weighted: number;
}

export interface VariantResult {
  variant_id: number;
  label: string;
  avg_velocity: number;
  measurement_count: number;
  total_views_gained: number;
  composite_score: number;
  is_winner: boolean;
  improvement_pct: number;
  metrics: Record<string, MetricScore>;
}

export interface TestResult {
  test_id: number;
  video_id: string;
  video_title: string;
  winner: VariantResult;
  variants: VariantResult[];
  weights: Record<string, number>;
  has_analytics: boolean;
}

export interface Quota {
  used: number;
  limit: number;
  remaining: number;
  pct: number;
  est_tests_possible: number;
}

export interface TestEvent {
  test_id: number;
  status: string;
  current_cycle: number;
  current_variant_index: number;
  variants: {
    id: number;
    label: string;
    avg_velocity: number;
    measurement_count: number;
  }[];
}

export const METRIC_KEYS = [
  "view_velocity",
  "impressions",
  "ctr",
  "avg_view_duration",
  "avg_view_percentage",
  "watch_time",
  "likes",
  "shares",
  "comments",
] as const;

export const DEFAULT_WEIGHTS: Record<string, number> = {
  view_velocity: 5,
  impressions: 2,
  ctr: 5,
  avg_view_duration: 4,
  avg_view_percentage: 3,
  watch_time: 2,
  likes: 2,
  shares: 1,
  comments: 1,
};

export interface Settings {
  default_rotation_interval: number;
  default_cycles: number;
  default_num_patterns: number;
  default_start_time: string;
  default_metric_weights: Record<string, number>;
  notification_channels: string[];
}
