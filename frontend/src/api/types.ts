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
  test_mode: string;
  current_day_index: number;
  total_days: number;
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
  test_mode: string;
  scheduled_days: string;
  daily_start_time: string;
  current_day_index: number;
  total_days: number;
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

// Feature 1: Heatmap
export interface HeatmapCell {
  weekday: number;
  hour: number;
  avg_velocity: number;
}

export interface VariantHeatmap {
  label: string;
  cells: HeatmapCell[];
}

export interface HeatmapData {
  test_id: number;
  variants: VariantHeatmap[];
}

// Feature 2: Significance
export interface PairComparison {
  variant_a: string;
  variant_b: string;
  p_value: number;
  confidence_pct: number;
  significant: boolean;
  better_variant: string;
}

export interface SignificanceData {
  test_id: number;
  sample_sizes: Record<string, number>;
  pairs: PairComparison[];
  overall_confident: boolean;
}

// Feature 4: Degradation
export interface DegradationCheckData {
  day_number: number;
  view_count: number;
  daily_views: number;
  velocity_24h: number;
  checked_at: string | null;
}

export interface DegradationData {
  test_id: number;
  tracking_enabled: boolean;
  alert: string | null;
  avg_test_velocity: number;
  checks: DegradationCheckData[];
}

// Feature 5: Cross Analysis
export interface CategoryStat {
  category: string;
  count: number;
  wins: number;
  win_rate: number;
  avg_score: number;
}

export interface CrossAnalysisData {
  total_tests: number;
  categories: CategoryStat[];
}

// Feature 6: Competitor
export interface CompetitorVideo {
  video_id: string;
  title: string;
  thumbnail_url: string;
  categories: string[];
}

export interface CompetitorResult {
  id?: number;
  channel_id: string;
  channel_title: string;
  video_count: number;
  category_distribution: Record<string, number>;
  face_usage_rate: number;
  text_usage_rate: number;
  videos: CompetitorVideo[];
  recommendations: string;
  created_at?: string;
}

export interface CompetitorHistoryItem {
  id: number;
  channel_id: string;
  channel_title: string;
  video_count: number;
  created_at: string | null;
}

// Templates
export interface TestTemplate {
  name: string;
  num_patterns: number;
  rotation_interval: number;
  cycles: number;
  metric_weights: Record<string, number>;
  test_mode: string;
  daily_start_time: string;
}

// Report / Logo
export interface LogoStatus {
  has_logo: boolean;
}

// Backup
export interface BackupItem {
  filename: string;
  size: number;
  created_at: string;
}

export interface BackupCreateResult extends BackupItem {
  test_count: number;
}
