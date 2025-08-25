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

  // Prepare Actor input to get profile details and posts
  const input = {
    "addParentData": false,
    "directUrls": [
      `https://www.instagram.com/${handle}/`
    ],
    "enhanceUserSearchWithFacebookPage": false,
    "isUserReelFeedURL": false,
    "isUserTaggedFeedURL": false,
    "onlyPostsNewerThan": sinceIsoDate,
    "resultsLimit": 10,
    "resultsType": "details",
    "searchLimit": 100
  };

  try {
    console.log('Starting Instagram scraper via Apify...');
    const run = await client.actor("shu8hvrXbJbY3Eb9W").call(input);
    console.log(`Apify run started: ${run.id}, status: ${run.status}`);

    console.log('Fetching results from dataset...');
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    
    console.log(`Found ${items.length} Instagram profile data items for ${handle}`);

    if (!items || items.length === 0) {
      throw new Error('No Instagram profile data found');
    }

    const profile = items[0];
    const posts = profile.latestPosts || [];

    // Channel data from profile
    const channelId = `ig_${handle}`;
    const channelTitle = profile.fullName || profile.username || handle;
    const subscriberCount = profile.followersCount || null;
    const thumbnailUrl = profile.profilePicUrlHD || profile.profilePicUrl || null;

    // Convert Instagram posts to our video format
    const reels = posts.map(post => ({
      id: `ig_${post.shortCode}`, // Prefix with 'ig_' to avoid conflicts with YouTube IDs
      channelId,
      title: post.caption || `Instagram post ${post.shortCode}`, // Instagram posts don't have separate titles
      description: post.caption || '',
      publishedAt: post.timestamp || new Date().toISOString(),
      durationSeconds: null, // Instagram doesn't provide video duration
      viewCount: post.videoViewCount || null, // Use videoViewCount from Apify
      likeCount: post.likesCount || null,
      commentCount: post.commentsCount || null,
      tags: post.hashtags || null,
      thumbnails: post.displayUrl ? { default: { url: post.displayUrl } } : null,
      raw: post,
      // Instagram-specific fields
      platform: 'instagram',
      shortCode: post.shortCode,
      displayUrl: post.displayUrl || null,
      videoUrl: post.videoUrl || null,
      dimensions: (post.dimensionsWidth && post.dimensionsHeight) ? { width: post.dimensionsWidth, height: post.dimensionsHeight } : null,
      mentions: post.mentions || null,
      images: post.images || null,
      type: post.type || null,
    }));

    console.log(`Converted ${reels.length} Instagram posts to reels format`);

    return {
      channelId,
      channelTitle,
      subscriberCount,
      thumbnailUrl,
      reels,
      profileData: {
        biography: profile.biography,
        postsCount: profile.postsCount,
        followsCount: profile.followsCount,
        verified: profile.verified,
        businessCategoryName: profile.businessCategoryName,
        externalUrls: profile.externalUrls
      }
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
    // Use 'details' resultsType to get profile information
    const input = {
      "addParentData": false,
      "directUrls": [
        `https://www.instagram.com/${handle}/`
      ],
      "enhanceUserSearchWithFacebookPage": false,
      "isUserReelFeedURL": false,
      "isUserTaggedFeedURL": false,
      "onlyPostsNewerThan": "2023-01-01",
      "resultsLimit": 10,
      "resultsType": "details",
      "searchLimit": 5
    };

    const run = await client.actor("shu8hvrXbJbY3Eb9W").call(input);
    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    if (!items || items.length === 0) {
      throw new Error('No profile data found');
    }

    const profile = items[0];

    // Return profile data mapped to our channel format
    return {
      channelId: `ig_${handle}`,
      channelTitle: profile.fullName || profile.username || handle,
      subscriberCount: profile.followersCount || null,
      thumbnailUrl: profile.profilePicUrlHD || profile.profilePicUrl || null,
      handle: profile.username || handle,
      biography: profile.biography || null,
      postsCount: profile.postsCount || null,
      followsCount: profile.followsCount || null,
      verified: profile.verified || false,
      businessCategoryName: profile.businessCategoryName || null,
      externalUrls: profile.externalUrls || [],
      profileData: {
        biography: profile.biography,
        postsCount: profile.postsCount,
        followsCount: profile.followsCount,
        verified: profile.verified,
        businessCategoryName: profile.businessCategoryName,
        externalUrls: profile.externalUrls
      },
      raw: profile
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
