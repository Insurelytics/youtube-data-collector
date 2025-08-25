import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureDatabase, upsertVideos, queryVideos, upsertChannel, listChannels, removeChannel, getChannel, getChannelTrends, getTopVideos, getSpecialVideos, getViralVideoCount, queryVideosAdvanced } from './storage.js';
import { syncChannelVideos, getChannelByHandle } from './youtube.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const DEFAULT_DAYS = 36500; // forever
// Use a very large window for syncing so we fetch as much history as possible
const MAX_SYNC_DAYS = 36500; // ~100 years

function createServer() {
  ensureDatabase();

  const app = express();
  app.use(express.json());



  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/sync', async (req, res) => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) return res.status(400).json({ error: 'Missing API_KEY env' });
    if (!req.query.handle) return res.status(400).json({ error: 'Missing handle' });
    const handle = req.query.handle.toString();
    const sinceDays = Number(req.query.sinceDays || MAX_SYNC_DAYS);
    try {
      const { channelId, channelTitle, subscriberCount, thumbnailUrl, videos } = await syncChannelVideos({ apiKey, handle, sinceDays });
      upsertChannel({ id: channelId, title: channelTitle, handle, subscriberCount, isActive: 1, thumbnailUrl });
      upsertVideos(videos);
      res.json({ ok: true, channelId, channelTitle, count: videos.length });
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
            const info = await getChannelByHandle({ apiKey, handle: ch.handle });
            upsertChannel({ id: info.channelId, title: ch.title, handle: ch.handle, subscriberCount: info.subscriberCount, isActive: 1, thumbnailUrl: info.thumbnailUrl });
          } catch {}
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
          subscriberCount: channel.subscriberCount, 
          viralMultiplier,
          sinceIso
        })
      }));
      
      res.json({ rows: channelsWithViralCounts });
    } catch (e) {
      res.json({ rows: listChannels() });
    }
  });

  app.post('/api/channels', async (req, res) => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) return res.status(400).json({ error: 'Missing API_KEY env' });
    const handle = (req.body?.handle || '').toString();
    if (!handle) return res.status(400).json({ error: 'handle required' });
    try {
      const { channelId, channelTitle, subscriberCount, thumbnailUrl, videos } = await syncChannelVideos({ apiKey, handle, sinceDays: MAX_SYNC_DAYS });
      upsertChannel({ id: channelId, title: channelTitle, handle, subscriberCount, isActive: 1, thumbnailUrl });
      upsertVideos(videos);
      res.json({ ok: true, channelId, channelTitle, count: videos.length });
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
      const special = getSpecialVideos({ channelId, subscriberCount: ch.subscriberCount, sinceIso, viralMultiplier });
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


