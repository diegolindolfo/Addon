/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface StreamItem {
  id: string;
  name: string;
  type: 'movie' | 'series';
  url?: string;         // Direct video links (.mp4, .m3u8, etc.)
  ytId?: string;        // YouTube Video ID (trailers or custom YouTube streams)
  infoHash?: string;    // Torrent info hash (for peer-to-peer playing)
  imdbId?: string;      // Association with specific IMDb ID (e.g. tt1234567 or tt1234567:1:1)
  description: string;
  poster?: string;      // Image link
  genre: string;        // Category / Genre
  createdAt: string;
}

export interface UserConfig {
  uid: string;
  customManifestName: string;
  customDescription: string;
  customHostUrl?: string;
  streams: StreamItem[];
  updatedAt: string;
}

export interface PlaybackLog {
  id: string;
  uid: string;
  streamId: string;
  streamName: string;
  streamType: 'movie' | 'series';
  playedAt: string;
}
