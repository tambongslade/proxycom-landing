import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useParams, Navigate, Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../utils/apiClient';
import Header from '../../components/Header';
import './CampaignDetail.css';
import { getLogoUrl } from './CampagneList';
import {
  downloadCampaignProgramExport,
  downloadCampaignReportPdf,
  downloadCampaignReportXlsx,
} from './builderApi';
import {
  buildCampaignStats,
  formatAirtime,
  type ReportRecord,
} from '../../utils/campaignReport';

const SERVER_ROOT_URL = 'https://api.proxycom.net'; // Used for constructing audio file URLs

// --- Interfaces based on the API response for records ---
interface AudioFile {
  id: number;
  record_id: number;
  file_path: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  duration_seconds: number;
}

interface RecordRadioStationInfo {
  id: number;
  name: string;
  logo?: string;
}

interface RecordCampaignInfo {
  id: number;
  name: string;
}

interface VideoFile {
  id: number;
  record_id: number;
  file_path: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  duration_seconds: number;
}

interface CampaignRecord {
  id: number;
  campaign_id: number;
  radio_station_id: number;
  status: string;
  submission_date: string;
  start_date: string;
  end_date: string;
  scheduled_time?: string | null;
  upload_status?: string | null;
  late_by_minutes?: number | null;
  source?: string | null;
  aired_started_at?: string | null;
  aired_ended_at?: string | null;
  detection_flag?: string | null;
  validation_comment?: string | null;
  createdAt: string;
  updatedAt: string;
  campaign: RecordCampaignInfo;
  radioStation: RecordRadioStationInfo;
  audioFiles: AudioFile[];
  videoFiles: VideoFile[];
}

// Interface for grouped station data
interface GroupedStationData {
  stationInfo: RecordRadioStationInfo;
  records: CampaignRecord[];
  recordCount: number;
  validated: number;
  pending: number;
  rejected: number;
  audioCount: number;
  videoCount: number;
  airtimeSeconds: number;
}

type CampaignRecordsApiResponse =
  | { rows: CampaignRecord[]; count: number; totalPages: number; currentPage: number }
  | CampaignRecord[]
  | Record<string, unknown>;

// Fetch ALL records for the campaign so the breakdown reflects every status.
const fetchCampaignRecords = async (campaignId: string): Promise<CampaignRecord[]> => {
  const response = await apiClient<CampaignRecordsApiResponse>(
    `/client-access/my-campaigns/${campaignId}/records`,
    { method: 'GET' }
  );

  if (
    response &&
    typeof response === 'object' &&
    !Array.isArray(response) &&
    Array.isArray((response as { rows?: CampaignRecord[] }).rows)
  ) {
    return (response as { rows: CampaignRecord[] }).rows;
  }
  if (Array.isArray(response)) {
    return response;
  }
  console.warn(`[CampaignDetail] Unexpected records response for campaign ${campaignId}, returning [].`, response);
  return [];
};

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

