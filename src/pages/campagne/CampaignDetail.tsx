import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useParams, Navigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../utils/apiClient';
import Header from '../../components/Header';
import './CampaignDetail.css';
import { getLogoUrl } from './CampagneList';
import {
  buildCampaignStats,
  formatAirtime,
  exportCampaignCsv,
  openCampaignPrintReport,
  type ReportRecord,
  type ReportLabels,
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
  const fullAudioUrl = `${SERVER_ROOT_URL}/uploads/${file.file_path}`;
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const togglePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play();
    setIsPlaying(!isPlaying);
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      const setAudioData = () => {
        setDuration(audio.duration);
        setCurrentTime(audio.currentTime);
      };
      const setAudioTime = () => setCurrentTime(audio.currentTime);
      const onEnded = () => setIsPlaying(false);
      audio.addEventListener('loadedmetadata', setAudioData);
      audio.addEventListener('timeupdate', setAudioTime);
      audio.addEventListener('ended', onEnded);
      return () => {
        audio.removeEventListener('loadedmetadata', setAudioData);
        audio.removeEventListener('timeupdate', setAudioTime);
        audio.removeEventListener('ended', onEnded);
      };
    }
  }, [audioRef]);

  const formatTime = (time: number) => {
    if (!Number.isFinite(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

  return (
    <div className="custom-audio-player-wrapper">
      <audio ref={audioRef} src={fullAudioUrl} preload="metadata" />
      <div className="audio-controls">
        <button
          onClick={togglePlayPause}
          className={`play-pause-button ${isPlaying ? 'playing' : ''}`}
        >
          {isPlaying ? t('pauseButton', 'Pause') : t('playButton', 'Play')}
        </button>
        <div className="audio-file-name">
          <a href={fullAudioUrl} target="_blank" rel="noopener noreferrer" className="audio-file-link" title={file.original_name}>
            {file.original_name}
          </a>
        </div>
        <div className="time-display">{formatTime(currentTime)} / {formatTime(duration)}</div>
      </div>
      {duration > 0 && (
        <input
          type="range"
          min="0"
          max={duration}
          value={currentTime}
          onChange={(e) => {
            if (audioRef.current) audioRef.current.currentTime = Number(e.target.value);
          }}
          className="progress-bar"
        />
      )}
    </div>
  );
});
CustomAudioPlayer.displayName = 'CustomAudioPlayer';

const CustomVideoPlayer: React.FC<{ file: VideoFile }> = ({ file }) => {
  const fullVideoUrl = `${SERVER_ROOT_URL}/uploads/${file.file_path}`;
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

const CampaignDetail: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { id: campaignId } = useParams<{ id: string }>();
  const { isLoggedIn, client } = useAuth();
  const [selectedStationId, setSelectedStationId] = useState<number | null>(null);
  const [stationLogos, setStationLogos] = useState<{ [stationId: number]: string | undefined }>({});

  const { data: records, isLoading, isError, error } = useQuery<CampaignRecord[], Error>({
    queryKey: ['campaignRecords', campaignId],
    queryFn: () => fetchCampaignRecords(campaignId!),
    enabled: isLoggedIn && !!campaignId,
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

  // Build translated labels for the exported report.
  const reportLabels: ReportLabels = {
    csvHeaders: {
      recordId: t('record', 'Record'),
      station: t('station', 'Station'),
      status: t('status', 'Status'),
      submissionDate: t('submissionDate', 'Submission Date'),
      startDate: t('recordStartDate', 'Start Date'),
      endDate: t('recordEndDate', 'End Date'),
      audioFiles: t('audioFiles', 'Audio Files'),
      videoFiles: t('videoFilesTitle', 'Video Files'),
      airtime: t('kpiAirtime', 'Total airtime'),
      comment: t('validationComment', 'Validation Comment'),
    },
    statusLabels: {
      validated: t('validated', 'Validated'),
      pending: t('pending', 'Pending'),
      rejected: t('rejected', 'Rejected'),
      other: t('status', 'Other'),
    },
    report: {
      title: t('reportTitle', 'Campaign Report'),
      generatedOn: t('generatedOn', 'Generated on'),
      client: t('client', 'Client'),
      period: t('campaignPeriod', 'Period'),
      summary: t('summary', 'Summary'),
      totalRecords: t('kpiTotalRecords', 'Total records'),
      stations: t('kpiStations', 'Stations'),
      validated: t('validated', 'Validated'),
      pending: t('pending', 'Pending'),
      rejected: t('rejected', 'Rejected'),
      audioSpots: t('kpiAudioSpots', 'Audio spots'),
      videoSpots: t('kpiVideoSpots', 'Video spots'),
      totalAirtime: t('kpiAirtime', 'Total airtime'),
      statusBreakdown: t('statusBreakdown', 'Status breakdown'),
      stationBreakdown: t('stationBreakdown', 'Station breakdown'),
      detailedRecords: t('detailedRecords', 'Detailed records'),
      print: t('printReport', 'Print / Save as PDF'),
      noData: t('reportNoData', 'No records available for this campaign yet.'),
    },
  };

  const clientName = client?.company_name || client?.name;
  const locale = i18n.language?.startsWith('fr') ? 'fr-FR' : i18n.language?.startsWith('es') ? 'es-ES' : 'en-US';

  const hasRecords = !!records && records.length > 0;
  const handleExportPdf = () => {
    openCampaignPrintReport(currentCampaignName, (records ?? []) as ReportRecord[], reportLabels, clientName, locale);
  };
  const handleExportCsv = () => {
    exportCampaignCsv(currentCampaignName, (records ?? []) as ReportRecord[], reportLabels, locale);
  };

  // ---------- Loading / error / empty ----------
  const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="page-container cd-page">
      <Header />
      <main className="main-content campaign-detail-page">
        <div className="cd-shell">{children}</div>
      </main>
    </div>
  );

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
          {selectedGroup.records.map((record) => (
            <div key={record.id} className="cd-record">
              <div className="cd-record-bar">
                <span className="cd-record-id">{t('record', 'Record')} #{record.id}</span>
                <StatusTag status={record.status} label={t(normalizeStatus(record.status), record.status)} />
              </div>
              <div className="cd-record-grid">
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
                    <p style={{ color: '#9ca3af', fontSize: 14, fontStyle: 'italic' }}>{t('noAudioFilesForRecord', 'No audio files.')}</p>
                  )}
                </div>
                <div>
                  <h5 className="cd-panel-title">{t('videoFilesTitle', 'Video Files')}</h5>
                  {record.videoFiles && record.videoFiles.length > 0 ? (
                    <ul className="video-files-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {record.videoFiles.map((file) => (
                        <li key={file.id} className="video-file-item"><CustomVideoPlayer file={file} /></li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ color: '#9ca3af', fontSize: 14, fontStyle: 'italic' }}>{t('noVideoFilesForRecord', 'No video files.')}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
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
            <button className="cd-btn cd-btn-excel" onClick={handleExportCsv} disabled={!hasRecords} title={t('exportCsvSub', 'Download as Excel / CSV')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>
              {t('exportExcel', 'Download Excel')}
            </button>
            <button className="cd-btn cd-btn-pdf" onClick={handleExportPdf} disabled={!hasRecords} title={t('exportPdfSub', 'Printable summary & breakdown')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              {t('exportPdf', 'PDF report')}
            </button>
          </div>
        </div>
      </div>

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
