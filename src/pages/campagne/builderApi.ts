import { apiClient, API_BASE_URL } from '../../utils/apiClient';

// ---------- Types (Radio Admin API — client-access endpoints) ----------

export type CampaignStatus = 'draft' | 'pending_approval' | 'active' | 'rejected' | string;

export interface RadioStation {
  id: number;
  name: string;
  logo?: string | null;
  frequency?: string | null;
  region?: string | null;
  division?: string | null;
}

export interface Campaign {
  id: number;
  name: string;
  label?: string | null;
  status: CampaignStatus;
  start_date: string;
  end_date: string;
  client_id: number;
  created_by_client_id?: number | null;
  review_comment?: string | null;
  radioStations?: RadioStation[];
}

export interface Spot {
  id: number;
  campaign_id: number;
  name: string;
  description?: string | null;
  duration_seconds?: number | null;
  audio_file_path?: string | null;
  audio_mime_type?: string | null;
  audio_size_bytes?: number | null;
  fingerprint_status?: string;
  schedules?: SpotSchedule[];
}

export interface SpotSchedule {
  id: number;
  campaign_id: number;
  spot_id: number;
  radio_station_id: number;
  scheduled_time: string; // "HH:mm:ss"
  schedule_date?: string | null; // null/absent = base "every-day" plan; "YYYY-MM-DD" = that day's override
  upload_window_before?: number;
  upload_window_after?: number;
}

export interface ProgramSlot {
  id: number;
  radio_station_id: number;
  scheduled_time: string; // "HH:mm:ss"
  label?: string | null;
  display_order?: number;
}

export interface ReplicateResult {
  source_slots: number;
  targets: number[];
  skipped: number[];
  created: number;
}

interface Paginated<T> {
  rows: T[];
  count: number;
  totalPages: number;
  currentPage: number;
}

// Some endpoints return { rows, ... }, others plain arrays — normalize both.
const unwrapRows = <T>(response: unknown): T[] => {
  if (Array.isArray(response)) return response as T[];
  if (response && typeof response === 'object' && Array.isArray((response as Paginated<T>).rows)) {
    return (response as Paginated<T>).rows;
  }
  return [];
};

// ---------- Campaigns ----------

export const fetchMyCampaigns = async (): Promise<Campaign[]> => {
  const response = await apiClient<Paginated<Campaign> | Campaign[]>(
    '/client-access/my-campaigns?page=1&pageSize=100',
    { method: 'GET' }
  );
  return unwrapRows<Campaign>(response);
};

export interface CreateCampaignPayload {
  name: string;
  label?: string;
  start_date: string;
  end_date: string;
  radio_station_ids: number[];
}

export const createCampaign = (payload: CreateCampaignPayload): Promise<Campaign> =>
  apiClient<Campaign>('/client-access/my-campaigns', { method: 'POST', data: payload });

export const submitCampaign = (campaignId: number | string): Promise<Campaign> =>
  apiClient<Campaign>(`/client-access/my-campaigns/${campaignId}/submit`, { method: 'PATCH' });

// Draft/rejected campaigns only — requires the backend to expose the client
// delete route (mirrors the rest of the client-access surface).
export const deleteCampaign = (campaignId: number | string): Promise<void> =>
  apiClient<void>(`/client-access/my-campaigns/${campaignId}`, { method: 'DELETE' });

export const isCampaignEditable = (status: CampaignStatus | undefined): boolean =>
  status === 'draft' || status === 'rejected';

// ---------- Spots ----------

export const fetchCampaignSpots = async (campaignId: number | string): Promise<Spot[]> => {
  const response = await apiClient<Paginated<Spot> | Spot[]>(
    `/client-access/my-campaigns/${campaignId}/spots`,
    { method: 'GET' }
  );
  return unwrapRows<Spot>(response);
};

export interface UploadSpotPayload {
  name: string;
  description?: string;
  duration_seconds?: number;
  file: File;
}

export const uploadSpot = (campaignId: number | string, payload: UploadSpotPayload): Promise<Spot> => {
  const formData = new FormData();
  formData.append('name', payload.name);
  if (payload.description) formData.append('description', payload.description);
  if (payload.duration_seconds) formData.append('duration_seconds', String(payload.duration_seconds));
  formData.append('spotFile', payload.file);
  return apiClient<Spot>(`/client-access/my-campaigns/${campaignId}/spots`, {
    method: 'POST',
    data: formData,
    isFormData: true,
  });
};

