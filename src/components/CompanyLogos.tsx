import React from 'react';

// Company logo components using actual logo files from /public/logos
export const CampostLogo: React.FC = () => (
  <img src="/logos/Picture1.png" alt="CAMPOST" />
);

export const OrangeLogo: React.FC = () => (
  <img src="/logos/Picture2.png" alt="Orange" />
);

export const CMSLogo: React.FC = () => (
  <img src="/logos/Picture3.png" alt="CMS" />
);

export const PevCameroonLogo: React.FC = () => (
  <img src="/logos/Picture4.png" alt="PEV Cameroon" />
);

export const SocieteGeneraleLogo: React.FC = () => (
  <img src="/logos/Picture5.png" alt="Société Générale" />
);

export const DangoteLogo: React.FC = () => (
  <img src="/logos/Picture6.png" alt="Dangote" />
);

export const AffirmativeLogo: React.FC = () => (
  <img src="/logos/Picture7.png" alt="Affirmative Action" />
);

export const CareProgramLogo: React.FC = () => (
  <img src="/logos/picture8.jpeg" alt="Care and Health Program" />
);

export const SocieteGenerale2Logo: React.FC = () => (
  <img src="/logos/Picture8.png" alt="Société Générale" />
);

const CompanyLogos: React.FC = () => {
  return (
    <>
      <CampostLogo />
      <OrangeLogo />
      <CMSLogo />
      <PevCameroonLogo />
      <SocieteGeneraleLogo />
      <DangoteLogo />
      <AffirmativeLogo />
      <CareProgramLogo />
    </>
  );
};

export default CompanyLogos;
