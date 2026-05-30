import React from 'react';
import { Routes, Route } from 'react-router-dom';
import CampagneList from './CampagneList';
import CampagneDetail from './CampaignDetail';
import StationDetail from './StationDetail';

const CampagneRouter: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<CampagneList />} />
      <Route path=":id" element={<CampagneDetail />} />
      <Route path=":campaignId/station/:stationId" element={<StationDetail />} />
    </Routes>
  );
};

export default CampagneRouter; 