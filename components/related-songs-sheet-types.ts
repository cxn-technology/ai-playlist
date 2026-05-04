/**
 * Track shape for {@link RelatedSongsSheet} (seed row, related API rows, or mapped browse/search tracks).
 */
export type RelatedSheetTrack = {
  id: string;
  name: string;
  artist: string;
  trackUrl?: string | null;
  bpm?: number | null;
  energy?: string;
  energyValue?: number;
  mood_sad?: number;
  mood_happy?: number;
};
