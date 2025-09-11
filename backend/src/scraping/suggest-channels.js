// suggest channels to scrape (supports ig only for now)
import { getTopicGraph } from '../topics/topic-math.js';
import { findChannelsForAllSearchTerms } from './channel-finder.js';
import { getChannelByHandle } from './instagram.js';
import { upsertSuggestedChannel, hasCategoryBeenSearched } from '../database/index.js';
import Instructor from "@instructor-ai/instructor";
import OpenAI from "openai"
import { z } from "zod"
import dotenv from 'dotenv'

// this is the final step in the initial scrape process, and will search for channels that focus on similar topics to the ones in the database

const TOPICS_TOFETCH = 4; // To generally increase the number of searches increase this number.  
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
    const categories = topics.filter(topic => topic.isCategory);

    // Filter out categories that have already been searched
    const unsearchedCategories = [];
    for (const category of categories) {
        if (!hasCategoryBeenSearched(category.id)) {
            unsearchedCategories.push(category);
        } else {
            console.log(`Skipping category "${category.name}" (ID: ${category.id}) - already searched`);
        }
    }

    if (unsearchedCategories.length === 0) {
        console.log('All available categories have already been searched. No new suggestions to generate.');
        return {
            urlDiscovery: { foundUrls: [], successCount: 0, totalSearchTerms: 0 },
            channelAnalysis: { analyzedChannels: [], successCount: 0, errorCount: 0, totalUrls: 0 },
            totalFoundUrls: 0,
            totalStoredChannels: 0,
            skippedCategories: categories.length
        };
    }

    // Process each category individually to avoid complex mapping
    let totalFoundUrls = 0;
    let totalStoredChannels = 0;
    let totalErrors = 0;
    let totalSearchTerms = 0;

    for (const category of unsearchedCategories) {
        console.log(`\n=== Processing category: ${category.name} (ID: ${category.id}) ===`);

        // Prepare category data for this specific category
        const categoryData = {
            name: category.name,
            id: category.id,
            topics: category.connections.map(connection => ({
                name: connection.topic.name,
                strength: Number(connection.weight.toFixed(3))
            })),
        };

        // Generate search terms for this category
        console.log(`Generating search terms for category "${category.name}"...`);
        const searchTerms = await generateSearchTermsForCategory(categoryData);
        console.log(`Generated ${searchTerms.length} search terms for "${category.name}"`);

        if (searchTerms.length === 0) {
            console.log(`No search terms generated for category "${category.name}", skipping...`);
            continue;
        }

        totalSearchTerms += searchTerms.length;

        // Find channel URLs for this category's search terms
        console.log(`Finding channels for category "${category.name}"...`);
        const urlResult = await findChannelsForAllSearchTerms(searchTerms, CHANNELS_PER_SEARCH);

        console.log(`Found ${urlResult.foundUrls.length} URLs for category "${category.name}"`);

        if (urlResult.foundUrls.length === 0) {
            console.log(`No URLs found for category "${category.name}", continuing to next category...`);
            continue;
        }

        totalFoundUrls += urlResult.foundUrls.length;

        // Analyze and store channels for this category
        console.log(`Analyzing and storing channels for category "${category.name}"...`);
        const analysisResult = await analyzeAndStoreChannelsForCategory(urlResult.foundUrls, category);

        console.log(`Category "${category.name}": ${analysisResult.successCount} channels stored, ${analysisResult.errorCount} errors`);

        totalStoredChannels += analysisResult.successCount;
        totalErrors += analysisResult.errorCount;
    }

    console.log('\n=== Processing Complete ===');
    console.log(`Total: ${totalStoredChannels} channels stored from ${totalFoundUrls} URLs across ${unsearchedCategories.length} categories`);

    return {
        totalFoundUrls,
        totalStoredChannels,
        totalErrors,
        categoriesProcessed: unsearchedCategories.length,
        skippedCategories: categories.length - unsearchedCategories.length
    };
}

async function analyzeAndStoreChannelsForCategory(foundUrls, category) {
    console.log(`Analyzing ${foundUrls.length} channel URLs for category "${category.name}"...`);

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
                categoryId: category.id,
                platform: 'instagram'
            };

            // Store in suggested channels database
            upsertSuggestedChannel(suggestedChannelData);
            analyzedChannels.push(suggestedChannelData);
            successCount++;

            console.log(`Successfully analyzed and stored: ${urlData.username} (Category: ${category.name})`);

            // Add small delay to be respectful to the API
            await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
            console.error(`Failed to analyze channel ${urlData.url}:`, error.message);
            errorCount++;
        }
    }

    console.log(`Channel analysis completed for "${category.name}". ${successCount} successful, ${errorCount} failed.`);

    return {
        analyzedChannels,
        successCount,
        errorCount,
        totalUrls: foundUrls.length
    };
}

async function generateSearchTermsForCategory(categoryData) {
    let userPrompt = `Given this category data in my scraping system, suggest exactly ${MAX_SEARCHES_PER_CATEGORY} searches that will find similar accounts and channels. The array must be exactly ${MAX_SEARCHES_PER_CATEGORY} long. Category data: ${JSON.stringify(categoryData)}`
    console.log(`Generating search terms for category "${categoryData.name}" (ID: ${categoryData.id})`);
    console.log(userPrompt);

    try {
        const result = await client.chat.completions.create({
            model: "gpt-4.1-mini",
            messages: [{ role: "user", content: userPrompt }],
            response_model: {
                schema: SearchTermsSchema,
                name: "SearchTerms"
            }
        });

        // Just return the plain search terms - we know they all belong to this category
        console.log(`Generated ${result.searchTerms.length} search terms for category "${categoryData.name}"`);
        return result.searchTerms;
    } catch (error) {
        console.error(`Failed to generate search terms for category "${categoryData.name}":`, error.message);
        return [];
    }
}  