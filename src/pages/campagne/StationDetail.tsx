import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../../utils/apiClient';
import Header from '../../components/Header';
import { useAuth } from '../../context/AuthContext';
// Assuming CampaignDetail.css or Campagne.css might have relevant styles
import './CampaignDetail.css'; // Or './Campagne.css' or a new './StationDetail.css'
import { getLogoUrl } from './CampagneList';

// --- Interfaces ---
interface AudioFile {
  id: number;
  file_path: string; // Assuming this will be a URL or path to construct a URL
  original_name: string;
  duration_seconds?: number;
  // Add other relevant fields from your API if needed
}

interface RecordData {
  id: number;
  campaign_id: number;
  radio_station_id: number;
  submission_date: string;
  start_date: string;
  end_date: string;
  status: string; 
  validated_by_user_id?: number;
  validation_date?: string;
  AudioFiles?: AudioFile[]; // Assuming API nests audio files under a record
  // Add other relevant fields from your API if needed
}

// Simplified interface for campaign, only taking what's needed for display
interface CampaignInfo {
  id: number;
  name: string;
}

// Simplified interface for station, only taking what's needed for display
interface StationInfo {
  id: number;
  name: string;
  logo?: string;
}

// --- API Fetching Functions ---
const fetchStationRecords = async (campaignId: string, stationId: string): Promise<RecordData[]> => {
  return apiClient<RecordData[]>(`/records?campaign_id=${campaignId}&radio_station_id=${stationId}`, { method: 'GET' });
};

const fetchCampaignInfo = async (campaignId: string): Promise<CampaignInfo> => {
  // Using /my-campaigns/:id as it's specific to the client's view
  return apiClient<CampaignInfo>(`/my-campaigns/${campaignId}`, { method: 'GET' });
};

const fetchStationInfo = async (stationId: string): Promise<StationInfo> => {
  // Assuming a general /radio-stations/:id endpoint exists
  return apiClient<StationInfo>(`/radio-stations/${stationId}`, { method: 'GET' }); 
};

const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

const statusColors: Record<string, string> = {
  validated: '#43aa8b',
  rejected: '#ff595e',
  pending: '#ffbe0b',
  default: '#6e42d3',
};

