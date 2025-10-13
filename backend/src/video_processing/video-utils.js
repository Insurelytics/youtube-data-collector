import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import OpenAI from "openai";
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI();
const execAsync = promisify(exec);

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
 * Downloads video, extracts audio, and stores it persistently
 * @param {string} videoUrl - URL of the video to process
 * @param {string} videoId - Unique identifier for the video
 * @param {string} platform - Platform (youtube/instagram)
 * @returns {string} - Path to the extracted audio file
 */
export async function downloadAndExtractAudio(videoUrl, videoId, platform) {
  try {
    console.log(`Starting audio-only download for ${videoId} from ${platform}...`);
    const audioPath = await downloadAudioDirect(videoUrl, videoId, platform);
    if (!audioPath) {
      throw new Error('Failed to download audio');
    }
    console.log(`Audio download completed for ${videoId}: ${audioPath}`);
    return audioPath;
  } catch (error) {
    console.error(`Error downloading audio for ${videoId}:`, error);
    throw error;
  }
}

/**
 * Transcribes a stored audio file
 * @param {string} audioPath - Path to the audio file
 * @param {string} videoId - Video identifier for logging
 * @returns {string} - Transcription text
 */
export async function transcribeStoredAudio(audioPath, videoId) {
  try {
    if (!fs.existsSync(audioPath)) {
      throw new Error(`Audio file not found: ${audioPath}`);
    }
    
    console.log(`Starting transcription for ${videoId}...`);
    const transcription = await getWordsFromAudio(audioPath);
    console.log(`Transcription completed for ${videoId}`);
    
    return transcription;
    
  } catch (error) {
    console.error(`Error transcribing audio for ${videoId}:`, error);
    throw error;
  }
}

/**
 * Downloads video, extracts audio, filters silence, and returns duration difference
 * @param {string} videoUrl - URL of the video to process
 * @param {string} videoId - Unique identifier for the video
 * @param {string} platform - Platform (youtube/instagram)
 * @returns {Object} - Processing results including duration difference
 * @deprecated Use downloadAndExtractAudio and transcribeStoredAudio separately
 */
export async function processVideo(videoUrl, videoId, platform) {
  try {
    console.log(`Starting audio-only processing for ${videoId} from ${platform}...`);
    const audioPath = await downloadAudioDirect(videoUrl, videoId, platform);
    return audioPath;
  } catch (error) {
    console.error(`Error processing audio ${videoId}:`, error);
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
    const apifyProxyPassword = process.env.APIFY_PROXY_PASSWORD;
    const instagramProxyArg = (platform === 'instagram' && apifyProxyPassword)
      ? ` --proxy "http://groups-RESIDENTIAL:${apifyProxyPassword}@proxy.apify.com:8000"`
      : '';
    if (platform === 'youtube') {
      // Let yt-dlp choose the best format automatically
      command = `yt-dlp -o "${videoPath}" "${videoUrl}"`;
    } else if (platform === 'instagram') {
      const headerArgs = ' --add-header "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" --add-header "Referer: https://www.instagram.com/"';
      command = `yt-dlp -o "${videoPath}"${instagramProxyArg}${headerArgs} "${videoUrl}"`;
    } else {
      throw new Error(`Unsupported platform: ${platform}`);
    }
    
    console.log(`Downloading video: ${videoId}...`);
    await execAsync(command);
    
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
 * Downloads audio directly (no video) using yt-dlp -J and curl
 */
async function downloadAudioDirect(videoUrl, videoId, platform) {
  try {
    // Use a single working path: Instagram post URL (not direct media, not forcing proxy/headers)
    let effectiveUrl = videoUrl;
    if (platform === 'instagram') {
      const shortCode = String(videoId || '').replace(/^ig_/, '');
      if (shortCode) {
        effectiveUrl = `https://www.instagram.com/reel/${shortCode}/`;
      }
    }

    // Mirror proxy and header behavior used for full video downloads to reduce IG blocks
    const apifyProxyPassword = process.env.APIFY_PROXY_PASSWORD;
    const instagramProxyArg = (platform === 'instagram' && apifyProxyPassword)
      ? ` --proxy "http://groups-RESIDENTIAL:${apifyProxyPassword}@proxy.apify.com:8000"`
      : '';
    const headerArgs = (platform === 'instagram')
      ? ' --add-header "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" --add-header "Referer: https://www.instagram.com/"'
      : '';

    const ytdlpCommand = `yt-dlp -J "${effectiveUrl}"${instagramProxyArg}${headerArgs}`;
    const { stdout } = await execAsync(ytdlpCommand);
    const info = JSON.parse(stdout);
    const formats = Array.isArray(info?.formats) ? info.formats : [];
    const audioFormat = formats.find(f => f && f.vcodec === 'none' && f.url);
    if (!audioFormat) {
      throw new Error('Audio-only format not found');
    }

    const ext = audioFormat.ext || 'm4a';
    // Ensure audio directory exists at write time (defensive against external cleanup)
    if (!fs.existsSync(AUDIO_DIR)) {
      fs.mkdirSync(AUDIO_DIR, { recursive: true });
    }
    const outPath = path.join(AUDIO_DIR, `${videoId}.${ext}`);

    const curlCommand = `curl -L --fail --compressed -o "${outPath}" "${audioFormat.url}"`;
    await execAsync(curlCommand);
    console.log(`Audio downloaded: ${outPath}`);
    return outPath;
  } catch (error) {
    console.error(`Error downloading audio directly for ${videoId}:`, error);
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
    
    // First check if video has audio streams
    const probeCommand = `ffprobe -v quiet -select_streams a -show_entries stream=codec_type -of csv=p=0 "${videoPath}"`;
    
    try {
      const { stdout: probeOutput } = await execAsync(probeCommand);
      if (!probeOutput.trim()) {
        throw new Error('No audio streams found in video');
      }
    } catch (probeError) {
      // No audio stream: generate 1s silent audio
      const silentCommand = `ffmpeg -f lavfi -i anullsrc=r=44100:cl=stereo -t 1 "${audioPath}" -y`;
      await execAsync(silentCommand);
      console.log(`Error: no audio streams found in video, generated 1s silent audio: ${audioPath}`);
      return audioPath;
    }
    
    const command = `ffmpeg -i "${videoPath}" -vn -acodec pcm_s16le -ar 44100 -ac 2 "${audioPath}" -y`;
    
    console.log(`Extracting audio: ${audioFilename}...`);
    await execAsync(command);
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
    const { stdout: silenceOutput } = await execAsync(silenceDetectCommand);
    
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
    await execAsync(command);
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
    const { stdout: output } = await execAsync(command);
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
