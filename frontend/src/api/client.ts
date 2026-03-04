import axios from "axios";
import type {
  TestSummary,
  TestDetail,
  TestResult,
  Quota,
  Settings,
  HeatmapData,
  SignificanceData,
  DegradationData,
  CrossAnalysisData,
  CompetitorResult,
  CompetitorHistoryItem,
  BackupItem,
  BackupCreateResult,
  TestTemplate,
  LogoStatus,
} from "./types";

const api = axios.create({ baseURL: "/api" });

export async function listTests(): Promise<TestSummary[]> {
  const { data } = await api.get<TestSummary[]>("/tests");
  return data;
}

export async function getTest(id: number): Promise<TestDetail> {
  const { data } = await api.get<TestDetail>(`/tests/${id}`);
  return data;
}

export async function createTest(
  videoId: string,
  thumbnails: File[],
  rotationInterval: number = 30,
  scheduledStart?: string,
  scheduledEnd?: string,
  metricWeights?: Record<string, number>,
  testMode: string = "single",
  scheduledDays?: string[],
  dailyStartTime?: string,
): Promise<TestDetail> {
  const form = new FormData();
  form.append("video_id", videoId);
  form.append("thumbnail_a", thumbnails[0]);
  form.append("thumbnail_b", thumbnails[1]);
  if (thumbnails[2]) form.append("thumbnail_c", thumbnails[2]);
  if (thumbnails[3]) form.append("thumbnail_d", thumbnails[3]);
  form.append("rotation_interval", String(rotationInterval));
  if (scheduledStart) form.append("scheduled_start", scheduledStart);
  if (scheduledEnd) form.append("scheduled_end", scheduledEnd);
  if (metricWeights) form.append("metric_weights", JSON.stringify(metricWeights));
  form.append("test_mode", testMode);
  if (scheduledDays && scheduledDays.length > 0) {
    form.append("scheduled_days", JSON.stringify(scheduledDays));
  }
  if (dailyStartTime) form.append("daily_start_time", dailyStartTime);
  const { data } = await api.post<TestDetail>("/tests", form);
  return data;
}

export async function getResults(id: number): Promise<TestResult> {
  const { data } = await api.get<TestResult>(`/tests/${id}/results`);
  return data;
}

export async function fetchAnalytics(id: number): Promise<{ status: string }> {
  const { data } = await api.post<{ status: string }>(`/tests/${id}/fetch-analytics`);
  return data;
}

export async function pauseTest(id: number): Promise<TestDetail> {
  const { data } = await api.post<TestDetail>(`/tests/${id}/pause`);
  return data;
}

export async function resumeTest(id: number): Promise<TestDetail> {
  const { data } = await api.post<TestDetail>(`/tests/${id}/resume`);
  return data;
}

export async function cancelTest(id: number): Promise<TestDetail> {
  const { data } = await api.post<TestDetail>(`/tests/${id}/cancel`);
  return data;
}

export async function getQuota(): Promise<Quota> {
  const { data } = await api.get<Quota>("/quota");
  return data;
}

export async function getSettings(): Promise<Settings> {
  const { data } = await api.get<Settings>("/settings");
  return data;
}

export async function updateSettings(settings: Partial<Settings>): Promise<Settings> {
  const { data } = await api.put<Settings>("/settings", settings);
  return data;
}

// Feature 1: Heatmap
export async function getHeatmap(id: number): Promise<HeatmapData> {
  const { data } = await api.get<HeatmapData>(`/tests/${id}/heatmap`);
  return data;
}

// Feature 2: Significance
export async function getSignificance(id: number): Promise<SignificanceData> {
  const { data } = await api.get<SignificanceData>(`/tests/${id}/significance`);
  return data;
}

// Feature 4: Degradation
export async function getDegradation(id: number): Promise<DegradationData> {
  const { data } = await api.get<DegradationData>(`/tests/${id}/degradation`);
  return data;
}

export async function toggleDegradation(id: number): Promise<{ tracking_enabled: boolean }> {
  const { data } = await api.post<{ tracking_enabled: boolean }>(`/tests/${id}/degradation/toggle`);
  return data;
}

// Feature 5: Cross Analysis
export async function getCrossAnalysis(): Promise<CrossAnalysisData> {
  const { data } = await api.get<CrossAnalysisData>("/cross-analysis");
  return data;
}

export async function classifyTestThumbnails(testId: number): Promise<unknown> {
  const { data } = await api.post(`/cross-analysis/classify/${testId}`);
  return data;
}

// Feature 6: Competitor
export async function analyzeCompetitor(channelId: string): Promise<CompetitorResult> {
  const { data } = await api.post<CompetitorResult>("/competitor/analyze", { channel_id: channelId });
  return data;
}

export async function getCompetitorHistory(): Promise<CompetitorHistoryItem[]> {
  const { data } = await api.get<CompetitorHistoryItem[]>("/competitor/history");
  return data;
}

export async function getCompetitorDetail(id: number): Promise<CompetitorResult> {
  const { data } = await api.get<CompetitorResult>(`/competitor/${id}`);
  return data;
}

// Backup (Pro only)
export async function createBackup(): Promise<BackupCreateResult> {
  const { data } = await api.post<BackupCreateResult>("/backup/create");
  return data;
}

export async function listBackups(): Promise<BackupItem[]> {
  const { data } = await api.get<BackupItem[]>("/backup/list");
  return data;
}

export async function downloadBackup(filename: string): Promise<void> {
  const response = await api.get(`/backup/download/${filename}`, { responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export async function deleteBackup(filename: string): Promise<void> {
  await api.delete(`/backup/${filename}`);
}

// Templates
export async function listTemplates(): Promise<TestTemplate[]> {
  const { data } = await api.get<TestTemplate[]>("/templates");
  return data;
}

export async function saveTemplate(template: TestTemplate): Promise<TestTemplate> {
  const { data } = await api.post<TestTemplate>("/templates", template);
  return data;
}

export async function deleteTemplate(name: string): Promise<void> {
  await api.delete(`/templates/${encodeURIComponent(name)}`);
}

// PDF Report (Pro only)
export async function downloadReport(testId: number): Promise<void> {
  const response = await api.post(`/tests/${testId}/report`, null, { responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const a = document.createElement("a");
  a.href = url;
  a.download = `report_${testId}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

// Logo (Pro only)
export async function uploadLogo(file: File): Promise<{ status: string }> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post<{ status: string }>("/settings/logo", form);
  return data;
}

export async function deleteLogo(): Promise<void> {
  await api.delete("/settings/logo");
}

export async function getLogo(): Promise<LogoStatus> {
  const { data } = await api.get<LogoStatus>("/settings/logo");
  return data;
}
