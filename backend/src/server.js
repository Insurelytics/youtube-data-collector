import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { ensureDatabase, upsertVideos, queryVideos, upsertChannel, listChannels, removeChannel, getChannel, getChannelTrends, getTopVideos, getSpecialVideos, getViralVideoCount, queryVideosAdvanced } from './storage.js';
import { syncChannelVideos as syncYouTubeVideos, getChannelByHandle as getYouTubeChannelByHandle } from './youtube.js';
import { syncChannelReels as syncInstagramReels, getChannelByHandle as getInstagramChannelByHandle } from './instagram.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const IMAGES_DIR = path.join(__dirname, '../images');
const DEFAULT_DAYS = 36500; // forever
// Use a very large window for syncing so we fetch as much history as possible
const MAX_SYNC_DAYS = 36500; // ~100 years

// Ensure images directory exists
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

// Download image from URL and save to local filesystem
async function downloadImage(imageUrl, videoId) {
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

function createServer() {
  ensureDatabase();

  const app = express();
  app.use(express.json());
  
  // Serve static images
  app.use('/api/images', express.static(IMAGES_DIR));
  
  // Increase timeout for long-running operations like Instagram scraping
  app.use((req, res, next) => {
    // Set timeout to 15 minutes for scraper operations
    req.setTimeout(900000); // 15 minutes
    res.setTimeout(900000); // 15 minutes
    next();
  });



  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/sync', async (req, res) => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) return res.status(400).json({ error: 'Missing API_KEY env' });
    if (!req.query.handle) return res.status(400).json({ error: 'Missing handle' });
    const handle = req.query.handle.toString();
    const platform = (req.query.platform || 'youtube').toString();
    const sinceDays = Number(req.query.sinceDays || MAX_SYNC_DAYS);

    try {
      let result;
      if (platform === 'instagram') {
        result = await syncInstagramReels({ handle, sinceDays });
        
        // Download images for Instagram reels
        if (result.reels) {
          console.log(`Downloading ${result.reels.length} Instagram reel images...`);
          for (const reel of result.reels) {
            if (reel.displayUrl) {
              const localImageUrl = await downloadImage(reel.displayUrl, reel.id);
              if (localImageUrl) {
                reel.localImageUrl = localImageUrl;
              }
            }
          }
        }
      } else {
        // Default to YouTube
        result = await syncYouTubeVideos({ apiKey, handle, sinceDays });
      }

      const { channelId, channelTitle, subscriberCount, thumbnailUrl, videos, reels, profileData } = result;
      const content = videos || reels || [];
      
      const channelData = { 
        id: channelId, 
        title: channelTitle, 
        handle, 
        subscriberCount, 
        isActive: 1, 
        thumbnailUrl, 
        platform 
      };
      
      // Add Instagram profile data if available
      if (profileData) {
        channelData.biography = profileData.biography;
        channelData.postsCount = profileData.postsCount;
        channelData.followsCount = profileData.followsCount;
        channelData.verified = profileData.verified ? 1 : 0;
        channelData.businessCategoryName = profileData.businessCategoryName;
        channelData.externalUrls = profileData.externalUrls ? JSON.stringify(profileData.externalUrls) : null;
      }
      
      upsertChannel(channelData);
      upsertVideos(content);
      res.json({ ok: true, channelId, channelTitle, count: content.length });
    } catch (err) {
      res.status(500).json({ error: err?.message || 'Sync failed' });
    }
  });

  app.get('/api/videos', (req, res) => {
    const search = (req.query.q || '').toString();
    const sort = (req.query.sort || 'date').toString();
    const order = (req.query.order || 'desc').toString();
    const page = Number(req.query.page || 1);
    const pageSize = Math.min(200, Number(req.query.pageSize || 50));
    const { rows, total } = queryVideos({ search, sort, order, page, pageSize });
    res.json({ total, page, pageSize, rows });
  });

  // Channels CRUD
  app.get('/api/channels', async (req, res) => {
    try {
      const rows = listChannels();
      const apiKey = process.env.API_KEY;
      const missing = rows.filter(r => !r.thumbnailUrl && r.isActive && r.handle);
      if (apiKey && missing.length) {
        for (const ch of missing) {
          try {
            let info;
            if (ch.platform === 'instagram') {
              info = await getInstagramChannelByHandle({ handle: ch.handle });
            } else {
              // Default to YouTube for existing channels
              info = await getYouTubeChannelByHandle({ apiKey, handle: ch.handle });
            }
            if (info) {
              const channelData = { 
                id: info.channelId, 
                title: ch.title, 
                handle: ch.handle, 
                subscriberCount: info.subscriberCount, 
                isActive: 1, 
                thumbnailUrl: info.thumbnailUrl,
                platform: ch.platform || 'youtube'
              };
              
              // Add Instagram profile data if available
              if (info.profileData) {
                channelData.biography = info.profileData.biography;
                channelData.postsCount = info.profileData.postsCount;
                channelData.followsCount = info.profileData.followsCount;
                channelData.verified = info.profileData.verified ? 1 : 0;
                channelData.businessCategoryName = info.profileData.businessCategoryName;
                channelData.externalUrls = info.profileData.externalUrls ? JSON.stringify(info.profileData.externalUrls) : null;
              }
              
              upsertChannel(channelData);
            }
          } catch (err) {
            console.warn(`Failed to fetch thumbnail for channel ${ch.handle} (${ch.platform}):`, err.message);
          }
        }
      }
      
      // Add viral video counts to each channel
      const viralMultiplier = Number(req.query.viralMultiplier || 5);
      const days = Number(req.query.days || DEFAULT_DAYS);
      const sinceIso = days < DEFAULT_DAYS ? new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString() : undefined;
      
      const channelsWithViralCounts = listChannels().map(channel => ({
        ...channel,
        viralVideoCount: getViralVideoCount({ 
          channelId: channel.id, 
          avgViews: channel.avgViews, 
          viralMultiplier,
          sinceIso
        })
      }));
      
      res.json({ rows: channelsWithViralCounts });
    } catch (e) {
      console.error('Error in /api/channels GET:', e.message);
      res.json({ rows: listChannels() });
    }
  });

  app.post('/api/channels', async (req, res) => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) return res.status(400).json({ error: 'Missing API_KEY env' });
    const handle = (req.body?.handle || '').toString();
    if (!handle) return res.status(400).json({ error: 'handle required' });
    const platform = (req.body?.platform || 'youtube').toString();

    try {
      let result;
      if (platform === 'instagram') {
        result = await syncInstagramReels({ handle, sinceDays: MAX_SYNC_DAYS });
        
        // Download images for Instagram reels
        if (result.reels) {
          console.log(`Downloading ${result.reels.length} Instagram reel images...`);
          for (const reel of result.reels) {
            if (reel.displayUrl) {
              const localImageUrl = await downloadImage(reel.displayUrl, reel.id);
              if (localImageUrl) {
                reel.localImageUrl = localImageUrl;
              }
            }
          }
        }
      } else {
        // Default to YouTube
        result = await syncYouTubeVideos({ apiKey, handle, sinceDays: MAX_SYNC_DAYS });
      }

      const { channelId, channelTitle, subscriberCount, thumbnailUrl, videos, reels, profileData } = result;
      const content = videos || reels || [];
      
      const channelData = { 
        id: channelId, 
        title: channelTitle, 
        handle, 
        subscriberCount, 
        isActive: 1, 
        thumbnailUrl, 
        platform 
      };
      
      // Add Instagram profile data if available
      if (profileData) {
        channelData.biography = profileData.biography;
        channelData.postsCount = profileData.postsCount;
        channelData.followsCount = profileData.followsCount;
        channelData.verified = profileData.verified ? 1 : 0;
        channelData.businessCategoryName = profileData.businessCategoryName;
        channelData.externalUrls = profileData.externalUrls ? JSON.stringify(profileData.externalUrls) : null;
      }
      
      upsertChannel(channelData);
      upsertVideos(content);
      res.json({ ok: true, channelId, channelTitle, count: content.length });
    } catch (e) {
      res.status(500).json({ error: e?.message || 'Add failed' });
    }
  });

  app.delete('/api/channels/:id', (req, res) => {
    removeChannel(req.params.id);
    res.json({ ok: true });
  });

  // Channel dashboard data
  app.get('/api/channels/:id/dashboard', (req, res) => {
    try {
      const channelId = req.params.id;
      const ch = getChannel(channelId);
      if (!ch) return res.status(404).json({ error: 'not found' });
      const days = Number(req.query.days || DEFAULT_DAYS);
      const viralMultiplier = Number(req.query.viralMultiplier || 5);
      const likeWeight = Number(req.query.likeWeight || 150);
      const commentWeight = Number(req.query.commentWeight || 500);
      const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const trends = getChannelTrends({ channelId, sinceIso });
      const top = getTopVideos({ channelId, sinceIso, likeWeight, commentWeight });
      const special = getSpecialVideos({ channelId, avgViews: ch.avgViews, sinceIso, viralMultiplier });
      res.json({ channel: ch, trends, top, special });
    } catch (e) {
      res.status(500).json({ error: e?.message || 'dashboard failed' });
    }
  });

  // Engagement ordered videos (global or per channel)
  app.get('/api/videos/engagement', (req, res) => {
    const days = Number(req.query.days || DEFAULT_DAYS);
    const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const channelId = req.query.channelId ? req.query.channelId.toString() : undefined;
    const page = Number(req.query.page || 1);
    const pageSize = Math.min(200, Number(req.query.pageSize || 50));
    const order = (req.query.order || 'desc').toString();
    const likeWeight = Number(req.query.likeWeight || 150);
    const commentWeight = Number(req.query.commentWeight || 500);
    const { rows, total } = queryVideosAdvanced({ sinceIso, channelId, sort: 'engagement', order, page, pageSize, likeWeight, commentWeight });
    res.json({ total, page, pageSize, rows });
  });



  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });

  return app;
}

createServer();