// ---------- Station program (reference guide for time entry) ----------

export const fetchStationProgram = (stationId: number | string): Promise<ProgramSlot[]> =>
  apiClient<ProgramSlot[]>(`/client-access/radio-stations/${stationId}/program`, { method: 'GET' });

// ---------- Schedules ----------

export interface CreateSchedulePayload {
  spot_id: number;
  radio_station_id: number;
  scheduled_time: string; // "HH:mm"
  schedule_date?: string; // omit for the base plan; "YYYY-MM-DD" for a day-specific slot
  upload_window_before?: number;
  upload_window_after?: number;
}

export const createSchedule = (
  campaignId: number | string,
  payload: CreateSchedulePayload
): Promise<SpotSchedule> =>
  apiClient<SpotSchedule>(`/client-access/my-campaigns/${campaignId}/schedules`, {
    method: 'POST',
    data: payload,
  });

export const deleteSchedule = (campaignId: number | string, scheduleId: number): Promise<void> =>
  apiClient<void>(`/client-access/my-campaigns/${campaignId}/schedules/${scheduleId}`, {
    method: 'DELETE',
  });

export const replicateSchedules = (
  campaignId: number | string,
  sourceStationId: number,
  targetStationIds: number[] | 'all'
): Promise<ReplicateResult> =>
  apiClient<ReplicateResult>(`/client-access/my-campaigns/${campaignId}/schedules/replicate`, {
    method: 'POST',
    data: { source_station_id: sourceStationId, target_station_ids: targetStationIds },
  });

// List schedules for the base plan (?date=base) or a specific day. Falls back
// to null when the listing endpoint is unavailable so the UI can rely on
// schedules embedded in spots or created during the session.
export const fetchCampaignSchedules = async (
  campaignId: number | string,
  date?: string | null // null/undefined = base plan
): Promise<SpotSchedule[] | null> => {
  try {
    const response = await apiClient<Paginated<SpotSchedule> | SpotSchedule[]>(
      `/client-access/my-campaigns/${campaignId}/schedules?date=${date ?? 'base'}`,
      { method: 'GET' }
    );
    return unwrapRows<SpotSchedule>(response);
  } catch {
    return null;
  }
};

// Which days have customized (materialized) plans — for highlighting in the UI.
export const fetchScheduleDates = async (campaignId: number | string): Promise<string[]> => {
  try {
    const response = await apiClient<{ dates: string[] }>(
      `/client-access/my-campaigns/${campaignId}/schedule-dates`,
      { method: 'GET' }
    );
    return response?.dates ?? [];
  } catch {
    return [];
  }
};

// Copy a station's base plan into editable rows for one calendar day.
export interface MaterializeResult {
  date: string;
  materialized: number[];
  skipped: number[];
  created: number;
}

export const materializeDay = (
  campaignId: number | string,
  date: string,
  radioStationId?: number
): Promise<MaterializeResult> =>
  apiClient<MaterializeResult>(
    `/client-access/my-campaigns/${campaignId}/schedules/materialize-day`,
    {
      method: 'POST',
      data: { date, ...(radioStationId ? { radio_station_id: radioStationId } : {}) },
    }
  );

// ---------- Radio stations (for campaign creation) ----------

