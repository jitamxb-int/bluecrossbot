import React from 'react';
import { Navigate } from 'react-router-dom';

interface PrivateRouteProps {
  children: React.ReactNode;
  isAuthenticated?: boolean;
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children, isAuthenticated = true }) => {
  // TODO: replace with real auth check from store
  if (!isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
};

export default PrivateRoute;
