import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IMAGES_DIR = path.join(__dirname, '../../images');

// Ensure images directory exists
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

// Get the local image URL for a video if it exists
export function getLocalImageUrl(videoId) {
  try {
    const extensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
    for (const ext of extensions) {
      const filename = `${videoId}.${ext}`;
      const filepath = path.join(IMAGES_DIR, filename);
      if (fs.existsSync(filepath)) {
        return `/api/images/${filename}`;
      }
    }
    return null;
  } catch (error) {
    console.error(`Error getting local image URL for ${videoId}:`, error);
    return null;
  }
}

// Download image from URL and save to local filesystem
export async function downloadImage(imageUrl, videoId) {
  try {
    if (!imageUrl || !imageUrl.includes('instagram')) return null;
    
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Referer': 'https://www.instagram.com/'
    };

    const proxyPassword = process.env.APIFY_PROXY_PASSWORD;
    const agent = proxyPassword
      ? new (await import('https-proxy-agent')).HttpsProxyAgent(`http://groups-RESIDENTIAL:${proxyPassword}@proxy.apify.com:8000`)
      : undefined;

    const response = await fetch(imageUrl, {
      headers,
      // Pass proxy agent if configured
      agent
    });

    if (!response.ok) {
      console.warn(`Failed to download image for ${videoId}: ${response.status}`);
      return null;
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.startsWith('image/')) {
      console.warn(`Invalid content type for ${videoId}: ${contentType}`);
      return null;
    }

    const extension = contentType.split('/')[1] || 'jpg';
    const filename = `${videoId}.${extension}`;
    const filepath = path.join(IMAGES_DIR, filename);

    const buffer = await response.arrayBuffer();
    fs.writeFileSync(filepath, Buffer.from(buffer));

    return `/api/images/${filename}`;
  } catch (error) {
    console.error(`Error downloading image for ${videoId}:`, error);
    return null;
  }
}

// Download channel thumbnail from URL and save to local filesystem
export async function downloadChannelThumbnail(thumbnailUrl, channelId) {
  try {
    if (!thumbnailUrl) return null;
    
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Referer': 'https://www.instagram.com/'
    };

    const proxyPassword = process.env.APIFY_PROXY_PASSWORD;
    const agent = proxyPassword
      ? new (await import('https-proxy-agent')).HttpsProxyAgent(`http://groups-RESIDENTIAL:${proxyPassword}@proxy.apify.com:8000`)
      : undefined;

    const response = await fetch(thumbnailUrl, {
      headers,
      agent
    });

    if (!response.ok) {
      console.warn(`Failed to download channel thumbnail for ${channelId}: ${response.status}`);
      return null;
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.startsWith('image/')) {
      console.warn(`Invalid content type for channel ${channelId}: ${contentType}`);
      return null;
    }

    const extension = contentType.split('/')[1] || 'jpg';
    const filename = `${channelId}_thumb.${extension}`;
    const filepath = path.join(IMAGES_DIR, filename);

    const buffer = await response.arrayBuffer();
    fs.writeFileSync(filepath, Buffer.from(buffer));

    return `/api/images/${filename}`;
  } catch (error) {
    console.error(`Error downloading channel thumbnail for ${channelId}:`, error);
    return null;
  }
}
