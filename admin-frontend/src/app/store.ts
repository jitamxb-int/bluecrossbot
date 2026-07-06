import { configureStore } from '@reduxjs/toolkit';
import chatReducer from '../features/slices/chatSlice';
import feedbackReducer from '../features/slices/feedbackSlice';
import productsReducer from '../features/slices/productsSlice';
import videosReducer from '../features/slices/videosSlice';
import ingestionReducer from '../features/slices/ingestionSlice';
import healthReducer from '../features/slices/healthSlice';
import sessionConfigReducer from '../features/slices/sessionConfigSlice';
import authReducer from '../features/slices/authSlice';

export const store = configureStore({
  reducer: {
    chat: chatReducer,
    feedback: feedbackReducer,
    products: productsReducer,
    videos: videosReducer,
    ingestion: ingestionReducer,
    health: healthReducer,
    sessionConfig: sessionConfigReducer,
    auth: authReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
