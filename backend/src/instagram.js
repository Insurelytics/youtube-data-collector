function ensureFetch() {
  if (typeof fetch !== 'undefined') return fetch;
  // Lazy import if running on older Node
  return (...args) => import('node-fetch').then(({ default: f }) => f(...args));
}

const doFetch = ensureFetch();

// Placeholder Instagram sync function
// TODO: Implement actual Instagram API integration
export async function syncChannelReels({ handle, sinceDays }) {
  console.log(`TODO: Implement Instagram reels sync for ${handle}`);

  // Return placeholder data structure matching YouTube format
  const channelId = `ig_${handle}`;
  const channelTitle = handle; // This would be the actual profile name from Instagram
  const subscriberCount = null; // Instagram doesn't expose follower counts publicly via API
  const thumbnailUrl = null; // This would be the profile picture URL

  // For now, return empty reels array
  // In the future, this would fetch posts/reels from Instagram
  const reels = [];

  return {
    channelId,
    channelTitle,
    subscriberCount,
    thumbnailUrl,
    reels
  };
}

// Placeholder function for getting channel info by handle
export async function getChannelByHandle({ handle }) {
  console.log(`TODO: Implement Instagram channel lookup for ${handle}`);

  // Return placeholder data
  return {
    channelId: `ig_${handle}`,
    channelTitle: handle,
    subscriberCount: null,
    thumbnailUrl: null
  };
}
