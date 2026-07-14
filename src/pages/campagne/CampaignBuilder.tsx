import React, { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import Header from '../../components/Header';
import { useAuth } from '../../context/AuthContext';
import {
  deleteCampaign,
  downloadCampaignProgramExport,
  downloadScheduleTemplate,
  fetchMyCampaigns,
  fetchStationProgram,
  importSchedules,
  isCampaignEditable,
  previewScheduleImport,
  submitCampaign,
  toShortTime,
  uploadSpot,
  type Campaign,
  type ImportPreview,
  type ImportResult,
  type ProgramSlot,
  type Spot,
} from './builderApi';
import { useCampaignSchedules } from './useCampaignSchedules';
import './CampaignBuilder.css';

const SERVER_ROOT_URL = 'https://api.proxycom.net';
const MAX_SPOT_SIZE = 50 * 1024 * 1024; // 50 MB

const formatBytes = (bytes?: number | null): string => {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Module-level so its identity is stable across renders — defining it inside
// the page component would remount the whole tree (and drop input focus) on
// every keystroke.
const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="page-container">
    <Header />
    <main className="main-content">
      <div className="cb-shell">{children}</div>
    </main>
  </div>
);

// Inline preview of a station's published program, fetched when the card is
// expanded (the query is cached, so re-opening is instant).
const StationProgramPreview: React.FC<{ stationId: number }> = ({ stationId }) => {
  const { t } = useTranslation();
  const { data: program, isLoading, isError } = useQuery<ProgramSlot[], Error>({
    queryKey: ['stationProgram', stationId],
    queryFn: () => fetchStationProgram(stationId),
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) {
    return <div className="cb-program-preview muted">{t('cbLoadingProgram', 'Loading program…')}</div>;
  }
  if (isError) {
    return <div className="cb-program-preview muted">{t('cbProgramError', 'Could not load the program.')}</div>;
  }
  if (!program || program.length === 0) {
    return <div className="cb-program-preview muted">{t('cbNoProgram', 'This station has not published a program yet.')}</div>;
  }
  return (
    <div className="cb-program-preview">
      <span className="cb-program-preview-title">
        {t('cbProgramTitle', 'Published program')} · {program.length}
      </span>
      <div className="cb-program-preview-chips">
        {program.map((slot) => (
          <span key={slot.id} className="cb-program-chip" title={slot.label ?? undefined}>
            {toShortTime(slot.scheduled_time)}
            {slot.label ? ` — ${slot.label}` : ''}
          </span>
        ))}
      </div>
    </div>
  );
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const { t } = useTranslation();
  const labels: Record<string, string> = {
    draft: t('statusDraft', 'Draft'),
    pending_approval: t('statusPendingApproval', 'Pending approval'),
    active: t('statusActive', 'Active'),
    rejected: t('statusRejected', 'Rejected'),
  };
  const cls = ['draft', 'pending_approval', 'active', 'rejected'].includes(status) ? status : 'draft';
  return (
    <span className={`cb-badge ${cls}`}>
      <i />
      {labels[status] ?? status}
    </span>
  );
};

const CampaignBuilder: React.FC = () => {
  const { t } = useTranslation();
  const { id: campaignId } = useParams<{ id: string }>();
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ---- Data ----
  const { data: campaigns, isLoading: campaignLoading } = useQuery<Campaign[], Error>({
    queryKey: ['myClientCampaigns'],
    queryFn: fetchMyCampaigns,
    enabled: isLoggedIn,
  });
  const campaign = useMemo(
    () => campaigns?.find((c) => String(c.id) === String(campaignId)),
    [campaigns, campaignId]
  );

  const { spots, spotsLoading, schedules } = useCampaignSchedules(campaignId, isLoggedIn);

  const editable = isCampaignEditable(campaign?.status);
  const stations = useMemo(() => campaign?.radioStations ?? [], [campaign]);

  // ---- UI state ----
  const [alert, setAlert] = useState<{ kind: 'error' | 'success' | 'info'; text: string } | null>(null);
  const [spotName, setSpotName] = useState('');
  const [spotDescription, setSpotDescription] = useState('');
  const [spotFile, setSpotFile] = useState<File | null>(null);
  const [spotFileKey, setSpotFileKey] = useState(0); // to reset the file input

  // Excel schedule import (two-step: preview → import with spot mapping)
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importFileKey, setImportFileKey] = useState(0);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importMapping, setImportMapping] = useState<Record<string, number | ''>>({});
  const [autoAssignStations, setAutoAssignStations] = useState(true);
  const [importDate, setImportDate] = useState(''); // '' → base plan

  // Station card expanded to show its published program
  const [expandedStationId, setExpandedStationId] = useState<number | null>(null);

  // ---- Mutations ----
  const uploadMutation = useMutation<Spot, Error, void>({
    mutationFn: () =>
      uploadSpot(campaignId!, {
        name: spotName.trim(),
        description: spotDescription.trim() || undefined,
        file: spotFile!,
      }),
    onSuccess: (spot) => {
      queryClient.invalidateQueries({ queryKey: ['campaignSpots', campaignId] });
      setSpotName('');
      setSpotDescription('');
      setSpotFile(null);
      setSpotFileKey((k) => k + 1);
      setAlert({ kind: 'success', text: t('cbSpotUploaded', 'Spot "{{name}}" uploaded.', { name: spot.name }) });
    },
    onError: (error) => setAlert({ kind: 'error', text: error.message }),
  });

  const exportMutation = useMutation<void, Error, void>({
    mutationFn: () => downloadCampaignProgramExport(campaignId!, campaign?.name),
    onError: (error) => setAlert({ kind: 'error', text: error.message }),
  });

  const deleteMutation = useMutation<void, Error, void>({
    mutationFn: () => deleteCampaign(campaignId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myClientCampaigns'] });
      queryClient.removeQueries({ queryKey: ['campaignSpots', campaignId] });
      queryClient.removeQueries({ queryKey: ['campaignSchedules', campaignId] });
      navigate('/campagne');
    },
    onError: (error) => setAlert({ kind: 'error', text: error.message }),
  });

  const templateMutation = useMutation<void, Error, void>({
    mutationFn: () => downloadScheduleTemplate(campaignId!, campaign?.name),
    onError: (error) => setAlert({ kind: 'error', text: error.message }),
  });

  const previewMutation = useMutation<ImportPreview, Error, File>({
    mutationFn: (file) => previewScheduleImport(campaignId!, file),
    onSuccess: (preview) => {
      setImportPreview(preview);
      setImportMapping(
        Object.fromEntries(
          preview.codes.map((c) => [c.code, c.suggested_spot_id ?? ('' as const)])
        )
      );
      setAlert(null);
    },
    onError: (error) => {
      setAlert({ kind: 'error', text: error.message });
      resetImport();
    },
  });

  const importMutation = useMutation<ImportResult, Error, void>({
    mutationFn: () => {
      const mapping = Object.fromEntries(
        Object.entries(importMapping).filter(([, spotId]) => spotId !== '')
      ) as Record<string, number>;
      return importSchedules(campaignId!, importFile!, mapping, autoAssignStations, importDate || undefined);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['campaignSchedules', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['campaignSpots', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['myClientCampaigns'] }); // stations may have been assigned
      const warnings: string[] = [];
      if ((result.skipped_identical_days ?? 0) > 0)
        warnings.push(
          t('cbImportIdenticalSkipped', '{{count}} station-day(s) matched the base plan and keep following it.', {
            count: result.skipped_identical_days,
          })
        );
      if (result.unmatched_stations.length > 0)
        warnings.push(
          t('cbImportUnmatchedStations', 'Unrecognized stations skipped: {{list}}', {
            list: result.unmatched_stations.join(', '),
          })
        );
      if (result.unmapped_codes.length > 0)
        warnings.push(
          t('cbImportUnmappedCodes', 'Codes without a spot skipped: {{list}}', {
            list: result.unmapped_codes.join(', '),
          })
        );
      setAlert({
        kind: warnings.length > 0 ? 'info' : 'success',
        text:
          t('cbImportDone', '{{created}} broadcast times imported ({{skipped}} already existed).', {
            created: result.created,
            skipped: result.skipped,
          }) + (warnings.length > 0 ? ` ${warnings.join(' ')}` : ''),
      });
      resetImport();
    },
    onError: (error) => setAlert({ kind: 'error', text: error.message }),
  });

  const submitMutation = useMutation<Campaign, Error, void>({
    mutationFn: () => submitCampaign(campaignId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myClientCampaigns'] });
      setAlert({
        kind: 'success',
        text: t('cbSubmitted', 'Campaign submitted for approval. You will be notified once it is reviewed.'),
      });
    },
    onError: (error) => setAlert({ kind: 'error', text: error.message }),
  });

  // ---- Guards ----
  if (!isLoggedIn) return <Navigate to="/" />;
  if (!campaignId) return <Navigate to="/campagne" />;

  if (campaignLoading) {
    return <Shell><div className="cb-empty">{t('cbLoadingCampaign', 'Loading campaign…')}</div></Shell>;
  }
  if (!campaign) {
    return (
      <Shell>
        <div className="cb-alert error">{t('cbCampaignNotFound', 'Campaign not found.')}</div>
        <Link to="/campagne" className="cb-btn cb-btn-ghost">← {t('backToCampaigns', 'Back to campaigns')}</Link>
      </Shell>
    );
  }

  // ---- Handlers ----
  function resetImport() {
    setImportFile(null);
    setImportPreview(null);
    setImportMapping({});
    setImportDate('');
    setImportFileKey((k) => k + 1);
  }

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setImportFile(file);
    setImportPreview(null);
    if (file) previewMutation.mutate(file);
  };

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    setAlert(null);
    if (!spotName.trim())
      return setAlert({ kind: 'error', text: t('cbErrorSpotName', 'Please enter a spot name.') });
    if (!spotFile)
      return setAlert({ kind: 'error', text: t('cbErrorSpotFile', 'Please choose an audio file.') });
    if (spotFile.size > MAX_SPOT_SIZE)
      return setAlert({ kind: 'error', text: t('cbErrorSpotSize', 'The audio file must be 50 MB or less.') });
    uploadMutation.mutate();
  };

  const handleSubmitCampaign = () => {
    if (window.confirm(t('cbSubmitConfirm', 'Submit this campaign for approval? You will not be able to edit it while it is being reviewed.'))) {
      submitMutation.mutate();
    }
  };

  const handleDeleteCampaign = () => {
    if (
      window.confirm(
        t('cbDeleteConfirm', 'Delete "{{name}}" and all its spots and broadcast times? This cannot be undone.', {
          name: campaign.name,
        })
      )
    ) {
      deleteMutation.mutate();
    }
  };

  return (
    <Shell>
      {/* ---- Hero ---- */}
      <div className="cb-hero">
        <div className="cb-hero-top">
          <div>
            <div className="cb-eyebrow">{t('cbBuilderEyebrow', 'Campaign builder')}</div>
            <h1>{campaign.name}</h1>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <StatusBadge status={campaign.status} />
              <span style={{ fontSize: 13.5, opacity: 0.9 }}>
                {new Date(campaign.start_date).toLocaleDateString()} → {new Date(campaign.end_date).toLocaleDateString()}
              </span>
              <span style={{ fontSize: 13.5, opacity: 0.9 }}>
                {stations.length} {t('kpiStations', 'stations')}
              </span>
            </div>
          </div>
          <div className="cb-actions-row">
            <Link to="/campagne" className="cb-btn cb-btn-ghost on-dark">← {t('backToCampaigns', 'Back to campaigns')}</Link>
            <button
              className="cb-btn cb-btn-ghost on-dark"
              onClick={() => exportMutation.mutate()}
              disabled={exportMutation.isPending}
              title={t('cbExportProgramSub', 'Download the broadcast plan as Excel')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              {exportMutation.isPending ? t('cbExporting', 'Exporting…') : t('cbExportProgram', 'Program (Excel)')}
            </button>
            {editable && (
              <>
                <button
                  className="cb-btn cb-btn-success"
                  onClick={handleSubmitCampaign}
                  disabled={submitMutation.isPending || spots.length === 0}
                  title={spots.length === 0 ? t('cbSubmitNeedsSpot', 'Upload at least one spot first.') : undefined}
                >
                  {submitMutation.isPending
                    ? t('cbSubmitting', 'Submitting…')
                    : t('cbSubmitForApproval', 'Submit for approval')}
                </button>
                <button
                  className="cb-btn cb-btn-delete"
                  onClick={handleDeleteCampaign}
                  disabled={deleteMutation.isPending}
                  title={t('cbDeleteSub', 'Delete this draft campaign')}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                  {deleteMutation.isPending ? t('cbDeleting', 'Deleting…') : t('cbDelete', 'Delete')}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ---- Status notices ---- */}
      {campaign.status === 'rejected' && (
        <div className="cb-alert error">
          <strong>{t('cbRejectedNotice', 'This campaign was rejected.')}</strong>
          {campaign.review_comment && <div style={{ marginTop: 4 }}>{campaign.review_comment}</div>}
          <div style={{ marginTop: 4 }}>{t('cbRejectedHint', 'You can edit it and submit it again.')}</div>
        </div>
      )}
      {campaign.status === 'pending_approval' && (
        <div className="cb-alert info">
          {t('cbPendingNotice', 'This campaign is awaiting approval — it cannot be edited right now.')}
        </div>
      )}
      {campaign.status === 'active' && (
        <div className="cb-alert success">
          {t('cbActiveNotice', 'This campaign is active and being broadcast. Editing is disabled.')}
        </div>
      )}

      {alert && <div className={`cb-alert ${alert.kind}`}>{alert.text}</div>}

      {/* ---- Spots ---- */}
      <div className="cb-card">
        <h3 className="cb-section-title">
          🎙 {t('cbSpotsTitle', 'Audio spots')}
          <span className="cb-badge draft" style={{ textTransform: 'none', letterSpacing: 0 }}>
            {spots.length}
          </span>
        </h3>
        <p className="cb-section-sub">
          {t('cbSpotsSub', 'Upload the audio ads that will be broadcast (mp3/wav, max 50 MB).')}
        </p>

        {editable && (
          <form className="cb-inline-form" onSubmit={handleUpload}>
            <div className="cb-field" style={{ flex: 1, minWidth: 180 }}>
              <label htmlFor="cb-spot-name">{t('cbSpotName', 'Spot name')} *</label>
              <input
                id="cb-spot-name"
                className="cb-input"
                type="text"
                value={spotName}
                onChange={(e) => setSpotName(e.target.value)}
                placeholder={t('cbSpotNamePh', 'e.g. OM Compte en Self VF')}
              />
            </div>
            <div className="cb-field" style={{ flex: 1, minWidth: 180 }}>
              <label htmlFor="cb-spot-desc">{t('cbSpotDescription', 'Description (optional)')}</label>
              <input
                id="cb-spot-desc"
                className="cb-input"
                type="text"
                value={spotDescription}
                onChange={(e) => setSpotDescription(e.target.value)}
              />
            </div>
            <div className="cb-field" style={{ minWidth: 200 }}>
              <label htmlFor="cb-spot-file">{t('cbSpotFile', 'Audio file')} *</label>
              <input
                id="cb-spot-file"
                key={spotFileKey}
                className="cb-input"
                type="file"
                accept="audio/*"
                onChange={(e) => setSpotFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <button type="submit" className="cb-btn cb-btn-primary" disabled={uploadMutation.isPending}>
              {uploadMutation.isPending ? t('cbUploading', 'Uploading…') : t('cbUploadSpot', 'Upload spot')}
            </button>
          </form>
        )}

        {spotsLoading ? (
          <div className="cb-empty">{t('cbLoadingSpots', 'Loading spots…')}</div>
        ) : spots.length === 0 ? (
          <div className="cb-empty">{t('cbNoSpots', 'No spots yet. Upload your first audio spot above.')}</div>
        ) : (
          spots.map((spot) => (
            <div key={spot.id} className="cb-spot-row">
              <div className="cb-spot-main">
                <div className="cb-spot-name">{spot.name}</div>
                <div className="cb-spot-meta">
                  {spot.description && <span>{spot.description} · </span>}
                  {spot.duration_seconds ? <span>{spot.duration_seconds}s · </span> : null}
                  {formatBytes(spot.audio_size_bytes)}
                  {spot.fingerprint_status && spot.fingerprint_status !== 'ready' && (
                    <span> · {t('cbFingerprint', 'fingerprint')}: {spot.fingerprint_status}</span>
                  )}
                </div>
              </div>
              {spot.audio_file_path && (
                <audio controls preload="none" src={`${SERVER_ROOT_URL}/uploads/${spot.audio_file_path}`} />
              )}
              <span className="cb-badge draft" style={{ textTransform: 'none', letterSpacing: 0 }}>
                {schedules.filter((s) => s.spot_id === spot.id).length} {t('cbTimesShort', 'times')}
              </span>
            </div>
          ))
        )}
      </div>

      {/* ---- Broadcast schedule: pick a station → drag & drop editor ---- */}
      <div className="cb-card">
        <div className="cb-schedule-head">
          <div>
            <h3 className="cb-section-title" style={{ marginBottom: 4 }}>📻 {t('cbScheduleTitle', 'Broadcast schedule')}</h3>
            <p className="cb-section-sub" style={{ margin: 0 }}>
              {t('cbScheduleCardsSub', 'Choose a station to open the schedule editor and drag your spots into its time slots.')}
            </p>
          </div>
          {editable && (
            <div className="cb-actions-row">
              <button
                type="button"
                className="cb-btn cb-btn-ghost"
                onClick={() => templateMutation.mutate()}
                disabled={templateMutation.isPending}
                title={t('cbTemplateSub', 'Blank Excel grid with your stations and spot legend, ready to fill in')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                {templateMutation.isPending
                  ? t('cbExporting', 'Exporting…')
                  : t('cbTemplate', 'Download template')}
              </button>
              <label className={`cb-btn cb-btn-ghost ${previewMutation.isPending ? 'cb-btn-busy' : ''}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                {previewMutation.isPending
                  ? t('cbImportAnalyzing', 'Analyzing…')
                  : t('cbImportExcel', 'Import Excel schedule')}
                <input
                  key={importFileKey}
                  type="file"
                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  style={{ display: 'none' }}
                  onChange={handleImportFileChange}
                  disabled={previewMutation.isPending}
                />
              </label>
            </div>
          )}
        </div>

        {/* Import preview: map codes to spots, then confirm */}
        {importPreview && (
          <div className="cb-import-panel">
            <div className="cb-import-summary">
              <strong>{importFile?.name}</strong> — {importPreview.total_slots}{' '}
              {t('cbImportSlotsFound', 'broadcast times found')} ·{' '}
              {importPreview.stations.matched.length} {t('cbImportStationsMatched', 'stations recognized')}
              {importPreview.stations.unmatched.length > 0 && (
                <span className="cb-import-warn">
                  {' '}· {t('cbImportStationsUnmatched', 'not recognized')}: {importPreview.stations.unmatched.join(', ')}
                </span>
              )}
            </div>

            {importPreview.codes.length > 0 && (
              <>
                <p className="cb-section-sub" style={{ margin: '10px 0 8px' }}>
                  {t('cbImportMapHint', 'Choose which spot each code in the file corresponds to:')}
                </p>
                <div className="cb-import-codes">
                  {importPreview.codes.map((code) => (
                    <div key={code.code} className="cb-import-code-row">
                      <span className="cb-import-code">{code.code}</span>
                      <span className="cb-import-legend">{code.legend_name ?? ''}</span>
                      <select
                        className="cb-select"
                        value={importMapping[code.code] ?? ''}
                        onChange={(e) =>
                          setImportMapping((prev) => ({
                            ...prev,
                            [code.code]: e.target.value === '' ? '' : Number(e.target.value),
                          }))
                        }
                      >
                        <option value="">{t('cbChooseSpot', 'Choose a spot…')}</option>
                        {importPreview.campaign_spots.map((spot) => (
                          <option key={spot.id} value={spot.id}>{spot.name}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="cb-import-date">
              <label htmlFor="cb-import-date">
                {t('cbImportDate', 'Import into a specific day (optional). Leave empty to follow the file: multi-day exports use their own Date column, plain grids go to the every-day base plan.')}
              </label>
              <input
                id="cb-import-date"
                type="date"
                className="cb-input"
                value={importDate}
                min={campaign.start_date?.slice(0, 10)}
                max={campaign.end_date?.slice(0, 10)}
                onChange={(e) => setImportDate(e.target.value)}
              />
            </div>

            <label className="cb-import-auto">
              <input
                type="checkbox"
                checked={autoAssignStations}
                onChange={(e) => setAutoAssignStations(e.target.checked)}
              />
              {t('cbImportAutoAssign', 'Automatically add stations found in the file to this campaign')}
            </label>

            <div className="cb-actions-row" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="cb-btn cb-btn-primary"
                onClick={() => importMutation.mutate()}
                disabled={importMutation.isPending}
              >
                {importMutation.isPending
                  ? t('cbImporting', 'Importing…')
                  : t('cbImportConfirm', 'Import {{count}} broadcast times', { count: importPreview.total_slots })}
              </button>
              <button type="button" className="cb-btn cb-btn-ghost" onClick={resetImport} disabled={importMutation.isPending}>
                {t('cancel', 'Cancel')}
              </button>
            </div>
          </div>
        )}

        {stations.length === 0 ? (
          <div className="cb-empty">{t('cbNoStationsAssigned', 'No radio stations are assigned to this campaign.')}</div>
        ) : (
          <div className="cb-station-cards">
            {stations.map((station) => {
              const count = schedules.filter((s) => s.radio_station_id === station.id).length;
              const expanded = expandedStationId === station.id;
              return (
                <div key={station.id} className={`cb-station-card ${expanded ? 'expanded' : ''}`}>
                  <button
                    type="button"
                    className="cb-station-card-head"
                    onClick={() => setExpandedStationId(expanded ? null : station.id)}
                    aria-expanded={expanded}
                  >
                    <div className="cb-station-card-top">
                      <span className="cb-station-card-name">{station.name}</span>
                      <span className={`cb-badge ${count > 0 ? 'active' : 'draft'}`} style={{ textTransform: 'none', letterSpacing: 0 }}>
                        {count} {t('cbTimesShort', 'times')}
                      </span>
                    </div>
                    <span className="cb-station-card-subrow">
                      {(station.frequency || station.region) && (
                        <span className="cb-station-card-sub">
                          {[station.frequency, station.region].filter(Boolean).join(' · ')}
                        </span>
                      )}
                      <svg
                        className={`cb-station-card-caret ${expanded ? 'open' : ''}`}
                        width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </span>
                  </button>

                  {expanded && <StationProgramPreview stationId={station.id} />}

                  <Link
                    to={`/campagne/${campaignId}/schedule?station=${station.id}`}
                    className="cb-station-card-cta"
                  >
                    {editable ? t('cbOpenEditor', 'Open schedule editor') : t('cbViewSchedule', 'View schedule')}
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Shell>
  );
};

export default CampaignBuilder;
