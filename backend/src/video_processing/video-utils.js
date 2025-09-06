import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import OpenAI from "openai";
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VIDEOS_DIR = path.join(__dirname, '../../temp/videos');
const AUDIO_DIR = path.join(__dirname, '../../temp/audio');

// Ensure directories exist
[VIDEOS_DIR, AUDIO_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

/**
 * Downloads video, extracts audio, filters silence, and returns duration difference
 * @param {string} videoUrl - URL of the video to process
 * @param {string} videoId - Unique identifier for the video
 * @param {string} platform - Platform (youtube/instagram)
 * @returns {Object} - Processing results including duration difference
 */
export async function processVideo(videoUrl, videoId, platform) {
  let videoPath = null;
  let audioPath = null;
  
  try {
    console.log(`Starting video processing for ${videoId} from ${platform}...`);
    
    // Download video
    videoPath = await downloadVideo(videoUrl, videoId, platform);
    if (!videoPath) {
      throw new Error('Failed to download video');
    }
    
    // Extract original audio
    audioPath = await extractAudio(videoPath, videoId, 'original');
    
    return audioPath;
    
  } catch (error) {
    console.error(`Error processing video ${videoId}:`, error);
    if (videoPath) {
      fs.unlinkSync(videoPath);
    }
    if (audioPath) {
      fs.unlinkSync(audioPath);
    }
    throw error;
  }
}

export async function getWordsFromAudio(audioPath) {
    try {
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(audioPath),
        model: "gpt-4o-mini-transcribe",
      });

      console.log(transcription.text);
      return transcription.text;
    } catch (error) {
      console.error(`Error getting words from audio ${audioPath}:`, error);
      throw error;
    }
}

/**
 * Downloads video using yt-dlp
 */
async function downloadVideo(videoUrl, videoId, platform) {
  try {
    const videoPath = path.join(VIDEOS_DIR, `${videoId}.%(ext)s`);
    
    let command;
    if (platform === 'youtube') {
      // Let yt-dlp choose the best format automatically
      command = `yt-dlp -o "${videoPath}" "${videoUrl}"`;
    } else if (platform === 'instagram') {
      command = `yt-dlp -f best -o "${videoPath}" "${videoUrl}"`;
    } else {
      throw new Error(`Unsupported platform: ${platform}`);
    }
    
    console.log(`Downloading video: ${videoId}...`);
    execSync(command, { stdio: 'pipe' });
    
    // Find the actual downloaded file
    const files = fs.readdirSync(VIDEOS_DIR).filter(file => file.startsWith(videoId));
    if (files.length === 0) {
      throw new Error('Downloaded video file not found');
    }
    
    const actualVideoPath = path.join(VIDEOS_DIR, files[0]);
    console.log(`Video downloaded: ${actualVideoPath}`);
    return actualVideoPath;
    
  } catch (error) {
    console.error(`Error downloading video ${videoId}:`, error);
    return null;
  }
}

/**
 * Extracts audio from video using ffmpeg
 */
async function extractAudio(videoPath, videoId, suffix = '') {
  try {
    const audioFilename = suffix ? `${videoId}_${suffix}.wav` : `${videoId}.wav`;
    const audioPath = path.join(AUDIO_DIR, audioFilename);
    
    const command = `ffmpeg -i "${videoPath}" -vn -acodec pcm_s16le -ar 44100 -ac 2 "${audioPath}" -y`;
    
    console.log(`Extracting audio: ${audioFilename}...`);
    execSync(command, { stdio: 'pipe' });
    console.log(`Audio extracted: ${audioPath}`);
    
    return audioPath;
  } catch (error) {
    console.error(`Error extracting audio from ${videoPath}:`, error);
    throw error;
  }
}

/**
 * Filters out silent parts of audio with 0.5s padding
 */
