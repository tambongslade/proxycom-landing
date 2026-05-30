import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Header from '../../components/Header';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../utils/apiClient';
import './Campagne.css';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import frLocale from '@fullcalendar/core/locales/fr';
import esLocale from '@fullcalendar/core/locales/es';
import enLocale from '@fullcalendar/core/locales/en-gb';
// import '@fullcalendar/daygrid/index.css';

// Helper function to format logo URL
export const getLogoUrl = (logoPath: string | null | undefined): string => {
  if (!logoPath) return '';
  if (logoPath.startsWith('http')) return logoPath;
  // Remove leading slash if present and ensure proper URL format
  const cleanPath = logoPath.startsWith('/') ? logoPath.slice(1) : logoPath;
  console.log("cleanPath: ", cleanPath);
  return `https://api.proxycom.net/uploads/${cleanPath}`;
};

// Define the Campaign interface (based on previous mock data and potential API structure)
// Adjust this based on the actual data returned by your API endpoint
interface Campaign {
  id: number;
  name: string;
  label: string; // Added based on api.http campaign create/update
  start_date: string; 
  end_date: string;
  // We might not get stations/logs counts directly, adjust as needed
  // stations?: number; 
  // logs?: number;
  // You might get associated radio_station_ids or full station objects
  radio_station_ids?: number[];
  // Add other fields like contract info if needed
  contract_file_path?: string | null;
  contract_file_original_name?: string | null;
}

// Define the expected response type for campaigns, which might be paginated
type CampaignsApiResponse = 
  | { rows: Campaign[]; count: number; totalPages: number; currentPage: number } 
  | Campaign[] 
  | Record<string, unknown>; // Fallback for other unexpected object structures

// Function to fetch campaigns (used by useQuery)
const fetchClientCampaigns = async (): Promise<Campaign[]> => {
  // Use the correct endpoint for fetching client's own campaigns
  const response = await apiClient<CampaignsApiResponse>(
    '/client-access/my-campaigns', 
    { method: 'GET' }
  ); 
  
  // Check if the response is an object and has a 'rows' property that is an array
  if (response && typeof response === 'object' && !Array.isArray(response) && Array.isArray((response as { rows?: Campaign[] }).rows)) {
    return (response as { rows: Campaign[] }).rows; // Return the actual array of campaigns
  }
  
  // If the response is already an array
  if (Array.isArray(response)) {
    return response;
  }

  // If it's neither (e.g., an empty object {} from API for no data, or null from apiClient for 204/non-JSON),
  // return an empty array to satisfy the Campaign[] promise and prevent .filter errors.
  console.warn('[CampagneList] fetchClientCampaigns received unexpected response structure or null/empty, returning []. Response:', response);
  return []; 
};

const CAMPAIGN_COLORS = [
  '#6e42d3', '#ff7f50', '#2ec4b6', '#ffbe0b', '#3a86ff', '#8338ec', '#ff006e', '#fb5607', '#00b4d8', '#43aa8b', '#f15bb5', '#9b5de5', '#00bbf9', '#fee440', '#ff595e', '#1982c4', '#6a4c93', '#ffca3a', '#8ac926', '#1982c4'
];

