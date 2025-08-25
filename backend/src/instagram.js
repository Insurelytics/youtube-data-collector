import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';

dotenv.config();

// Initialize the ApifyClient with API token from .env
const client = new ApifyClient({
  token: process.env.APIFY_API_KEY,
});

// Instagram sync function using Apify API
export async function syncChannelReels({ handle, sinceDays }) {
  console.log(`Syncing Instagram reels for ${handle} since ${sinceDays} days`);

  if (!process.env.APIFY_API_KEY) {
    throw new Error('APIFY_API_KEY environment variable is required for Instagram functionality');
  }

  // Calculate since date
  const sinceDate = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  const sinceIsoDate = sinceDate.toISOString().split('T')[0]; // YYYY-MM-DD format

  // Prepare Actor input matching your working prototype
  const input = {
    "addParentData": false,
    "directUrls": [
      `https://www.instagram.com/${handle}/`
    ],
    "enhanceUserSearchWithFacebookPage": false,
    "isUserReelFeedURL": false,
    "isUserTaggedFeedURL": false,
    "onlyPostsNewerThan": sinceIsoDate,
    "resultsLimit": 5, // Limited for testing to save time and money
    "resultsType": "stories", // Using same as working prototype
    "searchLimit": 1,
    "searchType": "hashtag"
  };

  try {
    console.log('Starting Instagram scraper via Apify...');
    const run = await client.actor("shu8hvrXbJbY3Eb9W").call(input);
    console.log(`Apify run started: ${run.id}, status: ${run.status}`);

    console.log('Fetching results from dataset...');
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    
    console.log(`Found ${items.length} Instagram posts for ${handle}`);

    // Channel data
    const channelId = `ig_${handle}`;
    const channelTitle = handle; // Instagram doesn't provide display name in post data
    const subscriberCount = null; // Instagram doesn't expose follower counts publicly
    const thumbnailUrl = null; // Would need separate API call to get profile picture

    // Convert Instagram posts to our video format
    const reels = items.map(item => ({
      id: `ig_${item.shortCode}`, // Prefix with 'ig_' to avoid conflicts with YouTube IDs
      channelId,
      title: item.caption || `Instagram post ${item.shortCode}`, // Instagram posts don't have separate titles
      description: item.caption || '',
      publishedAt: item.timestamp || new Date(item.takenAtTimestamp * 1000).toISOString(),
      durationSeconds: null, // Instagram doesn't provide video duration
      viewCount: item.videoViewCount || null, // Use videoViewCount from Apify
      likeCount: item.likesCount || null,
      commentCount: item.commentsCount || null,
      tags: item.hashtags || null,
      thumbnails: item.displayUrl ? { default: { url: item.displayUrl } } : null,
      raw: item,
      // Instagram-specific fields
      platform: 'instagram',
      shortCode: item.shortCode,
      displayUrl: item.displayUrl || null,
      videoUrl: item.videoUrl || null,
      dimensions: (item.width && item.height) ? { width: item.width, height: item.height } : null,
      mentions: item.mentions || null,
      takenAtTimestamp: item.takenAtTimestamp || null,
    }));

    console.log(`Converted ${reels.length} Instagram posts to reels format`);

    return {
      channelId,
      channelTitle,
      subscriberCount,
      thumbnailUrl,
      reels
    };

  } catch (error) {
    console.error('Error syncing Instagram reels:', error);
    throw new Error(`Instagram sync failed for ${handle}: ${error.message}`);
  }
}

// Function for getting channel info by handle
export async function getChannelByHandle({ handle }) {
  console.log(`Getting Instagram channel info for ${handle}`);

  if (!process.env.APIFY_API_KEY) {
    throw new Error('APIFY_API_KEY environment variable is required for Instagram functionality');
  }

  try {
    // For now, we'll use a simple approach similar to the sync function
    // to get basic channel info. In the future, this could be optimized
    // to use a more specific API endpoint for profile information only.
    const input = {
      "addParentData": false,
      "directUrls": [
        `https://www.instagram.com/${handle}/`
      ],
      "enhanceUserSearchWithFacebookPage": false,
      "isUserReelFeedURL": false,
      "isUserTaggedFeedURL": false,
      "resultsLimit": 1, // Just need one post to get channel info
      "resultsType": "stories", // Using same as working prototype
      "searchLimit": 1,
      "searchType": "hashtag"
    };

    const run = await client.actor("shu8hvrXbJbY3Eb9W").call(input);
    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    // Return basic channel data
    return {
      channelId: `ig_${handle}`,
      channelTitle: handle, // Instagram API doesn't provide display name in this endpoint
      subscriberCount: null, // Instagram doesn't expose follower counts publicly via API
      thumbnailUrl: null // Would need separate API call to get profile picture
    };

  } catch (error) {
    console.error(`Error getting Instagram channel info for ${handle}:`, error);
    // Return fallback data if API fails
    return {
      channelId: `ig_${handle}`,
      channelTitle: handle,
      subscriberCount: null,
      thumbnailUrl: null
    };
  }
}
