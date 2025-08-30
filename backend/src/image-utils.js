import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IMAGES_DIR = path.join(__dirname, '../images');

// Ensure images directory exists
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

// Download image from URL and save to local filesystem
export async function downloadImage(imageUrl, videoId) {
  try {
    if (!imageUrl || !imageUrl.includes('instagram')) return null;
    
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
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
