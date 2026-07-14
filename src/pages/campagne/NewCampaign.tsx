import React, { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import Header from '../../components/Header';
import { useAuth } from '../../context/AuthContext';
import {
  createCampaign,
  fetchRadioStations,
  type Campaign,
  type RadioStation,
} from './builderApi';
import { getLogoUrl } from './CampagneList';
import './CampaignBuilder.css';

const NewCampaign: React.FC = () => {
  const { t } = useTranslation();
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [label, setLabel] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedStationIds, setSelectedStationIds] = useState<number[]>([]);
  const [stationSearch, setStationSearch] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const { data: stations, isLoading: stationsLoading, isError: stationsError, error: stationsErrorObj } = useQuery<
    RadioStation[],
    Error
  >({
    queryKey: ['radioStations'],
    queryFn: fetchRadioStations,
    enabled: isLoggedIn,
    staleTime: 1000 * 60 * 10,
  });

  const createMutation = useMutation<Campaign, Error, void>({
    mutationFn: () =>
      createCampaign({
        name: name.trim(),
        label: label.trim() || undefined,
        start_date: startDate,
        end_date: endDate,
        radio_station_ids: selectedStationIds,
      }),
    onSuccess: (campaign) => {
      queryClient.invalidateQueries({ queryKey: ['myClientCampaigns'] });
      navigate(`/campagne/${campaign.id}/builder`);
    },
    onError: (error) => setFormError(error.message),
  });

  const stationGroups = useMemo(() => {
    const query = stationSearch.toLowerCase();
    const filtered = (stations ?? []).filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        (s.region ?? '').toLowerCase().includes(query) ||
        (s.division ?? '').toLowerCase().includes(query)
    );
    const byRegion = new Map<string, RadioStation[]>();
    filtered.forEach((s) => {
      const region = s.region?.trim() || '—';
      if (!byRegion.has(region)) byRegion.set(region, []);
      byRegion.get(region)!.push(s);
    });
    return [...byRegion.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([region, list]) => ({
        region,
        stations: list.sort((a, b) => a.name.localeCompare(b.name)),
      }));
  }, [stations, stationSearch]);
  const hasStations = stationGroups.length > 0;

  if (!isLoggedIn) return <Navigate to="/" />;

  const toggleStation = (id: number) => {
    setSelectedStationIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!name.trim()) return setFormError(t('cbErrorNameRequired', 'Please enter a campaign name.'));
    if (!startDate || !endDate)
      return setFormError(t('cbErrorDatesRequired', 'Please choose start and end dates.'));
    if (endDate < startDate)
      return setFormError(t('cbErrorDateOrder', 'The end date must be after the start date.'));
    if (selectedStationIds.length === 0)
      return setFormError(t('cbErrorStationsRequired', 'Please select at least one radio station.'));
    createMutation.mutate();
  };

  return (
    <div className="page-container">
      <Header />
      <main className="main-content">
        <div className="cb-shell">
          <div className="cb-hero">
            <div className="cb-hero-top">
              <div>
                <div className="cb-eyebrow">{t('cbNewCampaignEyebrow', 'Campaign builder')}</div>
                <h1>{t('cbNewCampaignTitle', 'Create a new campaign')}</h1>
                <p style={{ margin: 0, opacity: 0.9, fontSize: 14.5 }}>
                  {t(
                    'cbNewCampaignSub',
                    'It will be saved as a draft — you can add spots and broadcast times before submitting it for approval.'
                  )}
                </p>
              </div>
              <Link to="/campagne" className="cb-btn cb-btn-ghost on-dark">
                ← {t('backToCampaigns', 'Back to campaigns')}
              </Link>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="cb-card">
              <h3 className="cb-section-title">{t('cbCampaignInfo', 'Campaign information')}</h3>
              <div className="cb-form-grid">
                <div className="cb-field" style={{ gridColumn: '1 / -1' }}>
                  <label htmlFor="cb-name">{t('cbCampaignName', 'Campaign name')} *</label>
                  <input
                    id="cb-name"
                    className="cb-input"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('cbCampaignNamePh', 'e.g. Back to School 2026')}
                    maxLength={120}
                  />
                </div>
                <div className="cb-field" style={{ gridColumn: '1 / -1' }}>
                  <label htmlFor="cb-label">{t('cbCampaignLabel', 'Label (optional)')}</label>
                  <input
                    id="cb-label"
                    className="cb-input"
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    maxLength={120}
                  />
                </div>
                <div className="cb-field">
                  <label htmlFor="cb-start">{t('cbStartDate', 'Start date')} *</label>
                  <input
                    id="cb-start"
                    className="cb-input"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="cb-field">
                  <label htmlFor="cb-end">{t('cbEndDate', 'End date')} *</label>
                  <input
                    id="cb-end"
                    className="cb-input"
                    type="date"
                    value={endDate}
                    min={startDate || undefined}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="cb-card">
              <h3 className="cb-section-title">
                {t('cbSelectStations', 'Radio stations')}
                <span
                  className="cb-badge active"
                  style={{ textTransform: 'none', letterSpacing: 0 }}
                >
                  {selectedStationIds.length} {t('cbSelected', 'selected')}
                </span>
              </h3>
              <p className="cb-section-sub">
                {t('cbSelectStationsSub', 'Choose the stations that will broadcast this campaign.')}
              </p>

              {stationsLoading && (
                <div className="cb-empty">{t('cbLoadingStations', 'Loading radio stations…')}</div>
              )}
              {stationsError && (
                <div className="cb-alert error">
                  {t('cbErrorLoadingStations', 'Could not load the list of radio stations.')}
                  {stationsErrorObj?.message && (
                    <div style={{ marginTop: 4, fontSize: 13 }}>{stationsErrorObj.message}</div>
                  )}
                </div>
              )}

              {!stationsLoading && !stationsError && (
                <>
                  <div className="cb-field" style={{ marginBottom: 12, maxWidth: 320 }}>
                    <input
                      className="cb-input"
                      type="text"
                      value={stationSearch}
                      onChange={(e) => setStationSearch(e.target.value)}
                      placeholder={t('cbSearchStations', 'Search stations…')}
                    />
                  </div>
                  {!hasStations ? (
                    <div className="cb-empty">{t('cbNoStationsFound', 'No stations found.')}</div>
                  ) : (
                    <div className="cb-station-regions">
                      {stationGroups.map((group) => {
                        const groupIds = group.stations.map((s) => s.id);
                        const allSelected = groupIds.every((id) => selectedStationIds.includes(id));
                        return (
                          <div key={group.region}>
                            <div className="cb-region-head">
                              <span className="cb-region-name">{group.region}</span>
                              <button
                                type="button"
                                className="cb-region-toggle"
                                onClick={() =>
                                  setSelectedStationIds((prev) =>
                                    allSelected
                                      ? prev.filter((id) => !groupIds.includes(id))
                                      : [...new Set([...prev, ...groupIds])]
                                  )
                                }
                              >
                                {allSelected
                                  ? t('cbUnselectRegion', 'Unselect all')
                                  : t('cbSelectRegion', 'Select all')}
                              </button>
                            </div>
                            <div className="cb-station-grid">
                              {group.stations.map((station) => {
                                const selected = selectedStationIds.includes(station.id);
                                return (
                                  <button
                                    type="button"
                                    key={station.id}
                                    className={`cb-station-option ${selected ? 'selected' : ''}`}
                                    onClick={() => toggleStation(station.id)}
                                  >
                                    <span className="cb-check">{selected ? '✓' : ''}</span>
                                    {station.logo && (
                                      <img
                                        src={getLogoUrl(station.logo)}
                                        alt=""
                                        style={{ width: 26, height: 26, borderRadius: 6, objectFit: 'cover' }}
                                        onError={(e) => (e.currentTarget.style.display = 'none')}
                                      />
                                    )}
                                    <span style={{ minWidth: 0 }}>
                                      <span className="cb-station-name-line">{station.name}</span>
                                      {(station.frequency || station.division) && (
                                        <span className="cb-station-sub-line">
                                          {[station.frequency, station.division].filter(Boolean).join(' · ')}
                                        </span>
                                      )}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>

            {formError && <div className="cb-alert error">{formError}</div>}

            <div className="cb-actions-row">
              <button type="submit" className="cb-btn cb-btn-primary" disabled={createMutation.isPending}>
                {createMutation.isPending
                  ? t('cbCreating', 'Creating…')
                  : t('cbCreateCampaign', 'Create draft campaign')}
              </button>
              <Link to="/campagne" className="cb-btn cb-btn-ghost">
                {t('cancel', 'Cancel')}
              </Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};

export default NewCampaign;
