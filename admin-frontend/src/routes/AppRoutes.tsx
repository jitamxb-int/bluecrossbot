import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ROUTES } from './routePaths';
import DashboardPage from '../pages/Dashboard';
import Sessions from '../pages/Sessions';
import TranscriptPage from '../pages/TranscriptPage';
import FeedbackLogs from '../pages/FeedbackLogs';
// import ProductsPage       from '../pages/Products/ProductsPage';
// import ProductIngestPage  from '../pages/Products/ProductIngestPage';
// import VideosPage         from '../pages/Videos/VideosPage';
// import VideoIngestPage    from '../pages/Videos/VideoIngestPage';
// import ChatSessionsPage   from '../pages/Chat/ChatSessionsPage';
// import ChatTranscriptPage from '../pages/Chat/ChatTranscriptPage';
// import HealthPage         from '../pages/Health/HealthPage';
// import NotFoundPage       from '../pages/NotFound/NotFoundPage';

const AppRoutes: React.FC = () => (
  <Routes>
    <Route path="/" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
    <Route path={ROUTES.DASHBOARD} element={<DashboardPage />} />
    <Route path={ROUTES.SESSIONS} element={<Sessions />} />
    <Route path={ROUTES.TRANSCRIPT} element={<TranscriptPage />} />
    <Route path={ROUTES.FEEDBACK_LOGS} element={<FeedbackLogs />} />
    <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
    {/* <Route path={ROUTES.PRODUCTS}        element={<ProductsPage />} />
    <Route path={ROUTES.PRODUCT_INGEST}  element={<ProductIngestPage />} />
    <Route path={ROUTES.VIDEOS}          element={<VideosPage />} />
    <Route path={ROUTES.VIDEO_INGEST}    element={<VideoIngestPage />} />
    <Route path={ROUTES.CHAT_SESSIONS}   element={<ChatSessionsPage />} />
    <Route path={ROUTES.CHAT_TRANSCRIPT} element={<ChatTranscriptPage />} /> */}
    {/* <Route path={ROUTES.HEALTH}          element={<HealthPage />} /> */}
    {/* <Route path="*"                      element={<NotFoundPage />} /> */}
  </Routes>
);

export default AppRoutes;
