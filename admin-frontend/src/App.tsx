import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './app/store';
import AppRoutes from './routes/AppRoutes';
import { Toaster } from './components/ui/sonner';

const App: React.FC = () => (
  <Provider store={store}>
    <BrowserRouter>
      <AppRoutes />
      <Toaster />
    </BrowserRouter>
  </Provider>
);

export default App;
