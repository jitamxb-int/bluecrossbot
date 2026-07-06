import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { isAuthenticated } from '../features/storage/authStorage';
import { ROUTES } from './routePaths';

// Gate the Admin Portal: only render nested routes when a valid access token is
// stored, otherwise send the user to the login page. Re-evaluated on every
// navigation, so Back after logout redirects to /login.
const ProtectedRoute: React.FC = () =>
  isAuthenticated() ? <Outlet /> : <Navigate to={ROUTES.LOGIN} replace />;

export default ProtectedRoute;
