// suggest channels to scrape (Instagram-only, channel→channels)
import { upsertSuggestedChannel } from '../database/index.js';
import dotenv from 'dotenv';
import { getDatabase } from '../database/connection.js';
import { researchSimilarInstagramChannels } from './openAIResearch.js';
import { getChannelByHandle } from './instagram.js';

// Load environment variables
dotenv.config();

const CHANNELS_TO_FIND = 5;

function extractInstagramUsername(link) {
  if (!link) return null;
  try {
    // Normalize and extract handle from URLs like https://instagram.com/handle or https://www.instagram.com/handle/
    const match = String(link).match(/instagram\.com\/(?!p\/)([A-Za-z0-9._]+)/i);
    return match && match[1] ? match[1].toLowerCase() : null;
  } catch {
    return null;
  }
}

export async function suggestChannels(channelId) {
  const db = getDatabase();

  // Fetch 3 similar channels via AI research with simple retries
  const maxRetries = Number(process.env.AI_SUGGESTIONS_MAX_RETRIES || 2);
  let result = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      result = await researchSimilarInstagramChannels(channelId, CHANNELS_TO_FIND);
      break;
    } catch (e) {
      if (attempt === maxRetries) throw e;
      const backoff = 500 * Math.pow(2, attempt);
      await new Promise(r => setTimeout(r, backoff));
    }
  }
  const channels = Array.isArray(result?.channels) ? result.channels : [];

  let stored = 0;
  let duplicates = 0;
  let failures = 0;

  for (const ch of channels) {
    const username = extractInstagramUsername(ch.link);
    if (!username) {
      failures++;
      continue;
    }

    // Idempotency: skip if platform+username already suggested
    const exists = db.prepare(
      `SELECT 1 FROM suggested_channels WHERE platform = ? AND username = ? LIMIT 1`
    ).get('instagram', username);

    if (exists) {
      duplicates++;
      continue;
    }

    try {
      // Enrich with live profile data to align with old flow (ensures followersCount, etc.)
      const profile = await getChannelByHandle({ handle: username });

      const suggestedChannelData = {
        id: `ig_${username}`,
        username,
        fullName: profile?.channelTitle || ch.name || null,
        followersCount: profile?.subscriberCount ?? null,
        followsCount: profile?.profileData?.followsCount ?? null,
        postsCount: profile?.profileData?.postsCount ?? null,
        verified: profile?.profileData?.verified ? 1 : 0,
        isPrivate: 0,
        biography: profile?.profileData?.biography || ch.bio || null,
        externalUrl: Array.isArray(profile?.profileData?.externalUrls) && profile.profileData.externalUrls.length > 0
          ? profile.profileData.externalUrls[0].url
          : (ch.link || null),
        profilePicUrl: profile?.thumbnailUrl || null,
        localProfilePicPath: profile?.thumbnailUrl?.startsWith('/api/images/') ? profile.thumbnailUrl : null,
        searchTerm: `src:${channelId}`,
        platform: 'instagram',
        categoryId: null
      };

      upsertSuggestedChannel(suggestedChannelData);
      stored++;
      // brief pause to be polite to upstream API
      await new Promise(r => setTimeout(r, 250));
    } catch (e) {
      console.error('Failed to upsert suggested channel', username, e?.message || e);
      failures++;
    }
  }

  return {
    urlDiscovery: null,
    channelAnalysis: { stored, duplicates, failures, total: channels.length },
    totalFoundUrls: channels.length,
    totalStoredChannels: stored
  };
}