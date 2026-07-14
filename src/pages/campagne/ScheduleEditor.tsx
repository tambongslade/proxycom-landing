import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import Header from '../../components/Header';
import { useAuth } from '../../context/AuthContext';
import {
  downloadCampaignProgramExport,
  fetchCampaignSchedules,
  fetchMyCampaigns,
  fetchScheduleDates,
  fetchStationProgram,
  isCampaignEditable,
  toShortTime,
  type Campaign,
  type ProgramSlot,
  type Spot,
  type SpotSchedule,
} from './builderApi';
import { useCampaignSchedules } from './useCampaignSchedules';
import './CampaignBuilder.css';
import './ScheduleEditor.css';

// Module-level: stable identity across renders (inputs keep focus).
const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="page-container">
    <Header />
    <main className="main-content">
      <div className="cb-shell se-shell">{children}</div>
    </main>
  </div>
);

interface SlotRow {
  time: string; // "HH:mm"
  label?: string | null;
  fromProgram: boolean;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const shiftMonth = (ym: string, months: number): string => {
  const d = new Date(`${ym}-01T12:00:00`);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 7);
};

const monthLabel = (ym: string, locale: string): string =>
  new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
    new Date(`${ym}-01T12:00:00`)
  );

// Compact day label: narrow weekday letter + day of month, localized —
// Monday 1 → "M1" (en) / "L1" (fr, lundi) / "L1" (es, lunes).
const dayChipLabel = (date: string, locale: string): string => {
  const d = new Date(`${date}T12:00:00`);
  const letter = new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(d).toUpperCase();
  return `${letter}${d.getDate()}`;
};

const dayFullLabel = (date: string, locale: string): string => {
  const d = new Date(`${date}T12:00:00`);
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
};

