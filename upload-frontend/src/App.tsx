import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import AppRoutes from './routes/AppRoutes';

const App: React.FC = () => (
  <BrowserRouter>
    <AppRoutes />
    <Toaster richColors position="top-right" />
  </BrowserRouter>
);

export default App;
