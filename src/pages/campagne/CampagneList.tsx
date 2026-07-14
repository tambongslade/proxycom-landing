import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Header from '../../components/Header';
import { useAuth } from '../../context/AuthContext';
import { fetchMyCampaigns, isCampaignEditable, type Campaign } from './builderApi';
import './Campagne.css';
import './CampaignBuilder.css';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import frLocale from '@fullcalendar/core/locales/fr';
import esLocale from '@fullcalendar/core/locales/es';
import enLocale from '@fullcalendar/core/locales/en-gb';

// Helper function to format logo URL
export const getLogoUrl = (logoPath: string | null | undefined): string => {
  if (!logoPath) return '';
  if (logoPath.startsWith('http')) return logoPath;
  const cleanPath = logoPath.startsWith('/') ? logoPath.slice(1) : logoPath;
  return `https://api.proxycom.net/uploads/${cleanPath}`;
};

const CAMPAIGN_COLORS = [
  '#6e42d3', '#ff7f50', '#2ec4b6', '#ffbe0b', '#3a86ff', '#8338ec', '#ff006e', '#fb5607',
  '#00b4d8', '#43aa8b', '#f15bb5', '#9b5de5', '#00bbf9', '#ff595e', '#1982c4', '#6a4c93',
];

type StatusFilter = 'all' | 'draft' | 'pending_approval' | 'active' | 'rejected';

