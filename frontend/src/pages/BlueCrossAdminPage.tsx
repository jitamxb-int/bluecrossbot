import React from 'react';
import { useNavigate } from 'react-router-dom';
import AdminDashboard from '../components/AdminDashboard';

export default function BlueCrossAdminPage({ authUser, onSignOut }: { authUser: any; onSignOut: () => void }) {
  const navigate = useNavigate();

  return (
    <AdminDashboard
      authUser={authUser}
      onClose={() => {}}
      onLaunchChat={() => navigate('/blue_cross/chat')}
    />
  );
}