const CampagneList: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { client, isLoggedIn } = useAuth(); // Removed unused token
  const calLocale = i18n.language?.startsWith('fr')
    ? frLocale
    : i18n.language?.startsWith('es')
    ? esLocale
    : enLocale;
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<number[]>([]);
  const navigate = useNavigate();

  // Specify unknown for the error type initially, then check its instance
  const { data: campaigns, isLoading, isError, error } = useQuery<Campaign[], unknown>({
    queryKey: ['myClientCampaigns', client?.id], 
    queryFn: fetchClientCampaigns,
    enabled: isLoggedIn && !!client, 
    staleTime: 1000 * 60 * 5, 
  });
  console.log('client data from useQuery:', client); // Debugging line

  console.log('Campaigns data from useQuery:', campaigns); // Debugging line

  // Handle filtering based on fetched data
  const filteredCampaigns = campaigns?.filter(
    campaign => campaign.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) ?? []; // Default to empty array if campaigns is undefined

  // Redirect if not logged in (or if client data is somehow missing after login)
  if (!isLoggedIn || !client) { 
    return <Navigate to="/" />;
  }

  // Display loading state
  if (isLoading) {
    return (
      <div className="page-container">
        <Header />
        <main className="main-content">
          <div className="loading">Loading campaigns...</div>
        </main>
      </div>
    );
  }

  // Display error state with type check
  if (isError) {
    let errorMessage = t('errorFetchingCampaignsGeneric'); // Default error message
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return (
      <div className="page-container">
        <Header />
        <main className="main-content">
          <div className="error">{t('errorFetchingCampaigns')}: {errorMessage}</div>
        </main>
      </div>
    );
  }

  // Assign a color to each campaign by index
  const campaignsWithColors = (filteredCampaigns || []).map((c, i) => ({
    ...c,
    color: CAMPAIGN_COLORS[i % CAMPAIGN_COLORS.length],
  }));

  // If no filter, show all. If filter, show only selected.
  const visibleCampaigns =
    selectedCampaignIds.length === 0
      ? campaignsWithColors
      : campaignsWithColors.filter(c => selectedCampaignIds.includes(c.id));

  return (
    <div className="page-container">
      <Header />
      <main className="main-content">
        <section className="campagne-section">
          <div className="section-header">
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 32,
              marginBottom: 16,
              flexWrap: 'wrap',
            }}>
              {client?.logo && (
                <img
                  src={getLogoUrl(client.logo)}
                  alt={client.company_name || client.name}
                  style={{
                    width: 70,
                    height: 70,
                    objectFit: 'cover',
                  }}
                />
              )}
              <div style={{ textAlign: 'left' }}>
                <h1 style={{ margin: 0 }}>{t('campaignTitle')}</h1>
                {client && (
                  <h2 className="welcome-message" style={{ margin: 0 }}>
                    {t('welcomeMessage')}, {client.company_name || client.name}!
                  </h2>
                )}
              </div>
            </div>
          </div>

          {/* Campaign filter UI */}
          {campaignsWithColors.length > 0 && (
            <div
              style={{
                marginBottom: '1.5rem',
                display: 'flex',
                flexWrap: 'nowrap',
                gap: '0.75rem',
                alignItems: 'center',
                overflowX: 'auto',
                whiteSpace: 'nowrap',
                paddingBottom: 8,
              }}
            >
              <span style={{ fontWeight: 600, marginRight: 10, fontSize: 17, color: '#333', flex: '0 0 auto' }}>
                {t('Filtrer par campagne') || 'Filtrer par campagne'}:
              </span>
              {campaignsWithColors.map(campaign => {
                const isSelected = selectedCampaignIds.length === 0 || selectedCampaignIds.includes(campaign.id);
                return (
                  <button
                    key={campaign.id}
                    type="button"
                    onClick={() => {
                      if (selectedCampaignIds.length === 0) {
                        setSelectedCampaignIds([campaign.id]);
                      } else if (selectedCampaignIds.includes(campaign.id)) {
                        const newIds = selectedCampaignIds.filter(id => id !== campaign.id);
                        setSelectedCampaignIds(newIds);
                      } else {
                        setSelectedCampaignIds([...selectedCampaignIds, campaign.id]);
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      cursor: 'pointer',
                      background: isSelected ? campaign.color : '#f6f6fa',
                      border: `1.5px solid ${campaign.color}`,
                      borderRadius: 999,
                      padding: '2px 8px 2px 4px',
                      fontWeight: isSelected ? 600 : 400,
                      fontSize: 13,
                      color: isSelected ? '#fff' : '#232946',
                      boxShadow: isSelected ? '0 2px 8px rgba(80,80,180,0.13)' : 'none',
                      transition: 'background 0.2s, box-shadow 0.2s',
                      outline: 'none',
                      borderColor: isSelected ? campaign.color : '#bbb',
                      minWidth: 90,
                      flex: '0 0 auto',
                    }}
                  >
                    <span style={{
                      width: 12,
                      height: 12,
                      background: isSelected ? '#fff' : campaign.color,
                      borderRadius: 4,
                      display: 'inline-block',
                      marginRight: 2,
                      border: isSelected ? '1.5px solid #fff' : '1.5px solid #fff',
                      boxShadow: '0 1px 3px rgba(80,80,180,0.10)'
                    }}></span>
                    <span style={{ fontSize: 13 }}>{campaign.name}</span>
                  </button>
                );
              })}
              <button
                style={{
                  marginLeft: 18,
                  fontSize: 15,
                  background: '#f6f6fa',
                  border: '1.5px solid #bbb',
                  borderRadius: 999,
                  padding: '5px 18px',
                  fontWeight: 600,
                  color: '#232946',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(80,80,180,0.07)',
                  transition: 'background 0.2s, border 0.2s',
                  opacity: selectedCampaignIds.length === 0 ? 0.7 : 1,
                  flex: '0 0 auto',
                }}
                onClick={() => setSelectedCampaignIds([])}
                disabled={selectedCampaignIds.length === 0}
              >
                {t('Tout afficher') || 'Tout afficher'}
              </button>
            </div>
          )}

          {/* FullCalendar integration */}
          {visibleCampaigns.length > 0 && (
            <div className="cal-card">
              <div className="cal-toolbar-row">
                <div className="cal-heading">
                  <span className="cal-heading-icon" aria-hidden="true">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  </span>
                  <div>
                    <h3 className="cal-heading-title">{t('calendarTitle', 'Campaign Calendar')}</h3>
                    <span className="cal-heading-sub">{visibleCampaigns.length} {t('campaignTitle', 'Campaigns')}</span>
                  </div>
                </div>
                <div className="cal-search">
                  <input
                    type="text"
                    placeholder={t('searchPlaceholder')}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                  <span className="cal-search-icon">
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  </span>
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
                  events={visibleCampaigns.map(campaign => ({
                    id: String(campaign.id),
                    title: campaign.name,
                    start: campaign.start_date,
                    end: new Date(new Date(campaign.end_date).getTime() + 24*60*60*1000).toISOString().slice(0,10),
                    allDay: true,
                    color: campaign.color,
                  }))}
                  headerToolbar={{
                    left: 'title',
                    center: '',
                    right: 'prev,next today'
                  }}
                  eventClick={(info) => {
                    info.jsEvent.preventDefault();
                    if (info.event.id) {
                      navigate(`/campagne/${info.event.id}`);
                    }
                  }}
                />
              </div>
            </div>
          )}
          
          {!isLoading && !isError && visibleCampaigns.length > 0 ? (
            <div className="campaigns-grid">
              {visibleCampaigns.map(campaign => (
                <Link to={`/campagne/${campaign.id}`} key={campaign.id} className="campaign-card">
                  <div className="campaign-card-modern">
                    <div className="campaign-card-title">{campaign.name}</div>
                    <div className="campaign-card-dates-row">
                      <span className="date-label">du&nbsp;</span>
                      <span className="date-value">{new Date(campaign.start_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                      <span className="date-label">&nbsp;au&nbsp;</span>
                      <span className="date-value">{new Date(campaign.end_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (!isLoading && !isError && (
            <div className="empty-state">
              <p>{searchQuery ? t('noCampaignsMatch') : t('campaignEmpty')}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
};

export default CampagneList; 