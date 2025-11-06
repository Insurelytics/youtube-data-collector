import OpenAI from "openai";
import Instructor from "@instructor-ai/instructor";
import { z } from "zod";
import dotenv from "dotenv";
import { getDatabase } from '../database/connection.js';

// Load environment variables from .env file
dotenv.config();

// Initialize the OpenAI client with your API key
const oai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Ensure your API key is set in the environment variables
});

// Initialize Instructor client for structured responses
const client = Instructor({
  client: oai,
  mode: "FUNCTIONS"
});

// Define schema for channel information returned from research
const ChannelSchema = z.object({
  name: z.string().describe("The channel name"),
  link: z.string().describe("The Instagram channel link (full URL)"),
  bio: z.string().describe("The channel biography or description")
});

const ResearchResultSchema = z.object({
  channels: z.array(ChannelSchema).describe(`Array of suggested Instagram channels similar to the original channel`)
});

// Generate a research prompt for a given channel using database information
export function generateChannelResearchPrompt(channelId, count = 3) {
  const db = getDatabase();

  // Get channel information
  const channel = db.prepare(`
    SELECT id, title, handle, biography FROM channels WHERE id = ?
  `).get(channelId);

  if (!channel) {
    throw new Error(`Channel not found: ${channelId}`);
  }

  // Get top 3 videos with transcriptions, ordered by views
  const topVideos = db.prepare(`
    SELECT title, transcription, viewCount FROM videos 
    WHERE channelId = ? AND transcription IS NOT NULL AND transcription != ''
    ORDER BY viewCount DESC 
    LIMIT 3
  `).all(channelId);

  // Get all other channels for awareness section
  const otherChannels = db.prepare(`
    SELECT id, title, handle, biography FROM channels 
    WHERE id != ? 
    ORDER BY title
  `).all(channelId);

  // Get channels already suggested for this source to avoid duplicates
  const previouslySuggested = db.prepare(`
    SELECT username, fullName, biography FROM suggested_channels
    WHERE searchTerm = ?
    ORDER BY foundAt DESC
  `).all(`src:${channelId}`);

  

  // Build the prompt
  let prompt = `
Find ${count} instagram channels that produce content similar to this one:

Channel Name: ${channel.title}
Bio: ${channel.biography || ''}
Channel Link: https://instagram.com/${channel.handle}

Three Top Performing Videos from the channel "${channel.title}":
`;

  // Add video information
  topVideos.forEach((video, index) => {
    prompt += `
Video ${index + 1} (${video.viewCount?.toLocaleString() || 'N/A'} views):
Title: ${video.title}
Transcription: ${video.transcription}
`;
  });

  // Add awareness section
  prompt += `
I am also aware of these channels, use them to help steer the search:
`;

  otherChannels.forEach((ch) => {
    prompt += `
Channel Name: ${ch.title}
Bio: ${ch.biography || ''}
Channel Link: https://instagram.com/${ch.handle}
`;
  });

  if (previouslySuggested.length > 0) {
    prompt += `

Do not include any of these already suggested channels in your ${count} new results, we already got them from another search:
`;
    previouslySuggested.forEach((sug) => {
      prompt += `\nAlready Suggested: ${sug.fullName || sug.username}\nBio: ${sug.biography || ''}\nChannel Link: https://instagram.com/${sug.username}\n`;
    });
  }

  prompt += `

Return all required info about the ${count} new channels in an organized list.  Specifically, include the channel name, link to the channel, and their Bio.  Do not ask a follow up question.
`;

  return prompt;
}

// Define an asynchronous function to perform the web search
async function performWebSearch(prompt) {
  try {
    // Create a response using the Web Search tool
    const response = await oai.responses.create({
      model: "gpt-5-mini", // Specify the model
      tools: [{ type: "web_search" }], // Include the Web Search tool
      input: prompt, // The Query
    });

    // Output the raw response text
    console.log("Raw Web Search Response:");
    console.log(response.output_text);
    
    // Feed response into Instructor to get structured output
    const structuredResponse = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [{ 
        role: "user", 
        content: `Based on these search results, extract the information into a structured format:\n\n${response.output_text}` 
      }],
      response_model: {
        schema: ResearchResultSchema,
        name: "ResearchResult"
      }
    });
    
    console.log("\nStructured Research Results:");
    console.log(JSON.stringify(structuredResponse, null, 2));
    
    return structuredResponse;
  } catch (error) {
    console.error("Error performing web search:", error);
    throw error;
  }
}

// Example usage: Generate a research prompt for a specific channel and perform web search
// Usage: generateAndSearchChannel('ig_nomadcapitalist');
export async function generateAndSearchChannel(channelId) {
  try {
    const prompt = generateChannelResearchPrompt(channelId);
    console.log("Prompt:", prompt);
    await performWebSearch(prompt);
  } catch (error) {
    console.error("Error generating research prompt:", error);
  }
}

// Returns structured results for similar Instagram channels (name, link, bio)
export async function researchSimilarInstagramChannels(channelId, count = 3) {
  const prompt = generateChannelResearchPrompt(channelId, count);
  console.log("Prompt:", prompt);
  const structured = await performWebSearch(prompt);
  return structured;
}

// To use this module in other files:
// import { generateChannelResearchPrompt, generateAndSearchChannel } from './openAIResearch.js';
// const prompt = generateChannelResearchPrompt('ig_nomadcapitalist');
// console.log(prompt);