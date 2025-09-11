import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
import { isChannelAlreadyTracked } from '../database/index.js';

dotenv.config();

// Initialize the ApifyClient with API token from .env
const client = new ApifyClient({
  token: process.env.APIFY_API_KEY,
});


export async function findChannelsBySearchTerm(searchTerm, channelsPerSearch = 3) {
  console.log(`Searching for Instagram channel URLs using term: "${searchTerm}"`);

  if (!process.env.APIFY_API_KEY) {
    throw new Error('APIFY_API_KEY environment variable is required for channel finding');
  }

  // Prepare Actor input for user search
  const input = {
    "addParentData": false,
    "enhanceUserSearchWithFacebookPage": false,
    "isUserReelFeedURL": false,
    "isUserTaggedFeedURL": false,
    "onlyPostsNewerThan": "2025-09-01",
    "search": searchTerm,
    "searchLimit": channelsPerSearch,
    "searchType": "user"
  };

  try {
    console.log(`Starting Instagram user search via Apify for: ${searchTerm}`);
    const run = await client.actor("shu8hvrXbJbY3Eb9W").call(input);
    console.log(`Apify run started: ${run.id}, status: ${run.status}`);

    console.log('Fetching results from dataset...');
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    
    console.log(`Found ${items.length} potential channels for search term: ${searchTerm}`);

    const foundUrls = [];
    const processedUsernames = new Set();

    for (const item of items) {
      let username = null;
      let instagramUrl = null;

      // Handle error items (private/empty accounts) - they provide URLs
      if (item.error && item.url) {
        instagramUrl = item.url;
        const urlMatch = item.url.match(/instagram\.com\/([^\/\?]+)/);
        if (urlMatch && urlMatch[1]) {
          username = urlMatch[1];
          console.log(`Found channel URL from error item: ${instagramUrl}`);
        }
      } else if (item.ownerUsername) {
        // Extract username from post data
        username = item.ownerUsername;
        instagramUrl = `https://www.instagram.com/${username}/`;
        console.log(`Found channel URL from post data: ${instagramUrl}`);
      }

      if (!username || !instagramUrl) {
        console.log('Skipping item without valid username/URL');
        continue;
      }

      // Skip duplicates
      if (processedUsernames.has(username)) {
        continue;
      }
      processedUsernames.add(username);

      // Check if channel is already tracked
      if (isChannelAlreadyTracked(username)) {
        console.log(`Channel ${username} already exists, skipping`);
        continue;
      }

      foundUrls.push({
        url: instagramUrl,
        username: username,
        searchTerm: searchTerm
      });
    }

    console.log(`Found ${foundUrls.length} unique Instagram URLs for search term: ${searchTerm}`);
    return foundUrls;

  } catch (error) {
    console.error(`Error finding channels for search term "${searchTerm}":`, error);
    throw error;
  }
}

export async function findChannelsForAllSearchTerms(searchTerms, channelsPerSearch = 3) {
  console.log(`Finding channel URLs for ${searchTerms.length} search terms`);
  
  const allFoundUrls = [];
  let successCount = 0;
  let errorCount = 0;

  for (const searchTerm of searchTerms) {
    try {
      const foundUrls = await findChannelsBySearchTerm(searchTerm, channelsPerSearch);
      allFoundUrls.push(...foundUrls);
      successCount++;
      
      // Add a small delay between searches to be respectful to the API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`Failed to process search term "${searchTerm}":`, error.message);
      errorCount++;
    }
  }

  console.log(`Channel URL finding completed. Processed ${successCount} search terms successfully, ${errorCount} failed. Found ${allFoundUrls.length} total URLs.`);
  
  return {
    foundUrls: allFoundUrls,
    successCount,
    errorCount,
    totalSearchTerms: searchTerms.length
  };
}
