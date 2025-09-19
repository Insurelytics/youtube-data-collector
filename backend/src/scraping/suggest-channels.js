// suggest channels to scrape (supports ig only for now)
import { getTopicGraph } from '../topics/topic-math.js';
import { findChannelsForAllSearchTerms } from './channel-finder.js';
import { getChannelByHandle } from './instagram.js';
import { upsertSuggestedChannel } from '../database/index.js';
import Instructor from "@instructor-ai/instructor";
import OpenAI from "openai"
import { z } from "zod"
import dotenv from 'dotenv'
import { getDatabase } from '../database/connection.js';

// this is the final step in the initial scrape process, and will search for channels that focus on similar topics to the ones in the database

const TOPICS_TOFETCH = 50; // To generally increase the number of searches increase this number.  
// This is not a 1:1 relationship but having more topics will trend towards more categories being found.

const MAX_SEARCHES_PER_CATEGORY = 3; // Increasing this number increases cost and time taken.
const CHANNELS_PER_SEARCH = 3; // Increasing this number increases cost and time taken.
const TOTAL_MAX_SEARCHES = 20; // A failsafe to prevent huge numbers of searches.

// Load environment variables
dotenv.config()

const oai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? undefined
})

const client = Instructor({
  client: oai,
  mode: "FUNCTIONS"
})

const SearchTermsSchema = z.object({
    // searchFocus: z.array(z.string()).describe("The focus of each search. (e.g. ['For the first search, the focus is on topics like...', 'For the second search, I'll focus on topics like...', ...])"),
    searchTerms: z.array(z.string()).describe("Searches to find accounts for the category.  Each search should be a simple list of strings (e.g. ['cats dogs birds', '...']). Fancy search capabilities like AND/OR/NOT and parentheses are not supported.  Ideally, use between 3 and 5 words per search."),
});

export async function suggestChannels() {
    // get topics defined as categories by topic math
    const { topics } = getTopicGraph(0, 1, TOPICS_TOFETCH); 
    // Avoid circular structure error by logging only names
    console.log('All topics:', topics.map(t => t.name));
    const categories = topics.filter(topic => topic.isCategory);
    console.log('Categories:', categories.map(t => t.name));
    // Get all categories that have not had suggestions generated yet
    const db = getDatabase();
    const unsearchedCategories = db.prepare('SELECT id, name FROM topics WHERE suggested_channels_generated = 0').all();
    console.log(unsearchedCategories);
    const unsearchedCategoryNames = new Set(unsearchedCategories.map(row => row.name));
    const categoriesToSearch = categories.filter(cat => unsearchedCategoryNames.has(cat.name));

    // for each category, get the name, topics connected, and strength of those connections
    const categoryData = categoriesToSearch.map(category => {
        // Get the topic ID from the database since getTopicGraph doesn't include IDs
        const topicFromDb = unsearchedCategories.find(row => row.name === category.name);
        return {
            id: topicFromDb ? topicFromDb.id : null,
            name: category.name,
            topics: category.connections.map(connection => ({
                name: connection.topic.name,
                strength: Number(connection.weight.toFixed(3))
            })),
        };
    });

    if (categoryData.length === 0) {
        console.log('No new categories to search. Skipping suggested channel generation.');
        return { urlDiscovery: null, channelAnalysis: null, totalFoundUrls: 0, totalStoredChannels: 0 };
    }

    // For each category, generate search terms, analyze/store channels, and mark as generated
    for (const categoryObj of categoryData) {
        const searchTerms = await generateSearchTerms([categoryObj]);
        const urlResult = await findChannelsForAllSearchTerms(searchTerms, CHANNELS_PER_SEARCH);
        await analyzeAndStoreChannels(urlResult.foundUrls, categoryObj.id);
        // Mark this category as generated
        db.prepare('UPDATE topics SET suggested_channels_generated = 1 WHERE id = ?').run(categoryObj.id);
    }

    return { urlDiscovery: null, channelAnalysis: null, totalFoundUrls: 0, totalStoredChannels: 0 };
}

async function analyzeAndStoreChannels(foundUrls, categoryId) {
    console.log(`Analyzing ${foundUrls.length} channel URLs...`);
    
    const analyzedChannels = [];
    let successCount = 0;
    let errorCount = 0;
    
    for (const urlData of foundUrls) {
        try {
            console.log(`Analyzing channel: ${urlData.url}`);
            
            // Use existing channel analysis to get full channel data
            const channelInfo = await getChannelByHandle({ handle: urlData.username });
            
            // Create channel data for suggested channels table
            const suggestedChannelData = {
                id: `ig_${urlData.username}`,
                username: urlData.username,
                fullName: channelInfo.channelTitle || null,
                followersCount: channelInfo.subscriberCount || null,
                followsCount: channelInfo.profileData?.followsCount || null,
                postsCount: channelInfo.profileData?.postsCount || null,
                verified: channelInfo.profileData?.verified ? 1 : 0,
                isPrivate: 0, // If we got channel info, it's not private
                biography: channelInfo.profileData?.biography || null,
                externalUrl: Array.isArray(channelInfo.profileData?.externalUrls) && channelInfo.profileData.externalUrls.length > 0 ? channelInfo.profileData.externalUrls[0].url : null,
                profilePicUrl: channelInfo.thumbnailUrl || null,
                localProfilePicPath: channelInfo.thumbnailUrl?.startsWith('/api/images/') ? channelInfo.thumbnailUrl : null,
                searchTerm: urlData.searchTerm,
                platform: 'instagram',
                categoryId: categoryId
            };
            
            // Store in suggested channels database
            upsertSuggestedChannel(suggestedChannelData);
            analyzedChannels.push(suggestedChannelData);
            successCount++;
            
            console.log(`Successfully analyzed and stored: ${urlData.username}`);
            
            // Add small delay to be respectful to the API
            await new Promise(resolve => setTimeout(resolve, 500));
            
        } catch (error) {
            console.error(`Failed to analyze channel ${urlData.url}:`, error.message);
            errorCount++;
        }
    }
    
    console.log(`Channel analysis completed. ${successCount} successful, ${errorCount} failed.`);
    
    return {
        analyzedChannels,
        successCount,
        errorCount,
        totalUrls: foundUrls.length
    };
}

async function generateSearchTerms(categoryData) {
    let searchTerms = [];
    for (const category of categoryData) {
        let userPrompt = `Given this category data in my scraping system, suggest exactly ${MAX_SEARCHES_PER_CATEGORY} searches that will find similar accounts and channels. The array must be exactly ${MAX_SEARCHES_PER_CATEGORY} long. Category data: ${JSON.stringify(category)}`
        console.log(userPrompt);
        const result = await client.chat.completions.create({
            model: "gpt-4.1-mini",
            messages: [{ role: "user", content: userPrompt }],
            response_model: {
                schema: SearchTermsSchema,
                name: "SearchTerms"
            }
        });
        searchTerms.push(...result.searchTerms);
        console.log(result);
    }
    return searchTerms;
}  