const CampagneList: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { client, isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const calLocale = i18n.language?.startsWith('fr')
    ? frLocale
    : i18n.language?.startsWith('es')
    ? esLocale
    : enLocale;

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const { data: campaigns, isLoading, isError, error } = useQuery<Campaign[], Error>({
    queryKey: ['myClientCampaigns'],
    queryFn: fetchMyCampaigns,
    enabled: isLoggedIn,
    staleTime: 1000 * 60 * 5,
  });

  const statusMeta: Record<string, { label: string; className: string }> = useMemo(
    () => ({
      draft: { label: t('statusDraft', 'Draft'), className: 'draft' },
      pending_approval: { label: t('statusPendingApproval', 'Pending approval'), className: 'pending_approval' },
      active: { label: t('statusActive', 'Active'), className: 'active' },
      rejected: { label: t('statusRejected', 'Rejected'), className: 'rejected' },
    }),
    [t]
  );

  const counts = useMemo(() => {
    const c = { all: campaigns?.length ?? 0, draft: 0, pending_approval: 0, active: 0, rejected: 0 };
    (campaigns ?? []).forEach((campaign) => {
      if (campaign.status in c) c[campaign.status as keyof typeof c]++;
    });
    return c;
  }, [campaigns]);

  const visibleCampaigns = useMemo(() => {
    return (campaigns ?? [])
      .filter((campaign) => statusFilter === 'all' || campaign.status === statusFilter)
      .filter((campaign) => campaign.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .map((campaign, i) => ({ ...campaign, color: CAMPAIGN_COLORS[i % CAMPAIGN_COLORS.length] }));
  }, [campaigns, statusFilter, searchQuery]);

  if (!isLoggedIn || !client) {
    return <Navigate to="/" />;
  }

  const filterChips: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: t('filterAll', 'All') },
    { key: 'active', label: statusMeta.active.label },
    { key: 'pending_approval', label: statusMeta.pending_approval.label },
    { key: 'draft', label: statusMeta.draft.label },
    { key: 'rejected', label: statusMeta.rejected.label },
  ];

  return (
    <div className="page-container">
      <Header />
      <main className="main-content">
        {/* ---- Hero ---- */}
        <div className="cl-hero">
          <div className="cl-hero-left">
            {client?.logo && (
              <img
                className="cl-hero-logo"
                src={getLogoUrl(client.logo)}
                alt={client.company_name || client.name}
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />
            )}
            <div>
              <div className="cl-hero-eyebrow">{t('campaignTitle', 'My Campaigns')}</div>
              <h1 className="cl-hero-title">
                {t('welcomeMessage', 'Welcome')}, {client.company_name || client.name}
              </h1>
              <p className="cl-hero-sub">
                {t('clHeroSub', 'Create campaigns, upload your spots and follow their broadcast.')}
              </p>
            </div>
          </div>
          <Link to="/campagne/new" className="cb-btn cb-btn-primary cl-new-btn">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            {t('clNewCampaign', 'New campaign')}
          </Link>
        </div>

        {isLoading && <div className="loading">{t('loadingCampaigns', 'Loading campaigns...')}</div>}

        {isError && (
          <div className="cb-alert error">
            {t('errorFetchingCampaigns', 'Error fetching campaigns')}: {error?.message ?? ''}
          </div>
        )}

        {!isLoading && !isError && (
          <>
            {/* ---- Stats ---- */}
            <div className="cl-stats">
              <div className="cl-stat">
                <div className="cl-stat-value">{counts.all}</div>
                <div className="cl-stat-label">{t('clStatTotal', 'Campaigns')}</div>
              </div>
              <div className="cl-stat">
                <div className="cl-stat-value" style={{ color: '#16a34a' }}>{counts.active}</div>
                <div className="cl-stat-label">{statusMeta.active.label}</div>
              </div>
              <div className="cl-stat">
                <div className="cl-stat-value" style={{ color: '#d97706' }}>{counts.pending_approval}</div>
                <div className="cl-stat-label">{statusMeta.pending_approval.label}</div>
              </div>
              <div className="cl-stat">
                <div className="cl-stat-value" style={{ color: '#64748b' }}>{counts.draft}</div>
                <div className="cl-stat-label">{statusMeta.draft.label}</div>
              </div>
            </div>

            {/* ---- Toolbar: search + status filter ---- */}
            <div className="cl-toolbar">
              <div className="cal-search">
                <input
                  type="text"
                  placeholder={t('searchPlaceholder', 'Search campaigns…')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <span className="cal-search-icon">
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                </span>
              </div>
              <div className="cl-filter-chips">
                {filterChips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    className={`cl-filter-chip ${statusFilter === chip.key ? 'active' : ''}`}
                    onClick={() => setStatusFilter(chip.key)}
                  >
                    {chip.label}
                    {chip.key !== 'all' && counts[chip.key] > 0 && <span className="cl-chip-count">{counts[chip.key]}</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* ---- Campaign cards ---- */}
            {visibleCampaigns.length === 0 ? (
              <div className="cl-empty">
                <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#b9a3ea" strokeWidth="1.5"><path d="M4 11a9 9 0 019 9M4 4a16 16 0 0116 16"/><circle cx="5" cy="19" r="1"/></svg>
                <p>{searchQuery || statusFilter !== 'all' ? t('noCampaignsMatch', 'No campaigns match your filters.') : t('campaignEmpty', 'You have no campaigns yet.')}</p>
                {!searchQuery && statusFilter === 'all' && (
                  <Link to="/campagne/new" className="cb-btn cb-btn-primary">
                    {t('clCreateFirst', 'Create your first campaign')}
                  </Link>
                )}
              </div>
            ) : (
              <div className="cl-grid">
                {visibleCampaigns.map((campaign) => {
                  const editable = isCampaignEditable(campaign.status);
                  const meta = statusMeta[campaign.status] ?? { label: campaign.status, className: 'draft' };
                  const target = editable ? `/campagne/${campaign.id}/builder` : `/campagne/${campaign.id}`;
                  return (
                    <Link to={target} key={campaign.id} className="cl-card">
                      <div className="cl-card-top">
                        <span className="cl-card-dot" style={{ background: campaign.color }} />
                        <span className={`cb-badge ${meta.className}`}><i />{meta.label}</span>
                      </div>
                      <div className="cl-card-title">{campaign.name}</div>
                      {campaign.label && <div className="cl-card-label">{campaign.label}</div>}
                      <div className="cl-card-dates">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        {new Date(campaign.start_date).toLocaleDateString(i18n.language, { day: '2-digit', month: 'short', year: 'numeric' })}
                        {' → '}
                        {new Date(campaign.end_date).toLocaleDateString(i18n.language, { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                      {(campaign.radioStations?.length ?? 0) > 0 && (
                        <div className="cl-card-stations">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 11a9 9 0 019 9M4 4a16 16 0 0116 16"/><circle cx="5" cy="19" r="1"/></svg>
                          {campaign.radioStations!.length} {t('kpiStations', 'stations')}
                        </div>
                      )}
                      {campaign.status === 'rejected' && campaign.review_comment && (
                        <div className="cl-card-rejection">“{campaign.review_comment}”</div>
                      )}
                      <div className="cl-card-cta">
                        {editable ? t('clContinueEditing', 'Continue editing') : t('clViewReport', 'View report')}
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* ---- Calendar ---- */}
            {visibleCampaigns.length > 0 && (
              <div className="cal-card">
                <div className="cal-toolbar-row">
                  <div className="cal-heading">
                    <span className="cal-heading-icon" aria-hidden="true">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    </span>
                    <div>
                      <h3 className="cal-heading-title">{t('calendarTitle', 'Campaign Calendar')}</h3>
                      <span className="cal-heading-sub">
                        {visibleCampaigns.length} {t('campaignTitle', 'Campaigns')}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="cal-body">
                  <FullCalendar
                    plugins={[dayGridPlugin, interactionPlugin]}
                    initialView="dayGridMonth"
                    locale={calLocale}
                    height="auto"
                    fixedWeekCount={false}
                    dayMaxEvents={3}
                    displayEventTime={false}
                    eventDisplay="block"
                    events={visibleCampaigns.map((campaign) => ({
                      id: String(campaign.id),
                      title: campaign.name,
                      start: campaign.start_date,
                      end: new Date(new Date(campaign.end_date).getTime() + 24 * 60 * 60 * 1000)
                        .toISOString()
                        .slice(0, 10),
                      allDay: true,
                      color: campaign.color,
                    }))}
                    headerToolbar={{ left: 'title', center: '', right: 'prev,next today' }}
                    eventClick={(info) => {
                      info.jsEvent.preventDefault();
                      if (info.event.id) navigate(`/campagne/${info.event.id}`);
                    }}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default CampagneList;
