import type { RootState } from '../../app/store';

export const selectVideos           = (state: RootState) => state.videos.items;
export const selectLastVideoIngest  = (state: RootState) => state.videos.lastIngestResult;
export const selectVideosStatus     = (state: RootState) => state.videos.status;
export const selectVideosError      = (state: RootState) => state.videos.error;
