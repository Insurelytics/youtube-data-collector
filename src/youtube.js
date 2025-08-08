function ensureFetch() {
  if (typeof fetch !== 'undefined') return fetch;
  // Lazy import if running on older Node
  return (...args) => import('node-fetch').then(({ default: f }) => f(...args));
}

const doFetch = ensureFetch();

export async function getChannelByHandle({ apiKey, handle }) {
  const q = encodeURIComponent(handle);
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&maxResults=1&q=${q}&key=${apiKey}`;
  const res = await doFetch(url);
  if (!res.ok) throw new Error(`YouTube search failed: ${res.status}`);
  const data = await res.json();
  const item = data.items?.[0];
  if (!item) throw new Error(`Channel not found for handle ${handle}`);
  return {
    channelId: item.snippet?.channelId || item.id?.channelId,
    channelTitle: item.snippet?.channelTitle || handle,
  };
}

export async function listChannelVideoIdsSince({ apiKey, channelId, sinceIso }) {
  let pageToken = '';
  const ids = [];
  do {
    const params = new URLSearchParams({
      part: 'id',
      channelId,
      order: 'date',
      publishedAfter: sinceIso,
      type: 'video',
      maxResults: '50',
      key: apiKey,
    });
    if (pageToken) params.set('pageToken', pageToken);
    const url = `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;
    const res = await doFetch(url);
    if (!res.ok) throw new Error(`YouTube search (videos) failed: ${res.status}`);
    const data = await res.json();
    for (const it of data.items || []) {
      const vid = it.id?.videoId;
      if (vid) ids.push(vid);
    }
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return ids;
}

export async function getVideoDetails({ apiKey, videoIds }) {
  const chunks = [];
  for (let i = 0; i < videoIds.length; i += 50) chunks.push(videoIds.slice(i, i + 50));
  const results = [];
  for (const chunk of chunks) {
    const params = new URLSearchParams({
      part: 'snippet,contentDetails,statistics',
      id: chunk.join(','),
      maxResults: '50',
      key: apiKey,
    });
    const url = `https://www.googleapis.com/youtube/v3/videos?${params.toString()}`;
    const res = await doFetch(url);
    if (!res.ok) throw new Error(`YouTube videos failed: ${res.status}`);
    const data = await res.json();
    for (const it of data.items || []) {
      results.push(it);
    }
  }
  return results;
}

function parseISODurationToSeconds(iso) {
  if (!iso) return null;
  // PT#H#M#S
  const re = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
  const m = iso.match(re);
  if (!m) return null;
  const h = Number(m[1] || 0);
  const min = Number(m[2] || 0);
  const s = Number(m[3] || 0);
  return h * 3600 + min * 60 + s;
}

export async function syncChannelVideos({ apiKey, handle, sinceDays }) {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  const sinceIso = since.toISOString();
  const { channelId, channelTitle } = await getChannelByHandle({ apiKey, handle });
  const ids = await listChannelVideoIdsSince({ apiKey, channelId, sinceIso });
  if (ids.length === 0) return { channelId, channelTitle, videos: [] };
  const details = await getVideoDetails({ apiKey, videoIds: ids });
  const videos = details.map((d) => ({
    id: d.id,
    channelId,
    title: d.snippet?.title || '',
    description: d.snippet?.description || '',
    publishedAt: d.snippet?.publishedAt || null,
    durationSeconds: parseISODurationToSeconds(d.contentDetails?.duration),
    viewCount: d.statistics?.viewCount != null ? Number(d.statistics.viewCount) : null,
    likeCount: d.statistics?.likeCount != null ? Number(d.statistics.likeCount) : null,
    commentCount: d.statistics?.commentCount != null ? Number(d.statistics.commentCount) : null,
    tags: d.snippet?.tags || null,
    thumbnails: d.snippet?.thumbnails || null,
    raw: d,
  }));
  return { channelId, channelTitle, videos };
}


