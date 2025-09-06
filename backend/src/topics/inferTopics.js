import Instructor from "@instructor-ai/instructor";
import OpenAI from "openai"
import { z } from "zod"
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const oai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? undefined,
  organization: process.env.OPENAI_ORG_ID ?? undefined
})

const client = Instructor({
  client: oai,
  mode: "FUNCTIONS"
})

const HashtagsSchema = z.object({
  // Description will be used in the prompt
  hashtags: z.array(z.string()).describe("New hashtags for the video (not already listed in the video's description)"),
  generalHashtags: z.array(z.string()).describe("A few general hashtags for the video that relate to the regular hashtags. For example, if the video is about a new iPhone, and the hashtags are #iphone #apple #newtech, then the general hashtags might include #tech.  If it is about a specific game like fortnite, then the general hashtags might include simply #gaming"),
  unableToInfer: z.boolean().describe("True if it's impossible to come up with good hashtags.  E.g. if the transcription is just music lyrics, and you can't infer what the video is about using the title and description")
})

// use NLP to add 0-5 hashtags to the video transcription
export async function inferTopicsFromTranscription(transcription, title, description, platform) { 
    const result = await client.chat.completions.create({
        messages: [{ role: "user", content: `
Please infer 10-25 new hashtags for the video that are not already listed in the video's description.  All data we have on the video is:
Title: ${title}
Description: ${description}
Transcription: ${transcription}
If it's impossible to come up with good hashtags, leave hashtags empty and set unableToInfer to true` }],
        model: "gpt-5-nano",
        response_model: { 
            schema: HashtagsSchema, 
            name: "Hashtags"
        }
    })
    if (result.unableToInfer) {
        console.log(`Unable to infer hashtags for video ${title} on ${platform}`);
        return [];
    }
    // strip '#' from the front if it exists
    result.hashtags = result.hashtags.map(hashtag => hashtag.startsWith('#') ? hashtag.substring(1) : hashtag);
    result.generalHashtags = result.generalHashtags.map(hashtag => hashtag.startsWith('#') ? hashtag.substring(1) : hashtag);
    const allHashtags = [...result.hashtags, ...result.generalHashtags];
    return allHashtags;
}