import axios from "axios";
import type { TestSummary, TestDetail, TestResult, Quota, Settings } from "./types";

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