const ScheduleEditor: React.FC = () => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language || 'en';
  const { id: campaignId } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isLoggedIn } = useAuth();

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
  const stations = useMemo(() => campaign?.radioStations ?? [], [campaign]);
  const editable = isCampaignEditable(campaign?.status);

  // ---- Selected plan: base (null) or a specific day (synced with ?date=) ----
  const dateParam = searchParams.get('date');
  const selectedDate = dateParam && DATE_RE.test(dateParam) ? dateParam : null;

  const { spots, spotsLoading, schedules, addSchedule, removeSchedule, replicate, materialize } =
    useCampaignSchedules(campaignId, isLoggedIn, selectedDate);

  // ---- Active station (synced with ?station=) ----
  const stationParam = Number(searchParams.get('station')) || null;
  const activeStationId =
    stationParam && stations.some((s) => s.id === stationParam)
      ? stationParam
      : stations[0]?.id ?? null;
  const activeStation = stations.find((s) => s.id === activeStationId);

  const updateParams = (updates: { station?: number; date?: string | null }) => {
    const next: Record<string, string> = {};
    const station = updates.station ?? activeStationId;
    if (station != null) next.station = String(station);
    const date = 'date' in updates ? updates.date : selectedDate;
    if (date) next.date = date;
    setSearchParams(next, { replace: true });
  };

  const selectStation = (id: number) => updateParams({ station: id });
  const selectDate = (date: string | null) => updateParams({ date });

  const { data: program } = useQuery<ProgramSlot[], Error>({
    queryKey: ['stationProgram', activeStationId],
    queryFn: () => fetchStationProgram(activeStationId!),
    enabled: isLoggedIn && activeStationId != null,
    staleTime: 1000 * 60 * 5,
  });

  // Days that have customized plans (calendar-dot data).
  const { data: customizedDates } = useQuery<string[], Error>({
    queryKey: ['scheduleDates', campaignId],
    queryFn: () => fetchScheduleDates(campaignId!),
    enabled: isLoggedIn && !!campaignId,
  });

  // Base plan, used as a read-only preview when a day isn't materialized yet.
  const { data: basePlan } = useQuery<SpotSchedule[] | null, Error>({
    queryKey: ['campaignSchedules', campaignId, 'base'],
    queryFn: () => fetchCampaignSchedules(campaignId!, null),
    enabled: isLoggedIn && !!campaignId && selectedDate != null,
  });

  // ---- UI state ----
  const [alert, setAlert] = useState<{ kind: 'error' | 'success' | 'info'; text: string } | null>(null);
  const [selectedSpotId, setSelectedSpotId] = useState<number | null>(null); // click-to-place
  const [dragOverTime, setDragOverTime] = useState<string | null>(null);
  const [customTimes, setCustomTimes] = useState<Record<number, string[]>>({}); // per station
  const [newTime, setNewTime] = useState('');
  const [windowBefore, setWindowBefore] = useState(10);
  const [windowAfter, setWindowAfter] = useState(10);
  const [copyTarget, setCopyTarget] = useState<'all' | number>('all');
  const [viewMonth, setViewMonth] = useState<string | null>(null); // "YYYY-MM" shown in the day strip

  // Reset transient state when switching stations.
  useEffect(() => {
    setDragOverTime(null);
    setAlert(null);
  }, [activeStationId]);

  const stationSchedules = useMemo(
    () => schedules.filter((s) => s.radio_station_id === activeStationId),
    [schedules, activeStationId]
  );

  // On a day that hasn't been materialized for this station, the base plan
  // applies — show it as a read-only ghost preview.
  const ghostSchedules = useMemo<SpotSchedule[]>(() => {
    if (!selectedDate || stationSchedules.length > 0) return [];
    return (basePlan ?? []).filter(
      (s) => s.radio_station_id === activeStationId && !s.schedule_date
    );
  }, [selectedDate, stationSchedules, basePlan, activeStationId]);

  // Board rows: station program times ∪ scheduled times ∪ locally added times.
  const slotRows = useMemo<SlotRow[]>(() => {
    const rows = new Map<string, SlotRow>();
    (program ?? []).forEach((p) => {
      const time = toShortTime(p.scheduled_time);
      rows.set(time, { time, label: p.label, fromProgram: true });
    });
    [...stationSchedules, ...ghostSchedules].forEach((s) => {
      const time = toShortTime(s.scheduled_time);
      if (!rows.has(time)) rows.set(time, { time, fromProgram: false });
    });
    (customTimes[activeStationId ?? -1] ?? []).forEach((time) => {
      if (!rows.has(time)) rows.set(time, { time, fromProgram: false });
    });
    return [...rows.values()].sort((a, b) => a.time.localeCompare(b.time));
  }, [program, stationSchedules, ghostSchedules, customTimes, activeStationId]);

  const spotById = useMemo(() => new Map(spots.map((s) => [s.id, s])), [spots]);

  const exportMutation = useMutation<void, Error, void>({
    mutationFn: () => downloadCampaignProgramExport(campaignId!, campaign?.name, selectedDate),
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

  // ---- Actions ----
  const placeSpot = (spotId: number, time: string) => {
    if (!editable || activeStationId == null) return;
    const duplicate = stationSchedules.some(
      (s) => s.spot_id === spotId && toShortTime(s.scheduled_time) === time
    );
    if (duplicate) {
      setAlert({
        kind: 'info',
        text: t('seDuplicate', 'This spot is already scheduled at {{time}} on this station.', { time }),
      });
      return;
    }
    setAlert(null);
    addSchedule.mutate(
      {
        spot_id: spotId,
        radio_station_id: activeStationId,
        scheduled_time: time,
        ...(selectedDate ? { schedule_date: selectedDate } : {}),
        upload_window_before: windowBefore,
        upload_window_after: windowAfter,
      },
      { onError: (error) => setAlert({ kind: 'error', text: error.message }) }
    );
  };

  const handleMaterialize = () => {
    if (!selectedDate || activeStationId == null) return;
    materialize.mutate(
      { date: selectedDate, radioStationId: activeStationId },
      {
        onSuccess: (result) =>
          setAlert({
            kind: 'success',
            text: t('seMaterialized', '{{created}} times copied from the base plan into {{date}}.', {
              created: result.created,
              date: dayFullLabel(selectedDate, locale),
            }),
          }),
        onError: (error) => setAlert({ kind: 'error', text: error.message }),
      }
    );
  };

  const handleDrop = (e: React.DragEvent, time: string) => {
    e.preventDefault();
    setDragOverTime(null);
    const spotId = Number(e.dataTransfer.getData('text/plain'));
    if (spotId) placeSpot(spotId, time);
  };

  const handleSlotClick = (time: string) => {
    if (selectedSpotId != null) {
      placeSpot(selectedSpotId, time);
      setSelectedSpotId(null);
    }
  };

  const handleAddTime = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTime || activeStationId == null) return;
    setCustomTimes((prev) => {
      const list = prev[activeStationId] ?? [];
      return list.includes(newTime) ? prev : { ...prev, [activeStationId]: [...list, newTime] };
    });
    setNewTime('');
  };

  const handleCopy = () => {
    if (activeStationId == null) return;
    replicate.mutate(
      {
        sourceStationId: activeStationId,
        targets: copyTarget === 'all' ? 'all' : [copyTarget],
      },
      {
        onSuccess: (result) =>
          setAlert({
            kind: 'success',
            text: t('cbReplicated', '{{created}} broadcast times copied to {{stations}} station(s).', {
              created: result.created,
              stations: result.targets.length,
            }),
          }),
        onError: (error) => setAlert({ kind: 'error', text: error.message }),
      }
    );
  };

  const otherStations = stations.filter((s) => s.id !== activeStationId);
  const spotUsageCount = (spot: Spot) =>
    schedules.filter((s) => s.spot_id === spot.id && s.radio_station_id === activeStationId).length;

  return (
    <Shell>
      {/* ---- Top bar ---- */}
      <div className="se-topbar">
        <div className="se-topbar-left">
          <Link to={`/campagne/${campaignId}/builder`} className="cb-btn cb-btn-ghost">
            ← {t('seBackToBuilder', 'Back to campaign')}
          </Link>
          <div>
            <div className="cb-eyebrow" style={{ color: '#8a84a3' }}>{campaign.name}</div>
            <h1 className="se-title">{t('seTitle', 'Broadcast schedule')}</h1>
          </div>
        </div>
        <button
          type="button"
          className="cb-btn cb-btn-ghost"
          onClick={() => exportMutation.mutate()}
          disabled={exportMutation.isPending}
          title={t('cbExportProgramSub', 'Download the broadcast plan as Excel')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          {exportMutation.isPending
            ? t('cbExporting', 'Exporting…')
            : selectedDate
            ? t('seExportDay', 'Export {{date}} (Excel)', { date: dayChipLabel(selectedDate, locale) })
            : t('cbExportProgram', 'Program (Excel)')}
        </button>
        {editable && !selectedDate && otherStations.length > 0 && (
          <div className="se-copy">
            <span className="se-copy-label">{t('cbReplicateTitle', 'Copy this station’s schedule to')}</span>
            <select
              className="cb-select"
              value={copyTarget === 'all' ? 'all' : String(copyTarget)}
              onChange={(e) => setCopyTarget(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            >
              <option value="all">{t('cbAllOtherStations', 'All other stations')}</option>
              {otherStations.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <button
              type="button"
              className="cb-btn cb-btn-primary"
              onClick={handleCopy}
              disabled={replicate.isPending || stationSchedules.length === 0}
              title={stationSchedules.length === 0 ? t('seCopyNeedsSlots', 'Schedule at least one time first.') : undefined}
            >
              {replicate.isPending ? t('cbCopying', 'Copying…') : t('cbReplicate', 'Copy schedule')}
            </button>
          </div>
        )}
      </div>

      {/* ---- Station switcher ---- */}
      <div className="se-stations">
        {stations.map((station) => {
          const count = schedules.filter((s) => s.radio_station_id === station.id).length;
          return (
            <button
              key={station.id}
              type="button"
              className={`se-station ${station.id === activeStationId ? 'active' : ''}`}
              onClick={() => selectStation(station.id)}
            >
              <span className="se-station-name">{station.name}</span>
              <span className="se-station-count">{count}</span>
            </button>
          );
        })}
      </div>

      {!editable && (
        <div className="cb-alert info">
          {t('seReadOnly', 'This campaign can no longer be edited — the schedule is shown read-only.')}
        </div>
      )}
      {alert && <div className={`cb-alert ${alert.kind}`}>{alert.text}</div>}

      <div className="se-layout">
        {/* ---- Spot palette ---- */}
        <aside className="se-palette">
          <h3 className="cb-section-title" style={{ marginBottom: 6 }}>
            {t('cbSpotsTitle', 'Audio spots')}
          </h3>
          <p className="se-hint">
            {editable
              ? t('seDragHint', 'Drag a spot onto a time slot — or tap a spot, then tap a slot.')
              : t('seViewOnlyHint', 'Times each spot airs on the selected station.')}
          </p>
          {spotsLoading ? (
            <div className="cb-empty">{t('cbLoadingSpots', 'Loading spots…')}</div>
          ) : spots.length === 0 ? (
            <div className="cb-empty">
              {t('seNoSpots', 'No spots uploaded yet.')}
              <div style={{ marginTop: 10 }}>
                <Link to={`/campagne/${campaignId}/builder`} className="cb-btn cb-btn-ghost">
                  {t('seUploadFirst', 'Upload spots')}
                </Link>
              </div>
            </div>
          ) : (
            spots.map((spot) => (
              <div
                key={spot.id}
                className={`se-spot ${selectedSpotId === spot.id ? 'armed' : ''} ${editable ? 'draggable' : ''}`}
                draggable={editable}
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', String(spot.id));
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() => editable && setSelectedSpotId((cur) => (cur === spot.id ? null : spot.id))}
              >
                <span className="se-spot-grip" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="8" cy="6" r="1.6"/><circle cx="8" cy="12" r="1.6"/><circle cx="8" cy="18" r="1.6"/><circle cx="16" cy="6" r="1.6"/><circle cx="16" cy="12" r="1.6"/><circle cx="16" cy="18" r="1.6"/></svg>
                </span>
                <span className="se-spot-body">
                  <span className="se-spot-name">{spot.name}</span>
                  <span className="se-spot-meta">
                    {spot.duration_seconds ? `${spot.duration_seconds}s · ` : ''}
                    {spotUsageCount(spot)} {t('cbTimesShort', 'times')}
                  </span>
                </span>
              </div>
            ))
          )}

          {editable && (
            <div className="se-windows">
              <span className="se-hint" style={{ margin: 0 }}>{t('seWindows', 'Upload window (min)')}</span>
              <div className="se-windows-row">
                <label>
                  − <input type="number" min={0} max={120} className="cb-input" value={windowBefore}
                    onChange={(e) => setWindowBefore(Number(e.target.value))} />
                </label>
                <label>
                  + <input type="number" min={0} max={120} className="cb-input" value={windowAfter}
                    onChange={(e) => setWindowAfter(Number(e.target.value))} />
                </label>
              </div>
            </div>
          )}
        </aside>

        {/* ---- Time slot board ---- */}
        <section className="se-board">
          <div className="se-board-head">
            <h3 className="cb-section-title" style={{ margin: 0 }}>
              {activeStation?.name ?? ''}
            </h3>
            {editable && (
              <form className="se-add-time" onSubmit={handleAddTime}>
                <input
                  type="time"
                  className="cb-input"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                />
                <button type="submit" className="cb-btn cb-btn-ghost" disabled={!newTime}>
                  + {t('seAddTime', 'Add time slot')}
                </button>
              </form>
            )}
          </div>

          {/* ---- Day switcher: base plan vs a specific day ---- */}
          {(() => {
            const periodStart = campaign.start_date?.slice(0, 10) ?? '';
            const periodEnd = campaign.end_date?.slice(0, 10) ?? '';
            const firstMonth = periodStart.slice(0, 7);
            const lastMonth = periodEnd.slice(0, 7);
            const todayMonth = new Date().toISOString().slice(0, 7);
            const clampMonth = (ym: string) =>
              ym < firstMonth ? firstMonth : ym > lastMonth ? lastMonth : ym;
            const shownMonth = clampMonth(viewMonth ?? selectedDate?.slice(0, 7) ?? todayMonth);

            const [year, month] = shownMonth.split('-').map(Number);
            const daysInMonth = new Date(year, month, 0).getDate();
            const days: string[] = [];
            for (let d = 1; d <= daysInMonth; d++) {
              const date = `${shownMonth}-${String(d).padStart(2, '0')}`;
              if (date >= periodStart && date <= periodEnd) days.push(date);
            }
            const customizedSet = new Set(customizedDates ?? []);

            return (
              <div className="se-daybar">
                <div className="se-daybar-top">
                  <button
                    type="button"
                    className={`se-day-chip ${!selectedDate ? 'active' : ''}`}
                    onClick={() => selectDate(null)}
                  >
                    {t('seBasePlan', 'Every day (base plan)')}
                  </button>
                  <div className="se-day-nav">
                    <button
                      type="button"
                      className="se-day-arrow"
                      disabled={shownMonth <= firstMonth}
                      onClick={() => setViewMonth(clampMonth(shiftMonth(shownMonth, -1)))}
                      aria-label={t('sePrevMonth', 'Previous month')}
                    >
                      ‹
                    </button>
                    <span className="se-month-label">{monthLabel(shownMonth, locale)}</span>
                    <button
                      type="button"
                      className="se-day-arrow"
                      disabled={shownMonth >= lastMonth}
                      onClick={() => setViewMonth(clampMonth(shiftMonth(shownMonth, 1)))}
                      aria-label={t('seNextMonth', 'Next month')}
                    >
                      ›
                    </button>
                  </div>
                  {customizedSet.size > 0 && (
                    <span className="se-customized-label">
                      {t('seCustomizedLegend', '• = customized day')}
                    </span>
                  )}
                </div>
                <div className="se-day-strip">
                  {days.map((date) => (
                    <button
                      key={date}
                      type="button"
                      className={`se-day-cell ${date === selectedDate ? 'active' : ''} ${
                        customizedSet.has(date) ? 'customized' : ''
                      }`}
                      onClick={() => selectDate(date === selectedDate ? null : date)}
                      title={dayFullLabel(date, locale)}
                    >
                      {dayChipLabel(date, locale)}
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          {selectedDate &&
            (stationSchedules.length === 0 ? (
              <div className="cb-alert info" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ flex: 1, minWidth: 220 }}>
                  {t('seDayFollowsBase', 'This date follows the base plan for this station. Adding times here creates a plan for this day only — the base stays unchanged.')}
                </span>
                {editable && (
                  <button
                    type="button"
                    className="cb-btn cb-btn-primary"
                    onClick={handleMaterialize}
                    disabled={materialize.isPending}
                  >
                    {materialize.isPending
                      ? t('cbCopying', 'Copying…')
                      : t('seMaterialize', 'Start this day from the base plan')}
                  </button>
                )}
              </div>
            ) : (
              <div className="se-day-note">
                {t('seDayEditingNote', 'Editing {{date}} only — the base plan is untouched.', {
                  date: dayFullLabel(selectedDate, locale),
                })}
              </div>
            ))}

          {slotRows.length === 0 ? (
            <div className="cb-empty">
              {t('seNoSlots', 'This station has no published program yet — add a time slot to get started.')}
            </div>
          ) : (
            <div className="se-slots">
              {slotRows.map((row) => {
                const slotSchedules = stationSchedules
                  .filter((s) => toShortTime(s.scheduled_time) === row.time)
                  .sort((a, b) => a.id - b.id);
                const slotGhosts = ghostSchedules
                  .filter((s) => toShortTime(s.scheduled_time) === row.time)
                  .sort((a, b) => a.id - b.id);
                const isTarget = editable && (dragOverTime === row.time || selectedSpotId != null);
                return (
                  <div
                    key={row.time}
                    className={`se-slot ${dragOverTime === row.time ? 'over' : ''} ${isTarget ? 'targetable' : ''}`}
                    onDragOver={(e) => {
                      if (!editable) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'copy';
                      setDragOverTime(row.time);
                    }}
                    onDragLeave={() => setDragOverTime((cur) => (cur === row.time ? null : cur))}
                    onDrop={(e) => handleDrop(e, row.time)}
                    onClick={() => handleSlotClick(row.time)}
                  >
                    <div className="se-slot-time">
                      <span className="se-slot-clock">{row.time}</span>
                      {row.label && <span className="se-slot-label">{row.label}</span>}
                      {!row.fromProgram && (
                        <span className="se-slot-custom">{t('seCustom', 'custom')}</span>
                      )}
                    </div>
                    <div className="se-slot-body">
                      {slotSchedules.length === 0 && slotGhosts.length > 0 ? (
                        slotGhosts.map((schedule) => (
                          <span
                            key={`ghost-${schedule.id}`}
                            className="se-chip ghost"
                            title={t('seGhostChip', 'From the base plan — customize this day to change it')}
                          >
                            {spotById.get(schedule.spot_id)?.name ?? `#${schedule.spot_id}`}
                          </span>
                        ))
                      ) : slotSchedules.length === 0 ? (
                        <span className="se-slot-placeholder">
                          {editable ? t('seDropHere', 'Drop a spot here') : '—'}
                        </span>
                      ) : (
                        slotSchedules.map((schedule) => (
                          <span key={schedule.id} className="se-chip">
                            {spotById.get(schedule.spot_id)?.name ?? `#${schedule.spot_id}`}
                            {editable && (
                              <button
                                type="button"
                                className="se-chip-x"
                                aria-label={t('cbRemove', 'Remove')}
                                disabled={removeSchedule.isPending}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeSchedule.mutate(schedule.id, {
                                    onError: (error) => setAlert({ kind: 'error', text: error.message }),
                                  });
                                }}
                              >
                                ×
                              </button>
                            )}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </Shell>
  );
};

export default ScheduleEditor;