// Full date + time — used for the record submission timestamp.
const formatDateTime = (dateStr: string, locale: string) =>
  new Date(dateStr).toLocaleString(locale, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

// Clock time only (aired start / end timestamps).
const formatClockTime = (dateStr: string, locale: string) =>
  new Date(dateStr).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' });

// "08:00:00" → "08:00"
const formatScheduledTime = (time: string) => time.slice(0, 5);

const STATUS_COLORS: Record<string, string> = {
  validated: '#16a34a',
  pending: '#d97706',
  rejected: '#dc2626',
  other: '#6e42d3',
};

const normalizeStatus = (status: string): 'validated' | 'pending' | 'rejected' | 'other' => {
  const s = (status || '').toLowerCase();
  if (s === 'validated' || s === 'pending' || s === 'rejected') return s;
  return 'other';
};

// --- Custom audio player ---
const CustomAudioPlayer: React.FC<{ file: AudioFile }> = React.memo(({ file }) => {
  const { t } = useTranslation();
  // file_path can contain characters that break a raw URL — encode each segment.
  const fullAudioUrl = `${SERVER_ROOT_URL}/uploads/${file.file_path.split('/').map(encodeURIComponent).join('/')}`;
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [hasError, setHasError] = useState(false);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    setHasError(false);
    // play() returns a promise that rejects when the file can't be fetched or decoded.
    audio.play().catch(() => setHasError(true));
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onDuration = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) setDuration(audio.duration);
    };
    const onLoadedMetadata = () => {
      onDuration();
      setCurrentTime(audio.currentTime);
    };
    const setAudioTime = () => setCurrentTime(audio.currentTime);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);
    const onError = () => {
      setIsPlaying(false);
      setHasError(true);
    };
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('durationchange', onDuration);
    audio.addEventListener('timeupdate', setAudioTime);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('durationchange', onDuration);
      audio.removeEventListener('timeupdate', setAudioTime);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, []);

  const formatTime = (time: number) => {
    if (!Number.isFinite(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

  // Some proof clips have no duration in their metadata — fall back to the API value.
  const displayDuration = duration > 0 ? duration : file.duration_seconds || 0;
  const progressPct = displayDuration > 0 ? Math.min(100, (currentTime / displayDuration) * 100) : 0;

  return (
    <div className={`pc-player ${hasError ? 'has-error' : ''}`}>
      <audio ref={audioRef} src={fullAudioUrl} preload="metadata" />
      <button
        onClick={togglePlayPause}
        className={`pc-play ${isPlaying ? 'playing' : ''}`}
        aria-label={isPlaying ? t('pauseButton', 'Pause') : t('playButton', 'Play')}
        title={isPlaying ? t('pauseButton', 'Pause') : t('playButton', 'Play')}
      >
        {isPlaying ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v13.72c0 .8.87 1.3 1.56.88l10.5-6.86a1.03 1.03 0 000-1.76L9.56 4.26A1.03 1.03 0 008 5.14z"/></svg>
        )}
      </button>
      <div className="pc-body">
        <div className="pc-top">
          <span className="pc-name" title={file.original_name}>{file.original_name}</span>
          <span className="pc-time">{formatTime(currentTime)} / {formatTime(displayDuration)}</span>
        </div>
        <input
          type="range"
          min="0"
          max={displayDuration || 1}
          step="0.1"
          value={currentTime}
          disabled={!displayDuration}
          onChange={(e) => {
            if (audioRef.current) audioRef.current.currentTime = Number(e.target.value);
          }}
          className="pc-seek"
          style={{ background: `linear-gradient(to right, var(--cd-brand) ${progressPct}%, #e5e0f5 ${progressPct}%)` }}
          aria-label={file.original_name}
        />
        {hasError && (
          <div className="pc-error">
            {t('audioLoadError', 'This audio file could not be played. It may be missing or in an unsupported format.')}{' '}
            <a href={fullAudioUrl} target="_blank" rel="noopener noreferrer">{t('tryDownloadInstead', 'Try downloading it instead')}</a>
          </div>
        )}
      </div>
      <a
        className="pc-download"
        href={fullAudioUrl}
        download={file.original_name}
        target="_blank"
        rel="noopener noreferrer"
        title={t('downloadAudio', 'Download')}
        aria-label={t('downloadAudio', 'Download')}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      </a>
    </div>
  );
});
CustomAudioPlayer.displayName = 'CustomAudioPlayer';

const CustomVideoPlayer: React.FC<{ file: VideoFile }> = ({ file }) => {
  const fullVideoUrl = `${SERVER_ROOT_URL}/uploads/${file.file_path.split('/').map(encodeURIComponent).join('/')}`;
  return (
    <div className="custom-video-player-wrapper">
      <video src={fullVideoUrl} controls style={{ width: '100%', maxWidth: 400, borderRadius: 10, marginTop: 8 }} />
      <div className="video-file-name">
        <a href={fullVideoUrl} target="_blank" rel="noopener noreferrer" className="video-file-link" title={file.original_name}>
          {file.original_name}
        </a>
      </div>
    </div>
  );
};