// Clients use the client-access listing (plain array of client-safe fields);
// the admin route stays as a fallback so admin tokens keep working.
export const fetchRadioStations = async (): Promise<RadioStation[]> => {
  const attempts = [
    '/client-access/radio-stations',
    '/radio-stations?page=1&pageSize=200',
  ];
  let lastError: unknown;
  for (const endpoint of attempts) {
    try {
      const response = await apiClient<Paginated<RadioStation> | RadioStation[]>(endpoint, {
        method: 'GET',
      });
      return unwrapRows<RadioStation>(response);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Could not load radio stations');
};

// ---------- Excel schedule import (preview → import with spot mapping) ----------

export interface ImportPreviewCode {
  code: string;
  legend_name?: string | null;
  suggested_spot_id?: number | null;
  suggested_spot_name?: string | null;
}

export interface ImportPreview {
  source: string; // "planning" grid or "detail" sheet
  total_slots: number;
  time_slots: string[];
  stations: {
    matched: { excel_name: string; station_id: number }[];
    unmatched: string[];
  };
  codes: ImportPreviewCode[];
  campaign_spots: { id: number; name: string }[];
}

export interface ImportResult {
  created: number;
  skipped: number;
  skipped_identical_days?: number; // station-days identical to the base plan, left following it
  stations_assigned: unknown[];
  unmatched_stations: string[];
  unmapped_codes: string[];
}

export const previewScheduleImport = (
  campaignId: number | string,
  file: File
): Promise<ImportPreview> => {
  const formData = new FormData();
  formData.append('file', file);
  return apiClient<ImportPreview>(
    `/client-access/my-campaigns/${campaignId}/schedules/import/preview`,
    { method: 'POST', data: formData, isFormData: true }
  );
};

export const importSchedules = (
  campaignId: number | string,
  file: File,
  mapping: Record<string, number>,
  autoAssignStations: boolean,
  date?: string // omit → base plan; "YYYY-MM-DD" → that day's rows
): Promise<ImportResult> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('mapping', JSON.stringify(mapping));
  formData.append('autoAssignStations', String(autoAssignStations));
  if (date) formData.append('date', date);
  return apiClient<ImportResult>(
    `/client-access/my-campaigns/${campaignId}/schedules/import`,
    { method: 'POST', data: formData, isFormData: true }
  );
};

// ---------- Binary downloads (xlsx / pdf) ----------

// The apiClient only handles JSON, so binary downloads go through fetch directly.
const downloadFile = async (endpoint: string, fallbackName: string): Promise<void> => {
  const token = localStorage.getItem('authToken');
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.message || `Download failed with status ${response.status}`);
  }

  // Prefer the server-provided filename; fall back to a local one.
  const disposition = response.headers.get('content-disposition');
  const match = disposition?.match(/filename="?([^";]+)"?/i);
  const filename = match?.[1] ?? fallbackName;

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const safeName = (name?: string) => (name ?? 'campagne').replace(/[^\w\d-]+/g, '_');

// Without date: the base every-day plan. With date: that day's effective plan.
export const downloadCampaignProgramExport = (
  campaignId: number | string,
  campaignName?: string,
  date?: string | null
): Promise<void> =>
  downloadFile(
    `/client-access/my-campaigns/${campaignId}/program/export${date ? `?date=${date}` : ''}`,
    `programme_${campaignId}_${safeName(campaignName)}${date ? `_${date}` : ''}.xlsx`
  );

// Blank fillable grid (stations × times, with the spot legend) for the Excel
// import round-trip.
export const downloadScheduleTemplate = (
  campaignId: number | string,
  campaignName?: string
): Promise<void> =>
  downloadFile(
    `/client-access/my-campaigns/${campaignId}/schedules/template`,
    `template_${campaignId}_${safeName(campaignName)}.xlsx`
  );

// ---------- Bilan de Diffusion (server-rendered campaign report) ----------

// from/to are optional YYYY-MM-DD bounds; the server defaults to the campaign window.
const reportQuery = (from?: string | null, to?: string | null): string => {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
};

export const downloadCampaignReportPdf = (
  campaignId: number | string,
  campaignName?: string,
  from?: string | null,
  to?: string | null
): Promise<void> =>
  downloadFile(
    `/client-access/my-campaigns/${campaignId}/report/pdf${reportQuery(from, to)}`,
    `bilan_${campaignId}_${safeName(campaignName)}.pdf`
  );

export const downloadCampaignReportXlsx = (
  campaignId: number | string,
  campaignName?: string,
  from?: string | null,
  to?: string | null
): Promise<void> =>
  downloadFile(
    `/client-access/my-campaigns/${campaignId}/report/xlsx${reportQuery(from, to)}`,
    `bilan_${campaignId}_${safeName(campaignName)}.xlsx`
  );

// ---------- Helpers ----------

// "08:30:00" -> "08:30" for display and <input type="time">
export const toShortTime = (time: string | undefined | null): string =>
  time ? time.slice(0, 5) : '';