const StationDetail: React.FC = () => {
  const { t } = useTranslation();
  const { campaignId, stationId } = useParams<{ campaignId: string; stationId: string }>();
  const { isLoggedIn } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { 
    data: records, 
    isLoading: isLoadingRecords, 
    isError: isErrorRecords, 
    error: errorRecords 
  } = useQuery<RecordData[], Error>({
    queryKey: ['stationRecords', campaignId, stationId],
    queryFn: () => fetchStationRecords(campaignId!, stationId!),
    enabled: isLoggedIn && !!campaignId && !!stationId,
  });

  const { 
    data: campaignInfo, 
    isLoading: isLoadingCampaign, 
  } = useQuery<CampaignInfo, Error>({
    queryKey: ['campaignInfoForStationDetail', campaignId],
    queryFn: () => fetchCampaignInfo(campaignId!),
    enabled: isLoggedIn && !!campaignId,
  });

  const { 
    data: stationInfo, 
    isLoading: isLoadingStation, 
  } = useQuery<StationInfo, Error>({
    queryKey: ['stationInfoForStationDetail', stationId],
    queryFn: () => fetchStationInfo(stationId!),
    enabled: isLoggedIn && !!stationId,
  });

  if (!isLoggedIn) return <Link to="/" />; // Or Navigate component
  if (!campaignId || !stationId) return <Link to="/campagne" />; // Or Navigate

  const isLoading = isLoadingRecords || isLoadingCampaign || isLoadingStation;

  // Filter records by status or search
  const filteredRecords = records?.filter(record => {
    const matchesStatus = statusFilter ? record.status === statusFilter : true;
    const matchesSearch = search
      ? formatDate(record.submission_date).toLowerCase().includes(search.toLowerCase()) ||
        String(record.id).includes(search)
      : true;
    return matchesStatus && matchesSearch;
  }) || [];

  if (isLoading) {
    return (
      <div className="page-container">
        <Header />
        <main className="main-content campaign-detail-page">
          <div className="loading">{t('loadingRecords')}</div>
        </main>
      </div>
    );
  }

  // Basic error handling (can be more granular)
  if (isErrorRecords) {
    return (
      <div className="page-container">
        <Header />
        <main className="main-content campaign-detail-page">
          <div className="error">
            {t('errorFetchingRecords')}: {errorRecords?.message || t('errorGeneric')}
          </div>
          <Link to={`/campagne/${campaignId}`} className="back-link">{t('backToCampaignDetails')}</Link>
        </main>
      </div>
    );
  }
  
  // TODO: Add error handling for campaignInfo and stationInfo fetches if needed

  return (
    <div className="page-container" style={{ background: '#f6f7fb', minHeight: '100vh' }}>
      <Header />
      <main className="main-content campaign-detail-page">
        <div className="campaign-detail-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 30, borderBottom: '1.5px solid #eee', paddingBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {/* Station logo if available */}
            {stationInfo?.logo ? (
              <img src={getLogoUrl(stationInfo.logo)} alt={stationInfo.name} style={{ width: 48, height: 48, borderRadius: 12, marginRight: 18, objectFit: 'contain', background: '#ede9fe' }} />
            ) : (
              <div style={{ width: 48, height: 48, borderRadius: 12, marginRight: 18, background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-label="radio logo">
                  <rect width="32" height="32" rx="8" fill="#c7bfff"/>
                  <path d="M8 24V14a2 2 0 012-2h12a2 2 0 012 2v10" stroke="#6e42d3" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="16" cy="19" r="3" stroke="#6e42d3" strokeWidth="2"/>
                </svg>
              </div>
            )}
            <h1 style={{ fontSize: 28, fontWeight: 700, color: '#232946', margin: 0 }}>
              {t('recordsFor', 'Records for')} {stationInfo?.name || t('station', 'Station')} {t('in', 'in')} {campaignInfo?.name || t('campaign', 'Campaign')}
            </h1>
          </div>
          <Link to={`/campagne/${campaignId}`} className="back-link top-back-link" style={{ background: '#1976d2', color: '#fff', borderRadius: 8, padding: '10px 22px', fontWeight: 600, fontSize: 16, border: 'none', textDecoration: 'none', boxShadow: '0 2px 8px rgba(80,80,180,0.08)' }}>
            ← {t('backToCampaignDetails', 'Back to Campaign Details')}
          </Link>
        </div>

        {/* Record count and filter/search bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 600, fontSize: 18, color: '#232946' }}>
            {t('totalRecords', 'Total records')}: {filteredRecords.length}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              type="text"
              placeholder={t('searchPlaceholder', 'Search by date or ID...')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ border: '1px solid #ddd', borderRadius: 8, padding: '7px 12px', fontSize: 15, minWidth: 180 }}
              aria-label={t('search', 'Search')}
            />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{ border: '1px solid #ddd', borderRadius: 8, padding: '7px 12px', fontSize: 15 }}
              aria-label={t('status', 'Status')}
            >
              <option value="">{t('allStatuses', 'All statuses')}</option>
              <option value="validated">{t('validated', 'Validated')}</option>
              <option value="rejected">{t('rejected', 'Rejected')}</option>
              <option value="pending">{t('pending', 'Pending')}</option>
            </select>
          </div>
        </div>

        {filteredRecords.length > 0 ? (
          <div className="records-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '2rem', marginTop: 10 }}>
            {filteredRecords.map(record => (
              <div
                key={record.id}
                className="record-card"
                style={{
                  background: '#fff',
                  borderRadius: 16,
                  boxShadow: '0 4px 24px rgba(80, 80, 180, 0.08)',
                  padding: '2rem 1.5rem 1.5rem 1.5rem',
                  minHeight: 160,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  border: '1.5px solid #f0f0f0',
                  transition: 'box-shadow 0.18s, border 0.18s, transform 0.18s',
                  position: 'relative',
                  cursor: 'pointer',
                }}
                onMouseOver={e => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 32px rgba(80, 80, 180, 0.16), 0 2px 8px rgba(80,80,180,0.08)';
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px) scale(1.02)';
                  (e.currentTarget as HTMLDivElement).style.border = '1.5px solid #6e42d3';
                }}
                onMouseOut={e => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 24px rgba(80, 80, 180, 0.08)';
                  (e.currentTarget as HTMLDivElement).style.transform = 'none';
                  (e.currentTarget as HTMLDivElement).style.border = '1.5px solid #f0f0f0';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', width: '100%', marginBottom: 10 }}>
                  <h3 style={{ fontSize: 20, fontWeight: 700, color: '#232946', margin: 0, marginRight: 10 }}>{t('record', 'Record')} #{record.id}</h3>
                  <span
                    style={{
                      background: statusColors[record.status] || statusColors.default,
                      color: '#fff',
                      borderRadius: 8,
                      padding: '3px 12px',
                      fontWeight: 600,
                      fontSize: 13,
                      marginLeft: 6,
                      textTransform: 'capitalize',
                    }}
                  >
                    {t(record.status, record.status)}
                  </span>
                </div>
                <p style={{ fontSize: 15, color: '#444', marginBottom: 8 }}><strong>{t('submissionDate', 'Submission Date')}:</strong> {formatDate(record.submission_date)}</p>
                <p style={{ fontSize: 15, color: '#444', marginBottom: 8 }}><strong>{t('broadcastPeriod', 'Broadcast Period')}:</strong> {formatDate(record.start_date)} - {formatDate(record.end_date)}</p>
                {record.AudioFiles && record.AudioFiles.length > 0 ? (
                  <div className="audio-files-section" style={{ marginTop: 10, width: '100%' }}>
                    <h4 style={{ fontSize: 16, fontWeight: 600, color: '#34495e', margin: 0, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ verticalAlign: 'middle' }} aria-label="audio icon"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1-3.29-2.5-4.03v8.06c1.5-.74 2.5-2.26 2.5-4.03zM14 3.23v2.06c3.39.49 6 3.39 6 6.71s-2.61 6.22-6 6.71v2.06c4.5-.52 8-4.31 8-8.77s-3.5-8.25-8-8.77z" fill="#6e42d3"/></svg>
                      {t('audioFiles', 'Audio Files')}
                    </h4>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {record.AudioFiles.map(file => (
                        <li key={file.id} style={{ marginBottom: 10 }}>
                          <span
                            style={{ fontWeight: 500, color: '#1976d2', marginRight: 8, maxWidth: 180, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'middle' }}
                            title={file.original_name}
                          >
                            {file.original_name}
                          </span>
                          {/* <audio controls src={`https://api.proxycom.net${file.file_path}`}></audio> */}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div style={{ marginTop: 10, color: '#888', fontStyle: 'italic', fontSize: 14 }}>{t('noAudioFiles', 'No audio files for this record.')}</div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p>{t('noRecordsFound', 'No records found')}</p>
        )}
      </main>
    </div>
  );
};

export default StationDetail; 