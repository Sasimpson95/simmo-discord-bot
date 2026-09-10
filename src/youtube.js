const BASE = 'https://www.googleapis.com/youtube/v3';

async function yt(path, params, apiKey) {
  const url = new URL(`${BASE}/${path}`);
  for (const [key, value] of Object.entries({ ...params, key: apiKey })) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`YouTube API ${response.status}: ${body}`);
  }
  return response.json();
}

export async function resolveChannel(handle, apiKey) {
  const data = await yt('channels', {
    part: 'snippet,contentDetails',
    forHandle: handle
  }, apiKey);

  const channel = data.items?.[0];
  if (!channel) throw new Error(`Could not find YouTube channel for ${handle}`);

  return {
    channelId: channel.id,
    title: channel.snippet?.title ?? handle,
    uploadsPlaylistId: channel.contentDetails?.relatedPlaylists?.uploads
  };
}

export async function getLatestUpload(uploadsPlaylistId, apiKey) {
  const data = await yt('playlistItems', {
    part: 'snippet,contentDetails',
    playlistId: uploadsPlaylistId,
    maxResults: 1
  }, apiKey);

  const item = data.items?.[0];
  if (!item) return null;

  const videoId = item.contentDetails?.videoId ?? item.snippet?.resourceId?.videoId;
  return {
    videoId,
    title: item.snippet?.title ?? 'New YouTube video',
    publishedAt: item.contentDetails?.videoPublishedAt ?? item.snippet?.publishedAt,
    thumbnail: item.snippet?.thumbnails?.maxres?.url ?? item.snippet?.thumbnails?.high?.url ?? null,
    url: `https://www.youtube.com/watch?v=${videoId}`
  };
}

export async function getCurrentLive(channelId, apiKey) {
  const data = await yt('search', {
    part: 'snippet',
    channelId,
    eventType: 'live',
    type: 'video',
    maxResults: 1
  }, apiKey);

  const item = data.items?.[0];
  if (!item) return null;

  const videoId = item.id?.videoId;
  return {
    videoId,
    title: item.snippet?.title ?? 'Live now',
    thumbnail: item.snippet?.thumbnails?.high?.url ?? null,
    url: `https://www.youtube.com/watch?v=${videoId}`
  };
}
