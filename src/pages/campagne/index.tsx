import React from 'react';
import { Routes, Route } from 'react-router-dom';
import CampagneList from './CampagneList';
import CampagneDetail from './CampaignDetail';
import StationDetail from './StationDetail';
import NewCampaign from './NewCampaign';
import CampaignBuilder from './CampaignBuilder';
import ScheduleEditor from './ScheduleEditor';

const CampagneRouter: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<CampagneList />} />
      <Route path="new" element={<NewCampaign />} />
      <Route path=":id" element={<CampagneDetail />} />
      <Route path=":id/builder" element={<CampaignBuilder />} />
      <Route path=":id/schedule" element={<ScheduleEditor />} />
      <Route path=":campaignId/station/:stationId" element={<StationDetail />} />
    </Routes>
  );
};

export default CampagneRouter;