// --- Small KPI card ---
const KpiCard: React.FC<{ value: React.ReactNode; label: string; color: string; icon: React.ReactNode }> = ({ value, label, color, icon }) => (
  <div className="cd-kpi">
    <div className="cd-kpi-top">
      <div className="cd-kpi-ico" style={{ background: `${color}1a`, color }}>{icon}</div>
    </div>
    <div className="cd-kpi-value">{value}</div>
    <div className="cd-kpi-label">{label}</div>
  </div>
);

const StatusTag: React.FC<{ status: string; label: string }> = ({ status, label }) => {
  const key = normalizeStatus(status);
  return <span className={`cd-status-tag ${key}`}><i />{label}</span>;
};

// Module-level so its identity is stable across renders — defining it inside
// the page component would remount the whole tree on every render.
const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="page-container cd-page">
    <Header />
    <main className="main-content campaign-detail-page">
      <div className="cd-shell">{children}</div>
    </main>
  </div>
);

const CampaignDetail: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { id: campaignId } = useParams<{ id: string }>();
  const { isLoggedIn } = useAuth();
  const [selectedStationId, setSelectedStationId] = useState<number | null>(null);
  const [stationLogos, setStationLogos] = useState<{ [stationId: number]: string | undefined }>({});

  const { data: records, isLoading, isError, error } = useQuery<CampaignRecord[], Error>({
    queryKey: ['campaignRecords', campaignId],
    queryFn: () => fetchCampaignRecords(campaignId!),
    enabled: isLoggedIn && !!campaignId,
  });

  const programExport = useMutation<void, Error, void>({
    mutationFn: () => downloadCampaignProgramExport(campaignId!, records?.[0]?.campaign?.name),
  });

  // Server-rendered "Bilan de Diffusion" downloads (client-access report endpoints).
  const reportPdf = useMutation<void, Error, void>({
    mutationFn: () => downloadCampaignReportPdf(campaignId!, records?.[0]?.campaign?.name),
  });
  const reportXlsx = useMutation<void, Error, void>({
    mutationFn: () => downloadCampaignReportXlsx(campaignId!, records?.[0]?.campaign?.name),
  });

  // Group records by radio station with status + media breakdowns.
  const groupedByStation = useMemo<GroupedStationData[]>(() => {
    if (!records) return [];
    const groups: Record<number, GroupedStationData> = {};
    records.forEach((record) => {
      const stationId = record.radioStation?.id ?? -1;
      if (!groups[stationId]) {
        groups[stationId] = {
          stationInfo: record.radioStation,
          records: [],
          recordCount: 0,
          validated: 0,
          pending: 0,
          rejected: 0,
          audioCount: 0,
          videoCount: 0,
          airtimeSeconds: 0,
        };
      }
      const g = groups[stationId];
      g.records.push(record);
      g.recordCount++;
      const status = normalizeStatus(record.status);
      if (status === 'validated') g.validated++;
      else if (status === 'pending') g.pending++;
      else if (status === 'rejected') g.rejected++;
      const audios = record.audioFiles ?? [];
      const videos = record.videoFiles ?? [];
      g.audioCount += audios.length;
      g.videoCount += videos.length;
      g.airtimeSeconds +=
        audios.reduce((s, f) => s + (f.duration_seconds || 0), 0) +
        videos.reduce((s, f) => s + (f.duration_seconds || 0), 0);
    });
    return Object.values(groups).sort((a, b) => b.recordCount - a.recordCount);
  }, [records]);

  const stats = useMemo(() => buildCampaignStats((records ?? []) as ReportRecord[]), [records]);

  // Fetch station logos lazily.
  useEffect(() => {
    const fetchLogos = async () => {
      const missingIds = groupedByStation
        .map((group) => group.stationInfo.id)
        .filter((id) => !(id in stationLogos));
      if (missingIds.length === 0) return;
      const logoResults = await Promise.all(
        missingIds.map(async (id) => {
          try {
            const res = await apiClient<{ id: number; name: string; logo?: string }>(`/radio-stations/${id}`, { method: 'GET' });
            return { id, logo: res.logo };
          } catch {
            return { id, logo: undefined };
          }
        })
      );
      setStationLogos((prev) => ({
        ...prev,
        ...Object.fromEntries(logoResults.map(({ id, logo }) => [id, logo])),
      }));
    };
    if (groupedByStation.length > 0) fetchLogos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupedByStation]);

  if (!isLoggedIn) return <Navigate to="/" />;
  if (!campaignId) return <Navigate to="/campagne" />;

  const currentCampaignName = records?.[0]?.campaign?.name || t('campaignDetails', 'Campaign Details');

  const locale = i18n.language?.startsWith('fr') ? 'fr-FR' : i18n.language?.startsWith('es') ? 'es-ES' : 'en-US';

  const hasRecords = !!records && records.length > 0;

  // ---------- Loading / error / empty ----------
  if (isLoading) {
    return (
      <Shell>
        <div className="loading">{t('loadingCampaignRecords', 'Loading campaign records...')}</div>
      </Shell>
    );
  }

  if (isError) {
    return (
      <Shell>
        <div className="error">
          {t('errorFetchingCampaignRecords', 'Error fetching campaign records')}: {error?.message || t('errorGeneric')}
        </div>
        <Link to="/campagne" className="back-link" style={{ marginTop: 18 }}>{t('backToCampaigns')}</Link>
      </Shell>
    );
  }

  // ---------- Drill-down: records for a selected station ----------
  if (selectedStationId) {
    const selectedGroup = groupedByStation.find((g) => g.stationInfo.id === selectedStationId);
    if (!selectedGroup) return <Shell><p>{t('stationNotFound', 'Station not found.')}</p></Shell>;

    return (
      <Shell>
        <div className="cd-hero" style={{ marginBottom: 24 }}>
          <div className="cd-hero-top">
            <div>
              <div className="cd-eyebrow">{currentCampaignName}</div>
              <h1>{selectedGroup.stationInfo.name}</h1>
              <div className="cd-chips">
                <span className="cd-chip">{selectedGroup.recordCount} {t('recordsCount', 'records')}</span>
                {selectedGroup.validated > 0 && <span className="cd-chip">✓ {selectedGroup.validated} {t('validated', 'Validated')}</span>}
                <span className="cd-chip">{formatAirtime(selectedGroup.airtimeSeconds)} {t('kpiAirtime', 'airtime')}</span>
              </div>
            </div>
            <div className="cd-hero-actions">
              <button onClick={() => setSelectedStationId(null)} className="cd-btn cd-btn-ghost">
                ← {t('backToStationsList', 'Back to Stations')}
              </button>
            </div>
          </div>
        </div>

        <section>
          {selectedGroup.records.map((record) => {
            const source = (record.source || '').toLowerCase();
            const isLate = record.upload_status === 'late';
            const isOnTime = record.upload_status === 'on_time';
            const hasVideos = record.videoFiles && record.videoFiles.length > 0;
            return (
            <div key={record.id} className="cd-record">
              <div className="cd-record-bar">
                <div className="cd-record-bar-left">
                  <span className="cd-record-id">{t('record', 'Record')} #{record.id}</span>
                  <StatusTag status={record.status} label={t(normalizeStatus(record.status), record.status)} />
                </div>
                <div className="cd-record-badges">
                  {source === 'auto' && (
                    <span className="cd-badge cd-badge-auto">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 11a9 9 0 019 9M4 4a16 16 0 0116 16"/><circle cx="5" cy="19" r="1"/></svg>
                      {t('sourceAuto', 'Auto-detected')}
                    </span>
                  )}
                  {source === 'manual' && (
                    <span className="cd-badge cd-badge-manual">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                      {t('sourceManual', 'Manual upload')}
                    </span>
                  )}
                  {isOnTime && <span className="cd-badge cd-badge-ontime">✓ {t('onTime', 'On time')}</span>}
                  {isLate && (
                    <span className="cd-badge cd-badge-late">
                      {t('lateBy', 'Late by {{count}} min', { count: record.late_by_minutes ?? 0 })}
                    </span>
                  )}
                </div>
              </div>

              {/* Timeline strip: submission time / scheduled / aired window */}
              <div className="cd-record-times">
                <div className="cd-time-item">
                  <span className="cd-time-lbl">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    {t('submittedOn', 'Submitted on')}
                  </span>
                  <span className="cd-time-val">
                    {record.createdAt ? formatDateTime(record.createdAt, locale) : formatDate(record.submission_date)}
                  </span>
                </div>
                {record.scheduled_time && (
                  <div className="cd-time-item">
                    <span className="cd-time-lbl">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      {t('scheduledTimeLabel', 'Scheduled time')}
                    </span>
                    <span className="cd-time-val">{formatScheduledTime(record.scheduled_time)}</span>
                  </div>
                )}
                {record.aired_started_at && (
                  <div className="cd-time-item">
                    <span className="cd-time-lbl">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 010 7.07M19.07 4.93a10 10 0 010 14.14"/></svg>
                      {t('airedWindow', 'Aired')}
                    </span>
                    <span className="cd-time-val">
                      {formatClockTime(record.aired_started_at, locale)}
                      {record.aired_ended_at && <> → {formatClockTime(record.aired_ended_at, locale)}</>}
                    </span>
                  </div>
                )}
              </div>

              <div className={`cd-record-grid ${hasVideos ? '' : 'no-video'}`}>
                <div>
                  <h5 className="cd-panel-title">{t('recordDetailsTitle', 'Record Details')}</h5>
                  <p className="cd-info-row"><span>{t('recordSubmissionDate', 'Submission Date')}</span><span>{formatDate(record.submission_date)}</span></p>
                  <p className="cd-info-row"><span>{t('recordStartDate', 'Start Date')}</span><span>{formatDate(record.start_date)}</span></p>
                  <p className="cd-info-row"><span>{t('recordEndDate', 'End Date')}</span><span>{formatDate(record.end_date)}</span></p>
                  {record.validation_comment && (
                    <p className="cd-info-row"><span>{t('validationComment', 'Comment')}</span><span>{record.validation_comment}</span></p>
                  )}
                </div>
                <div>
                  <h5 className="cd-panel-title">{t('audioFilesTitle', 'Audio Files')}</h5>
                  {record.audioFiles && record.audioFiles.length > 0 ? (
                    <ul className="audio-files-list">
                      {record.audioFiles.map((file) => (
                        <li key={file.id} className="audio-file-item"><CustomAudioPlayer file={file} /></li>
                      ))}
                    </ul>
                  ) : (
                    <p className="cd-no-media">{t('noAudioFilesForRecord', 'No audio files.')}</p>
                  )}
                </div>
                {hasVideos && (
                  <div>
                    <h5 className="cd-panel-title">{t('videoFilesTitle', 'Video Files')}</h5>
                    <ul className="video-files-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {record.videoFiles.map((file) => (
                        <li key={file.id} className="video-file-item"><CustomVideoPlayer file={file} /></li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
            );
          })}
        </section>
      </Shell>
    );
  }

  // ---------- Main dashboard view ----------
  const total = stats.totalRecords || 1;
  const pct = (n: number) => (n / total) * 100;
  const statusSegments = [
    { key: 'validated', label: t('validated', 'Validated'), count: stats.validated, color: STATUS_COLORS.validated },
    { key: 'pending', label: t('pending', 'Pending'), count: stats.pending, color: STATUS_COLORS.pending },
    { key: 'rejected', label: t('rejected', 'Rejected'), count: stats.rejected, color: STATUS_COLORS.rejected },
  ];

  return (
    <Shell>
      {/* Hero header with report actions */}
      <div className="cd-hero">
        <div className="cd-hero-top">
          <div>
            <div className="cd-eyebrow">{t('reportEyebrow', 'Campaign Overview')}</div>
            <h1>{currentCampaignName}</h1>
            <div className="cd-chips">
              <span className="cd-chip">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                {stats.firstDate ? formatDate(stats.firstDate) : '—'} → {stats.lastDate ? formatDate(stats.lastDate) : '—'}
              </span>
              <span className="cd-chip">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 11a9 9 0 019 9M4 4a16 16 0 0116 16"/><circle cx="5" cy="19" r="1"/></svg>
                {stats.stationCount} {t('kpiStations', 'Stations')}
              </span>
            </div>
          </div>
          <div className="cd-hero-actions">
            <Link to="/campagne" className="cd-btn cd-btn-ghost">← {t('backToCampaigns')}</Link>
            <button
              className="cd-btn cd-btn-ghost"
              onClick={() => programExport.mutate()}
              disabled={programExport.isPending}
              title={t('cbExportProgramSub', 'Download the broadcast plan as Excel')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              {programExport.isPending ? t('cbExporting', 'Exporting…') : t('cbExportProgram', 'Program (Excel)')}
            </button>
            <button
              className="cd-btn cd-btn-excel"
              onClick={() => reportXlsx.mutate()}
              disabled={!hasRecords || reportXlsx.isPending}
              title={t('exportCsvSub', 'Download as Excel / CSV')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>
              {reportXlsx.isPending ? t('cbExporting', 'Exporting…') : t('exportExcel', 'Download Excel')}
            </button>
            <button
              className="cd-btn cd-btn-pdf"
              onClick={() => reportPdf.mutate()}
              disabled={!hasRecords || reportPdf.isPending}
              title={t('exportPdfSub', 'Printable summary & breakdown')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              {reportPdf.isPending ? t('cbExporting', 'Exporting…') : t('exportPdf', 'PDF report')}
            </button>
          </div>
        </div>
      </div>

      {programExport.isError && (
        <div className="error" style={{ marginBottom: 16 }}>
          {t('cbExportError', 'Program export failed')}: {programExport.error?.message}
        </div>
      )}
      {(reportPdf.isError || reportXlsx.isError) && (
        <div className="error" style={{ marginBottom: 16 }}>
          {t('cbExportError', 'Export failed')}: {(reportPdf.error || reportXlsx.error)?.message}
        </div>
      )}

      {(!records || records.length === 0) ? (
        <div className="cd-card">
          <div className="cd-empty">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#6e42d3" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <p style={{ fontSize: 16 }}>{t('noValidatedRecordsFoundForCampaign', 'No records found for this campaign yet.')}</p>
          </div>
        </div>
      ) : (
        <>
          {/* KPI dashboard */}
          <div className="cd-kpis">
            <KpiCard color="#6e42d3" label={t('kpiTotalRecords', 'Total records')} value={stats.totalRecords}
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>} />
            <KpiCard color="#3a86ff" label={t('kpiStations', 'Stations')} value={stats.stationCount}
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 11a9 9 0 019 9M4 4a16 16 0 0116 16"/><circle cx="5" cy="19" r="1"/></svg>} />
            <KpiCard color="#2ec4b6" label={t('kpiAudioSpots', 'Audio spots')} value={stats.audioCount}
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 18v-6a9 9 0 0118 0v6"/><path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z"/></svg>} />
            <KpiCard color="#8338ec" label={t('kpiAirtime', 'Total airtime')} value={formatAirtime(stats.airtimeSeconds)}
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>} />
          </div>

          {/* Status breakdown */}
          <div className="cd-card">
            <h3 className="cd-section-title">{t('statusBreakdown', 'Status breakdown')}</h3>
            <div className="cd-status-track">
              {statusSegments.filter((s) => s.count > 0).map((s) => (
                <div key={s.key} className="seg" style={{ width: `${pct(s.count)}%`, background: s.color }} title={`${s.label}: ${s.count}`} />
              ))}
              {stats.validated + stats.pending + stats.rejected === 0 && (
                <div className="seg" style={{ width: '100%', background: '#eee7fb' }} />
              )}
            </div>
            <div className="cd-legend-row">
              {statusSegments.map((s) => (
                <span key={s.key} className="cd-legend">
                  <i style={{ background: s.color }} />
                  {s.label}: <strong>{s.count}</strong> · {Math.round(pct(s.count))}%
                </span>
              ))}
            </div>
          </div>

          {/* Station breakdown */}
          <div className="cd-card">
            <h3 className="cd-section-title">{t('stationBreakdown', 'Station breakdown')}</h3>
            <div className="cd-stations">
              {groupedByStation.map((group) => {
                const gTotal = group.recordCount || 1;
                return (
                  <div key={group.stationInfo.id} className="cd-station" onClick={() => setSelectedStationId(group.stationInfo.id)}>
                    <div className="cd-station-head">
                      <div className="cd-station-logo">
                        {stationLogos[group.stationInfo.id] ? (
                          <img
                            src={getLogoUrl(stationLogos[group.stationInfo.id])}
                            alt={group.stationInfo.name}
                            onError={(e) => (e.currentTarget.style.display = 'none')}
                          />
                        ) : (
                          <svg width="30" height="30" viewBox="0 0 32 32" fill="none">
                            <rect width="32" height="32" rx="8" fill="#c7bfff" />
                            <path d="M8 24V14a2 2 0 012-2h12a2 2 0 012 2v10" stroke="#6e42d3" strokeWidth="2" strokeLinecap="round" />
                            <circle cx="16" cy="19" r="3" stroke="#6e42d3" strokeWidth="2" />
                          </svg>
                        )}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <h4 className="cd-station-name">{group.stationInfo.name}</h4>
                        <div className="cd-station-sub">
                          {t('kpiAirtime', 'Airtime')}: {formatAirtime(group.airtimeSeconds)}
                        </div>
                      </div>
                    </div>

                    {/* mini status bar */}
                    <div className="cd-mini-track">
                      {group.validated > 0 && <div className="seg" style={{ width: `${(group.validated / gTotal) * 100}%`, background: STATUS_COLORS.validated }} />}
                      {group.pending > 0 && <div className="seg" style={{ width: `${(group.pending / gTotal) * 100}%`, background: STATUS_COLORS.pending }} />}
                      {group.rejected > 0 && <div className="seg" style={{ width: `${(group.rejected / gTotal) * 100}%`, background: STATUS_COLORS.rejected }} />}
                    </div>

                    <div className="cd-station-metrics">
                      <div className="cd-metric">
                        <div className="cd-metric-val">{group.recordCount}</div>
                        <div className="cd-metric-lbl">{t('recordsCount', 'Records')}</div>
                      </div>
                      <div className="cd-metric">
                        <div className="cd-metric-val">{group.audioCount}</div>
                        <div className="cd-metric-lbl">{t('kpiAudioSpots', 'Audio')}</div>
                      </div>
                      <div className="cd-metric">
                        <div className="cd-metric-val">{group.videoCount}</div>
                        <div className="cd-metric-lbl">{t('kpiVideoSpots', 'Video')}</div>
                      </div>
                    </div>

                    <button className="cd-station-cta" onClick={(e) => { e.stopPropagation(); setSelectedStationId(group.stationInfo.id); }}>
                      {t('viewRecords', 'View records')}
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </Shell>
  );
};

export default CampaignDetail;
