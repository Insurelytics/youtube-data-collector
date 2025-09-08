import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
import { getLastPublishedDate } from '../database/index.js';
import { downloadChannelThumbnail } from '../video_processing/image-utils.js';

dotenv.config();

const MAX_VIDEOS_PER_SYNC = parseInt(process.env.MAX_VIDEOS_PER_SYNC) || 25;

const engagementLookbackWindow = 1; // days

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

  // Get the last published date for this channel, or use sinceDays as fallback
  const channelId = `ig_${handle}`;
  const lastPublishedDate = getLastPublishedDate(channelId);
  
  let sinceIsoDate;
  if (lastPublishedDate) {
    // Use the last published date as starting point with a small buffer to avoid missing same-day posts
    const lastDate = new Date(lastPublishedDate);
    // Subtract 1 second to ensure we don't miss posts published at the exact same time
    const bufferedDate = new Date(lastDate.getTime() - 1000);
    sinceIsoDate = bufferedDate.toISOString().split('T')[0]; // YYYY-MM-DD format
    console.log(`Using last published date ${sinceIsoDate} (with buffer) for Instagram channel ${handle}`);
  } else {
    // Fallback to sinceDays if no previous posts exist
    const sinceDate = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
    sinceIsoDate = sinceDate.toISOString().split('T')[0]; // YYYY-MM-DD format
    console.log(`No previous posts found, using ${sinceDays} days ago (${sinceIsoDate}) for Instagram channel ${handle}`);
  }

  // Move sinceIsoDate back by engagementLookbackWindow days to capture engagement data
  const adjustedSinceDate = new Date(sinceIsoDate);
  adjustedSinceDate.setDate(adjustedSinceDate.getDate() - engagementLookbackWindow);
  sinceIsoDate = adjustedSinceDate.toISOString().split('T')[0]; // YYYY-MM-DD format
  console.log(`Adjusted date back by ${engagementLookbackWindow} days to ${sinceIsoDate} for engagement tracking`);

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
    "resultsLimit": MAX_VIDEOS_PER_SYNC,
    "resultsType": "stories",
    "searchLimit": MAX_VIDEOS_PER_SYNC
  };

  try {
    console.log('Starting Instagram scraper via Apify...');
    const run = await client.actor("shu8hvrXbJbY3Eb9W").call(input);
    console.log(`Apify run started: ${run.id}, status: ${run.status}`);

    console.log('Fetching results from dataset...');
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    
    console.log(`Found ${items.length} Instagram posts for ${handle}`);

    // Channel data - will use basic info since items are posts, not profile data
    const channelId = `ig_${handle}`;
    const channelTitle = items.length > 0 ? (items[0].ownerFullName || items[0].ownerUsername || handle) : handle;
    const subscriberCount = null; // Instagram doesn't expose follower counts publicly
    
    // Try to get and download profile picture if available from posts
    let thumbnailUrl = null;
    const firstItem = items[0];
    const ownerProfilePicUrl = firstItem?.ownerProfilePicUrl || firstItem?.profilePicUrl || null;
    
    if (ownerProfilePicUrl) {
      console.log(`Downloading channel thumbnail for ${handle} from post data...`);
      const localThumbnailUrl = await downloadChannelThumbnail(ownerProfilePicUrl, channelId);
      thumbnailUrl = localThumbnailUrl || ownerProfilePicUrl;
      if (localThumbnailUrl) {
        console.log(`Successfully downloaded channel thumbnail for ${handle}`);
      }
    }

    // Convert Instagram posts to our video format - items are already the posts
    const reels = items.map(item => ({
      id: `ig_${item.shortCode}`, // Prefix with 'ig_' to avoid conflicts with YouTube IDs
      channelId,
      title: item.caption || 'Unnamed reel', // Instagram posts don't have separate titles
      description: item.caption || '',
      publishedAt: item.timestamp ? new Date(item.timestamp).toISOString() : new Date().toISOString(),
      durationSeconds: item.videoDuration || null,
      viewCount: item.videoViewCount || item.videoPlayCount || null,
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
      dimensions: (item.dimensionsHeight && item.dimensionsWidth) ? { width: item.dimensionsWidth, height: item.dimensionsHeight } : null,
      mentions: item.mentions || null,
      images: item.images || null,
      type: item.type || null,
      // Additional fields from the API response
      url: item.url || null,
      firstComment: item.firstComment || null,
      latestComments: item.latestComments || null,
      ownerId: item.ownerId || null,
      ownerUsername: item.ownerUsername || null,
      ownerFullName: item.ownerFullName || null,
      productType: item.productType || null,
      isSponsored: item.isSponsored || false,
      musicInfo: item.musicInfo || null,
      isCommentsDisabled: item.isCommentsDisabled || false,
      childPosts: item.childPosts || null,
      alt: item.alt || null
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
    const channelId = `ig_${handle}`;
    const originalThumbnailUrl = profile.profilePicUrlHD || profile.profilePicUrl || null;

    // Download channel thumbnail if available
    let localThumbnailUrl = null;
    if (originalThumbnailUrl) {
      console.log(`Downloading channel thumbnail for ${handle}...`);
      localThumbnailUrl = await downloadChannelThumbnail(originalThumbnailUrl, channelId);
      if (localThumbnailUrl) {
        console.log(`Successfully downloaded channel thumbnail for ${handle}`);
      }
    }

    // Return profile data mapped to our channel format
    return {
      channelId,
      channelTitle: profile.fullName || profile.username || handle,
      subscriberCount: profile.followersCount || null,
      thumbnailUrl: localThumbnailUrl || originalThumbnailUrl,
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
