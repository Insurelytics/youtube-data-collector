// suggest channels to scrape (supports ig only for now)
import { getTopicGraph } from '../topics/topic-math.js';
import { findChannelsForAllSearchTerms } from './channel-finder.js';
import { getChannelByHandle } from './instagram.js';
import { upsertSuggestedChannel, getSearchedTopicIds, getTopicIdByName } from '../database/index.js';
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
    const allCategories = topics.filter(topic => topic.isCategory);
    
    // Get already searched topic IDs to avoid duplicates [[memory:8384501]]
    const searchedTopicIds = getSearchedTopicIds();
    console.log('Already searched topic IDs:', searchedTopicIds);
    
    // Filter out categories that have already been searched  
    const categories = allCategories.filter(category => {
        const topicId = getTopicIdByName(category.name);
        return !searchedTopicIds.includes(topicId);
    });
    
    console.log(`Found ${allCategories.length} total categories, ${categories.length} not yet searched`);
    
    if (categories.length === 0) {
        console.log('No new categories to search - all have been processed');
        return {
            urlDiscovery: { foundUrls: [], successCount: 0, totalSearchTerms: 0 },
            channelAnalysis: { successCount: 0, errorCount: 0, totalUrls: 0 },
            totalFoundUrls: 0,
            totalStoredChannels: 0
        };
    }

    // for each category, get the name, topics connected, and strength of those connections
    const categoryData = categories.map(category => {
        return {
            name: category.name,
            id: getTopicIdByName(category.name),
            topics: category.connections.map(connection => ({
                name: connection.topic.name,
                strength: Number(connection.weight.toFixed(3))
            })),
        };
    });

    console.log('Generating search terms for categories...');
    let searchTermsWithTopics = await generateSearchTerms(categoryData);
    console.log(`Generated ${searchTermsWithTopics.length} search terms:`, searchTermsWithTopics);
    
    // Extract just the search terms for the existing findChannelsForAllSearchTerms function
    const searchTerms = searchTermsWithTopics.map(item => item.searchTerm);
    
    // Find channel URLs for all search terms
    console.log('Starting channel URL discovery process...');
    const urlResult = await findChannelsForAllSearchTerms(searchTerms, CHANNELS_PER_SEARCH);
    
    console.log('Channel URL discovery completed!');
    console.log(`URL Results: Found ${urlResult.foundUrls.length} URLs from ${urlResult.successCount}/${urlResult.totalSearchTerms} successful searches`);
    
    // Analyze and store the found channels
    console.log('Starting channel analysis and storage...');
    const analysisResult = await analyzeAndStoreChannels(urlResult.foundUrls, searchTermsWithTopics);
    
    console.log('Channel analysis completed!');
    console.log(`Analysis Results: ${analysisResult.successCount} channels analyzed and stored, ${analysisResult.errorCount} failed`);
    
    return {
        urlDiscovery: urlResult,
        channelAnalysis: analysisResult,
        totalFoundUrls: urlResult.foundUrls.length,
        totalStoredChannels: analysisResult.successCount
    };
}

async function analyzeAndStoreChannels(foundUrls, searchTermsWithTopics) {
    console.log(`Analyzing ${foundUrls.length} channel URLs...`);
    
    // Create a mapping from search term to topic ID
    const searchTermToTopicId = {};
    searchTermsWithTopics.forEach(item => {
        searchTermToTopicId[item.searchTerm] = item.topicId;
    });
    
    const analyzedChannels = [];
    let successCount = 0;
    let errorCount = 0;
    
    for (const urlData of foundUrls) {
        try {
            console.log(`Analyzing channel: ${urlData.url}`);
            
            // Use existing channel analysis to get full channel data
            const channelInfo = await getChannelByHandle({ handle: urlData.username });
            
            // Get the topic ID for this search term
            const topicId = searchTermToTopicId[urlData.searchTerm] || null;
            
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
                topicId: topicId
            };
            
            // Store in suggested channels database
            upsertSuggestedChannel(suggestedChannelData);
            analyzedChannels.push(suggestedChannelData);
            successCount++;
            
            console.log(`Successfully analyzed and stored: ${urlData.username} (topicId: ${topicId})`);
            
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
    let searchTermsWithTopics = [];
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
        
        // Add each search term with its associated topic ID
        result.searchTerms.forEach(searchTerm => {
            searchTermsWithTopics.push({
                searchTerm: searchTerm,
                topicId: category.id
            });
        });
        console.log(result);
    }
    return searchTermsWithTopics;
}  