async function filterSilence(originalAudioPath, videoId) {
  try {
    const filteredAudioPath = path.join(AUDIO_DIR, `${videoId}_filtered.wav`);
    
    // First, detect silence periods
    const silenceDetectCommand = `ffmpeg -i "${originalAudioPath}" -af silencedetect=noise=-30dB:duration=0.5 -f null - 2>&1`;
    const silenceOutput = execSync(silenceDetectCommand, { encoding: 'utf8' });
    
    // Parse silence periods
    const silenceRanges = parseSilenceOutput(silenceOutput);
    
    if (silenceRanges.length === 0) {
      // No silence detected, copy original
      fs.copyFileSync(originalAudioPath, filteredAudioPath);
      return filteredAudioPath;
    }
    
    // Get total duration
    const totalDuration = await getAudioDuration(originalAudioPath);
    
    // Create filter to remove silence with 0.5s padding
    const nonSilentRanges = createNonSilentRanges(silenceRanges, totalDuration, 0.5);
    
    if (nonSilentRanges.length === 0) {
      throw new Error('No non-silent audio found');
    }
    
    // Build ffmpeg filter to concatenate non-silent parts
    const filterComplex = buildConcatenationFilter(nonSilentRanges);
    
    const command = `ffmpeg -i "${originalAudioPath}" -filter_complex "${filterComplex}" "${filteredAudioPath}" -y`;
    
    console.log(`Filtering silence from audio: ${videoId}...`);
    execSync(command, { stdio: 'pipe' });
    console.log(`Silence filtered: ${filteredAudioPath}`);
    
    return filteredAudioPath;
  } catch (error) {
    console.error(`Error filtering silence from ${originalAudioPath}:`, error);
    throw error;
  }
}

/**
 * Gets duration of audio file in seconds
 */
async function getAudioDuration(audioPath) {
  try {
    const command = `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${audioPath}"`;
    const output = execSync(command, { encoding: 'utf8' });
    return parseFloat(output.trim());
  } catch (error) {
    console.error(`Error getting duration of ${audioPath}:`, error);
    throw error;
  }
}

/**
 * Parses ffmpeg silence detection output
 */
function parseSilenceOutput(output) {
  const silenceRanges = [];
  const lines = output.split('\n');
  
  let silenceStart = null;
  
  for (const line of lines) {
    if (line.includes('silence_start:')) {
      const match = line.match(/silence_start: ([\d.]+)/);
      if (match) {
        silenceStart = parseFloat(match[1]);
      }
    } else if (line.includes('silence_end:') && silenceStart !== null) {
      const match = line.match(/silence_end: ([\d.]+)/);
      if (match) {
        const silenceEnd = parseFloat(match[1]);
        silenceRanges.push({ start: silenceStart, end: silenceEnd });
        silenceStart = null;
      }
    }
  }
  
  return silenceRanges;
}

/**
 * Creates non-silent ranges with padding
 */
function createNonSilentRanges(silenceRanges, totalDuration, padding) {
  const nonSilentRanges = [];
  let lastEnd = 0;
  
  for (const silence of silenceRanges) {
    const segmentStart = lastEnd;
    const segmentEnd = Math.max(segmentStart, silence.start - padding);
    
    if (segmentEnd > segmentStart) {
      nonSilentRanges.push({ start: segmentStart, end: segmentEnd });
    }
    
    lastEnd = Math.min(totalDuration, silence.end + padding);
  }
  
  // Add final segment if there's audio after the last silence
  if (lastEnd < totalDuration) {
    nonSilentRanges.push({ start: lastEnd, end: totalDuration });
  }
  
  return nonSilentRanges;
}

/**
 * Builds ffmpeg filter complex for concatenating audio segments
 */
function buildConcatenationFilter(ranges) {
  if (ranges.length === 1) {
    const range = ranges[0];
    return `[0:a]atrim=start=${range.start}:end=${range.end}[out]`;
  }
  
  const trimFilters = ranges.map((range, i) => 
    `[0:a]atrim=start=${range.start}:end=${range.end}[a${i}]`
  ).join(';');
  
  const concatInputs = ranges.map((_, i) => `[a${i}]`).join('');
  const concatFilter = `${concatInputs}concat=n=${ranges.length}:v=0:a=1[out]`;
  
  return `${trimFilters};${concatFilter}`;
}
