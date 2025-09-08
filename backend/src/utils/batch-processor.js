/**
 * Utility for batch processing with exponential backoff for rate limiting
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get batch size from environment variable, default to 15
const DEFAULT_BATCH_SIZE = parseInt(process.env.OPENAI_BATCH_SIZE) || 15;

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute a batch of async functions with exponential backoff
 * @param {Array} items - Array of items to process
 * @param {Function} processor - Async function that processes a single item
 * @param {Object} options - Configuration options
 * @param {number} options.batchSize - Number of items to process concurrently (default: from env OPENAI_BATCH_SIZE or 15)
 * @param {number} options.maxRetries - Maximum number of retries (default: 5)
 * @param {number} options.baseDelay - Base delay in ms for exponential backoff (default: 1000)
 * @param {number} options.maxDelay - Maximum delay in ms (default: 120000 = 2 minutes)
 * @param {Function} options.progressCallback - Optional progress callback (current, total)
 * @returns {Array} - Array of results in the same order as input items
 */
export async function processBatch(items, processor, options = {}) {
  const {
    batchSize = DEFAULT_BATCH_SIZE,
    maxRetries = 5,
    baseDelay = 1000,
    maxDelay = 120000,
    progressCallback = null
  } = options;

  if (!items || items.length === 0) return [];

  const results = new Array(items.length);
  let processedCount = 0;

  // Process items in batches
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchStartIndex = i;
    
    console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(items.length / batchSize)} (${batch.length} items)`);
    
    // Process batch with retry logic
    const batchPromises = batch.map(async (item, batchIndex) => {
      const itemIndex = batchStartIndex + batchIndex;
      let retries = 0;
      
      while (retries <= maxRetries) {
        try {
          const result = await processor(item, itemIndex);
          processedCount++;
          
          if (progressCallback) {
            progressCallback(processedCount, items.length);
          }
          
          return { success: true, result, index: itemIndex };
        } catch (error) {
          if (retries === maxRetries) {
            console.error(`Failed to process item ${itemIndex} after ${maxRetries} retries:`, error.message);
            processedCount++;
            
            if (progressCallback) {
              progressCallback(processedCount, items.length);
            }
            
            return { success: false, error, index: itemIndex };
          }
          
          // Check if this is a rate limiting error
          const isRateLimit = error.message.includes('rate limit') || 
                              error.message.includes('429') ||
                              error.status === 429;
          
          if (isRateLimit) {
            const delay = Math.min(baseDelay * Math.pow(2, retries), maxDelay);
            console.log(`Rate limited on item ${itemIndex}, retrying in ${delay}ms (attempt ${retries + 1}/${maxRetries + 1})`);
            await sleep(delay);
          } else {
            // For non-rate-limit errors, use a shorter delay
            const delay = Math.min(baseDelay * Math.pow(2, retries) / 4, 5000);
            console.log(`Error processing item ${itemIndex}, retrying in ${delay}ms (attempt ${retries + 1}/${maxRetries + 1}):`, error.message);
            await sleep(delay);
          }
          
          retries++;
        }
      }
    });

    // Wait for the entire batch to complete
    const batchResults = await Promise.all(batchPromises);
    
    // Store results in the correct positions
    batchResults.forEach(({ success, result, error, index }) => {
      results[index] = success ? result : null;
    });

    // Add a small delay between batches to be respectful to the API
    if (i + batchSize < items.length) {
      await sleep(100);
    }
  }

  return results;
}

/**
 * Process transcriptions in batches with exponential backoff
 * @param {Array} audioItems - Array of objects with {audioPath, videoId}
 * @param {Function} transcriptionFunction - Function that handles single transcription
 * @param {Function} progressCallback - Optional progress callback (current, total)
 * @returns {Array} - Array of transcription results
 */
export async function batchTranscribe(audioItems, transcriptionFunction, progressCallback = null) {
  console.log(`Starting batch transcription for ${audioItems.length} audio files...`);
  
  const processor = async (item, index) => {
    const { audioPath, videoId } = item;
    console.log(`Transcribing ${videoId} (${index + 1}/${audioItems.length})...`);
    
    const transcription = await transcriptionFunction(audioPath);
    console.log(`Completed transcription for ${videoId}`);
    
    return { videoId, transcription, audioPath };
  };

  const results = await processBatch(audioItems, processor, {
    batchSize: DEFAULT_BATCH_SIZE,
    maxRetries: 5,
    baseDelay: 1000,
    maxDelay: 120000,
    progressCallback
  });

  console.log(`Batch transcription completed: ${results.filter(r => r !== null).length}/${audioItems.length} successful`);
  return results;
}

/**
 * Process topic inference in batches with exponential backoff
 * @param {Array} videoItems - Array of objects with {transcription, title, description, videoId, platform}
 * @param {Function} topicInferenceFunction - Function that handles single topic inference
 * @param {Function} progressCallback - Optional progress callback (current, total)
 * @returns {Array} - Array of topic inference results
 */
export async function batchInferTopics(videoItems, topicInferenceFunction, progressCallback = null) {
  console.log(`Starting batch topic inference for ${videoItems.length} videos...`);
  
  const processor = async (item, index) => {
    const { transcription, title, description, videoId, platform } = item;
    console.log(`Inferring topics for ${videoId} (${index + 1}/${videoItems.length})...`);
    
    const topics = await topicInferenceFunction(transcription, title, description, platform);
    console.log(`Completed topic inference for ${videoId}: ${topics.length} topics`);
    
    return { videoId, topics, transcription, title, description, platform };
  };

  const results = await processBatch(videoItems, processor, {
    batchSize: DEFAULT_BATCH_SIZE,
    maxRetries: 5,
    baseDelay: 1000,
    maxDelay: 120000,
    progressCallback
  });

  console.log(`Batch topic inference completed: ${results.filter(r => r !== null).length}/${videoItems.length} successful`);
  return results;
}
