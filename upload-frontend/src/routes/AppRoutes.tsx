import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ROUTES } from './routePaths';
import UploadPage from '../pages/UploadPage';
import ManagePage from '../pages/ManagePage';

const AppRoutes: React.FC = () => (
  <Routes>
    <Route path="/" element={<Navigate to={ROUTES.UPLOAD} replace />} />
    <Route path={ROUTES.UPLOAD} element={<UploadPage />} />
    <Route path={ROUTES.MANAGE} element={<ManagePage />} />
    <Route path="*" element={<Navigate to={ROUTES.UPLOAD} replace />} />
  </Routes>
);

export default AppRoutes;
