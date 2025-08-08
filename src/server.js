import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureDatabase, upsertVideos, queryVideos, upsertChannel } from './storage.js';
import { syncChannelVideos } from './youtube.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const DEFAULT_HANDLE = '@ThePrimeTimeagen';
const DEFAULT_DAYS = 120;

async function runInitialSync() {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error('API_KEY is not set in the environment. Create a .env with API_KEY=...');
    return;
  }
  try {
    const { channelId, channelTitle, videos } = await syncChannelVideos({
      apiKey,
      handle: DEFAULT_HANDLE,
      sinceDays: DEFAULT_DAYS,
    });
    upsertChannel({ id: channelId, title: channelTitle, handle: DEFAULT_HANDLE });
    upsertVideos(videos);
    console.log(`Initial sync complete: ${videos.length} videos for ${channelTitle}`);
  } catch (err) {
    console.error('Initial sync failed:', err?.message || err);
  }
}

function createServer() {
  ensureDatabase();

  const app = express();
  app.use(express.json());

  // Serve static frontend
  app.use(express.static(path.join(__dirname, '../public')));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/sync', async (req, res) => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) return res.status(400).json({ error: 'Missing API_KEY env' });

    const handle = (req.query.handle || DEFAULT_HANDLE).toString();
    const sinceDays = Number(req.query.sinceDays || DEFAULT_DAYS);
    try {
      const { channelId, channelTitle, videos } = await syncChannelVideos({ apiKey, handle, sinceDays });
      upsertChannel({ id: channelId, title: channelTitle, handle });
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

  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });

  // Fire and forget initial sync
  runInitialSync();

  return app;
}

createServer();


