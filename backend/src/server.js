import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { 
  initializeDatabase, 
  queryVideos, 
  upsertChannel, 
  listChannels, 
  removeChannel, 
  getChannel, 
  getChannelTrends, 
  getTopVideos, 
  getSpecialVideos, 
  getViralVideoCount, 
  queryVideosAdvanced, 
  createSyncJob, 
  listJobs, 
  getJobStatus, 
  setSetting, 
  getSettings, 
  getSetting, 
  getTopicStats, 
  getVideosByTopic, 
  cleanupOrphanedRunningJobs,
  getVideosNeedingAudioProcessing,
  getVideosNeedingTranscription,
  listSuggestedChannels,
  getSuggestedChannelsBySearchTerm,
  removeSuggestedChannel,
  listWorkspaces,
  createWorkspace,
  removeWorkspace
} from './database/index.js';
import { initChannelsSchema } from './database/channels.js';
import { initVideosSchema } from './database/videos.js';
import { initJobsSchema } from './database/jobs.js';
import { initTopicsSchema } from './database/topics.js';
import { initSettingsSchema } from './database/settings.js';
import { initSuggestedChannelsSchema } from './database/suggested-channels.js';
import { getTopicRanking, getTopicGraph, CATEGORY_THRESHOLD } from './topics/topic-math.js';

import { getChannelByHandle as getYouTubeChannelByHandle } from './scraping/youtube.js';
import { getChannelByHandle as getInstagramChannelByHandle } from './scraping/instagram.js';
import QueueManager from './scraping/queue-manager.js';
// Note: Scheduler is not currently in use; imports kept for potential future re-enable
// import { initScheduler, triggerScheduledSync } from './scraping/schedule.js';
import { processAudioDownloads, processTranscriptions } from './scraping/scraping-orchestrator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const PORT = process.env.PORT || 4000;
const IMAGES_DIR = path.join(__dirname, '../images');
const DEFAULT_DAYS = 36500; // forever
// Use a very large window for syncing so we fetch as much history as possible
const MAX_SYNC_DAYS = 36500; // ~100 years

// Ensure images directory exists
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}


async function createServer() {
  initializeDatabase();

  // Clean up any jobs that were left in 'running' or 'pending' state across all workspaces
  try {
    const { setRequestWorkspace } = await import('./database/connection.js');
    const workspaces = [{ id: 'default' }, ...listWorkspaces().map(w => ({ id: w.id }))];
    for (const ws of workspaces) {
      try {
        setRequestWorkspace(ws.id);
        cleanupOrphanedRunningJobs();
      } catch (e) {
        console.warn(`Job cleanup skipped for workspace '${ws.id}':`, e?.message || e);
      }
    }
    // Restore to default workspace after cleanup
    setRequestWorkspace('default');
  } catch (e) {
    console.warn('Global job cleanup failed:', e?.message || e);
  }

  // Initialize queue manager
  const queueManager = new QueueManager();

  // Initialize scheduler (disabled / not in use)
  // initScheduler();

  const app = express();
  app.use(express.json());
  // Workspace selector middleware: read from header or cookie and set DB workspace
  const { setRequestWorkspace, initializeWorkspaceDatabase } = await import('./database/connection.js');

  app.use((req, _res, next) => {
    const header = req.headers['x-workspace-id'];
    const cookies = parseCookies(req.headers.cookie || '');
    const cookieWorkspace = cookies.workspaceId;
    const workspaceId = (header || cookieWorkspace || 'default').toString();
    setRequestWorkspace(workspaceId);
    req.workspaceId = workspaceId;
    next();
  });
  
  // Simple in-memory session store
  const activeTokens = new Set();

  // Parse cookies util (no external deps)
  function parseCookies(cookieHeader) {
    const result = {};
    if (!cookieHeader) return result;
    cookieHeader.split(';').forEach(part => {
      const idx = part.indexOf('=');
      if (idx > -1) {
        const key = part.slice(0, idx).trim();
        const val = decodeURIComponent(part.slice(idx + 1).trim());
        result[key] = val;
      }
    });
    return result;
  }

  // Auth middleware for all /api routes except login
  function authMiddleware(req, res, next) {
    if (process.env.DEV_NO_AUTH === 'true') return next();
    if (req.path === '/api/login') return next();
    const cookies = parseCookies(req.headers.cookie || '');
    const token = cookies.authToken;
    if (token && activeTokens.has(token)) return next();
    res.status(401).json({ error: 'Unauthorized' });
  }

  // Login route (unprotected)
  app.post('/api/login', (req, res) => {
    const { username, password } = req.body || {};
    const expectedUser = process.env.ADMIN_USERNAME;
    const expectedPass = process.env.ADMIN_PASSWORD;
    if (!expectedUser || !expectedPass) {
      return res.status(500).json({ error: 'Server auth not configured' });
    }
    if (username === expectedUser && password === expectedPass) {
      const token = crypto.randomBytes(24).toString('hex');
      activeTokens.add(token);
      const cookie = `authToken=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 7}`; // 7 days
      res.setHeader('Set-Cookie', cookie);
      return res.json({ ok: true });
    }
    return res.status(401).json({ error: 'Invalid credentials' });
  });

  // Logout route
  app.post('/api/logout', (req, res) => {
    const cookies = parseCookies(req.headers.cookie || '');
    const token = cookies.authToken;
    if (token) activeTokens.delete(token);
    res.setHeader('Set-Cookie', 'authToken=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
    res.json({ ok: true });
  });
  
  // Apply auth for all API routes after login/logout are defined
  app.use(authMiddleware);

  // Workspace management endpoints (protected)
  app.get('/api/workspaces', (req, res) => {
    try {
      res.json({ workspaces: listWorkspaces() });
    } catch (err) {
      res.status(500).json({ error: err?.message || 'Failed to list workspaces' });
    }
  });

  app.post('/api/workspaces', (req, res) => {
    try {
      const { id, name } = req.body || {};
      if (!id || !name) return res.status(400).json({ error: 'id and name required' });
      // Initialize the DB file and run schema init on it
      const db = initializeWorkspaceDatabase(id);
      
      // Set the workspace context temporarily to initialize schemas
      setRequestWorkspace(id);
      
      initChannelsSchema();
      initVideosSchema();
      initJobsSchema();
      initTopicsSchema();
      initSettingsSchema();
      initSuggestedChannelsSchema();
      
      // Restore to request workspace
      setRequestWorkspace(req.workspaceId);
      
      createWorkspace({ id, name, dbFile: `data/${id}.sqlite` });
      res.json({ ok: true, id });
    } catch (err) {
      res.status(500).json({ error: err?.message || 'Failed to create workspace' });
    }
  });

  app.delete('/api/workspaces/:id', (req, res) => {
    try {
      const { id } = req.params;
      // Note: do not delete DB file automatically; just remove registry row for now
      removeWorkspace(id);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err?.message || 'Failed to remove workspace' });
    }
  });
  
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
    if (!req.query.handle) return res.status(400).json({ error: 'Missing handle' });
    if (!req.query.platform) return res.status(400).json({ error: 'Missing platform' });
    const handle = req.query.handle.toString();
    const platform = req.query.platform.toString();
    const sinceDays = Number(req.query.sinceDays || MAX_SYNC_DAYS);

    // Validate API key for YouTube
    if (platform === 'youtube' && !process.env.API_KEY) {
      return res.status(400).json({ error: 'Missing API_KEY env' });
    }

    try {
      // Create a sync job instead of processing directly
      const jobId = createSyncJob({ handle, platform, sinceDays, isInitialScrape: 0, workspaceId: req.workspaceId });
      res.json({ ok: true, jobId, message: 'Sync job queued' });
    } catch (err) {
      res.status(500).json({ error: err?.message || 'Failed to queue sync job' });
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
                platform: ch.platform
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
      let viralMethod = 'subscribers';
      try {
        const gc = getSetting('globalCriteria');
        if (gc) {
          const parsed = JSON.parse(gc);
          if (parsed.viralMethod === 'avgViews' || parsed.viralMethod === 'subscribers') {
            viralMethod = parsed.viralMethod;
          }
        }
      } catch {}
      const days = Number(req.query.days || DEFAULT_DAYS);
      const sinceIso = days < DEFAULT_DAYS ? new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString() : undefined;
      
      const useHideCta = (() => {
        if (req.query.hideCta != null) return (req.query.hideCta === '1' || req.query.hideCta === 'true');
        try {
          const gc = getSetting('globalCriteria');
          if (gc) return !!JSON.parse(gc)?.hideCta;
        } catch {}
        return false;
      })();

      const channelsWithViralCounts = listChannels().map(channel => ({
        ...channel,
        viralVideoCount: getViralVideoCount({ 
          channelId: channel.id, 
          avgViews: channel.avgViews, 
          subscriberCount: channel.subscriberCount,
          viralMethod,
          viralMultiplier,
          sinceIso,
          excludeCta: useHideCta
        })
      }));
      
      res.json({ rows: channelsWithViralCounts });
    } catch (e) {
      console.error('Error in /api/channels GET:', e.message);
      res.json({ rows: listChannels() });
    }
  });

  app.post('/api/channels', async (req, res) => {
    const handle = (req.body?.handle || '').toString();
    if (!handle) return res.status(400).json({ error: 'handle required' });
    if (!req.body?.platform) return res.status(400).json({ error: 'platform required' });
    const platform = req.body.platform.toString();

    // Validate API key for YouTube
    if (platform === 'youtube' && !process.env.API_KEY) {
      return res.status(400).json({ error: 'Missing API_KEY env' });
    }

    try {
      // Create a sync job instead of processing directly
      const jobId = createSyncJob({ handle, platform, sinceDays: MAX_SYNC_DAYS, isInitialScrape: 1, workspaceId: req.workspaceId });
      res.json({ ok: true, jobId, message: 'Channel sync job queued' });
    } catch (e) {
      res.status(500).json({ error: e?.message || 'Failed to queue channel sync job' });
    }
  });

  app.delete('/api/channels/:id', (req, res) => {
    removeChannel(req.params.id);
    res.json({ ok: true });
  });

  // Suggested channels endpoints
  app.get('/api/suggested-channels', (req, res) => {
    try {
      const searchTerm = req.query.searchTerm;
      const minFollowers = Number(req.query.minFollowers || 1000);
      const maxFollowers = Number(req.query.maxFollowers || 1000000);
      let channels;
      
      if (searchTerm) {
        channels = getSuggestedChannelsBySearchTerm(searchTerm);
      } else {
        channels = listSuggestedChannels();
      }

      // Apply followers filter (include nulls only if no bounds provided)
      const filtered = channels.filter((c) => {
        const count = typeof c.followersCount === 'number' ? c.followersCount : (
          c.followersCount != null ? Number(c.followersCount) : null
        );
        if (count == null) return false; // exclude unknown follower counts when filtering
        if (!Number.isFinite(count)) return false;
        return count >= minFollowers && count <= maxFollowers;
      });
      
      res.json(filtered);
    } catch (error) {
      console.error('Error fetching suggested channels:', error);
      res.status(500).json({ error: 'Failed to fetch suggested channels' });
    }
  });

  app.delete('/api/suggested-channels/:id', (req, res) => {
    try {
      removeSuggestedChannel(req.params.id);
      res.json({ ok: true });
    } catch (error) {
      console.error('Error removing suggested channel:', error);
      res.status(500).json({ error: 'Failed to remove suggested channel' });
    }
  });

  // Channel dashboard data
  app.get('/api/channels/:id/dashboard', (req, res) => {
    try {
      const channelId = req.params.id;
      const ch = getChannel(channelId);
      if (!ch) return res.status(404).json({ error: 'not found' });
      const days = Number(req.query.days || DEFAULT_DAYS);
      const viralMultiplier = Number(req.query.viralMultiplier || 5);
      let viralMethod = 'subscribers';
      try {
        const gc = getSetting('globalCriteria');
        if (gc) {
          const parsed = JSON.parse(gc);
          if (parsed.viralMethod === 'avgViews' || parsed.viralMethod === 'subscribers') {
            viralMethod = parsed.viralMethod;
          }
        }
      } catch {}
      const likeWeight = Number(req.query.likeWeight || 150);
      const commentWeight = Number(req.query.commentWeight || 500);
      const excludeCta = (req.query.hideCta != null)
        ? (req.query.hideCta === '1' || req.query.hideCta === 'true')
        : (() => { try { const gc = getSetting('globalCriteria'); if (gc) return !!JSON.parse(gc)?.hideCta; } catch {}; return false; })();
      const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const trends = getChannelTrends({ channelId, sinceIso });
      const top = getTopVideos({ channelId, sinceIso, likeWeight, commentWeight, excludeCta });
      const special = getSpecialVideos({ channelId, avgViews: ch.avgViews, subscriberCount: ch.subscriberCount, viralMethod, sinceIso, viralMultiplier, excludeCta });
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
    const excludeCta = (req.query.hideCta != null)
      ? (req.query.hideCta === '1' || req.query.hideCta === 'true')
      : (() => { try { const gc = getSetting('globalCriteria'); if (gc) return !!JSON.parse(gc)?.hideCta; } catch {}; return false; })();
    const { rows, total } = queryVideosAdvanced({ sinceIso, channelId, sort: 'engagement', order, page, pageSize, likeWeight, commentWeight, excludeCta });
    res.json({ total, page, pageSize, rows });
  });

  // Job management routes
  app.get('/api/jobs', (req, res) => {
    try {
      const limit = Math.min(200, Number(req.query.limit || 50));
      const offset = Number(req.query.offset || 0);
      const result = listJobs({ limit, offset });
      
      // Add real-time progress data for running jobs
      result.jobs = result.jobs.map(job => {
        if (job.status === 'running') {
          const progress = queueManager.getJobProgress(job.id);
          if (progress) {
            return {
              ...job,
              current_step: progress.currentStep,
              progress_current: progress.progressCurrent,
              progress_total: progress.progressTotal
            };
          }
        }
        return job;
      });
      
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message || 'Failed to fetch jobs' });
    }
  });

  app.get('/api/jobs/:id', (req, res) => {
    try {
      const jobId = Number(req.params.id);
      if (isNaN(jobId)) return res.status(400).json({ error: 'Invalid job ID' });
      
      const job = getJobStatus(jobId);
      if (!job) return res.status(404).json({ error: 'Job not found' });
      
      // Add real-time progress data if job is running
      if (job.status === 'running') {
        const progress = queueManager.getJobProgress(jobId);
        if (progress) {
          job.current_step = progress.currentStep;
          job.progress_current = progress.progressCurrent;
          job.progress_total = progress.progressTotal;
        }
      }
      // Pass-through includes is_initial_scrape from DB
      
      res.json(job);
    } catch (error) {
      res.status(500).json({ error: error.message || 'Failed to fetch job' });
    }
  });

  app.get('/api/queue/status', (req, res) => {
    res.json({
      isProcessing: queueManager.isCurrentlyProcessing(),
      currentJobId: queueManager.getCurrentJobId()
    });
  });

  // Manual schedule trigger endpoint (disabled / not in use)
  // app.post('/api/schedule/trigger', async (req, res) => {
  //   try {
  //     await triggerScheduledSync();
  //     res.json({ ok: true, message: 'Scheduled sync triggered successfully' });
  //   } catch (error) {
  //     res.status(500).json({ error: error.message || 'Failed to trigger scheduled sync' });
  //   }
  // });

  // Topics API endpoints
  app.get('/api/topics', (req, res) => {
    try {
      const stats = getTopicStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: error.message || 'Failed to fetch topic statistics' });
    }
  });

  app.get('/api/topics/:topicName/videos', (req, res) => {
    try {
      const topicName = req.params.topicName;
      const page = Number(req.query.page || 1);
      const pageSize = Math.min(200, Number(req.query.pageSize || 50));
      const excludeCta = (req.query.hideCta != null)
        ? (req.query.hideCta === '1' || req.query.hideCta === 'true')
        : (() => { try { const gc = getSetting('globalCriteria'); if (gc) return !!JSON.parse(gc)?.hideCta; } catch {}; return false; })();

      const result = getVideosByTopic(topicName, { page, pageSize, excludeCta });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message || 'Failed to fetch videos for topic' });
    }
  });

  app.get('/api/topics/ranking', (req, res) => {
    try {
      // Get all topics with their stats
      const topicStats = getTopicStats();
      
      // Use the topic ranking algorithm to sort by engagement impact
      const rankedTopics = getTopicRanking(topicStats.topics);
      
      res.json({
        totalTopics: topicStats.totalTopics,
        totalAssociations: topicStats.totalAssociations,
        rankedTopics
      });
    } catch (error) {
      res.status(500).json({ error: error.message || 'Failed to fetch topic rankings' });
    }
  });

  app.get('/api/topics/graph', (req, res) => {
    try {
      // Get maxNodes from query parameter, default to 10, max 50
      const maxNodes = Math.min(Math.max(parseInt(req.query.maxNodes) || 10, 1), 500);
      const excludeCta = (req.query.hideCta != null)
        ? (req.query.hideCta === '1' || req.query.hideCta === 'true')
        : (() => { try { const gc = getSetting('globalCriteria'); if (gc) return !!JSON.parse(gc)?.hideCta; } catch {}; return false; })();
      
      // Get the topic graph data (now returns { topics, relationships })
      const { topics: topicObjects, relationships: calculatedRelationships } = getTopicGraph(10, 1, maxNodes, excludeCta);
      
      // Define 20 good colors for categories
      const categoryColors = [
        "#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6",
        "#1abc9c", "#34495e", "#e67e22", "#8e44ad", "#16a085",
        "#27ae60", "#2980b9", "#f1c40f", "#d35400", "#c0392b",
        "#7f8c8d", "#17a2b8", "#6f42c1", "#fd7e14", "#20c997"
      ];
      
      // Helper function to determine topic category based on connections
      const getCategoryForTopic = (topic) => {
        if (topic.isCategory) {
          return topic.name; // Categories are their own category
        }
        
        // Find high-strength connections to actual categories only
        const categoryConnections = topic.connections
          .filter(conn => 
            conn.weight > CATEGORY_THRESHOLD && // Greater than threshold connection
            conn.topic.isCategory  // Connected topic must be a category
          )
          .sort((a, b) => b.weight - a.weight);
        
        if (categoryConnections.length > 0) {
          // Return the first category this topic is connected to
          return categoryConnections[0].topic.name;
        }
        
        return "General"; // Default fallback
      };

      // Get all unique categories and assign colors
      const allCategories = [...new Set(topicObjects.map(topic => getCategoryForTopic(topic)))];
      const categoryColorMap = {};
      allCategories.forEach((category, index) => {
        if (category === "General") {
          categoryColorMap[category] = "#6b7280"; // Grey color for General
        } else {
          categoryColorMap[category] = categoryColors[index % categoryColors.length];
        }
      });

        // Transform data to match frontend expectations using smart categorization
        const topics = topicObjects.map((topic, index) => {
          const category = getCategoryForTopic(topic);
          return {
            id: index + 1,
            topic: topic.name, // Frontend expects 'topic' instead of 'name'
            engagementMultiplier: topic.engagementMultiplier || 1,
            videoCount: topic.videos.length,
            category: category,
            categoryColor: categoryColorMap[category],
            group: topic.isCategory ? `category-${topic.name.toLowerCase().replace(/\s+/g, '-')}` : `${category.toLowerCase()}-topic`,
            isCategory: topic.isCategory || false,
            incomingCategoryConnections: topic.incomingCategoryConnections || [],
            description: topic.isCategory 
              ? `Category topic with ${topic.incomingCategoryConnections.length} sub-topics`
              : `${topic.name} content with ${topic.videos.length} videos`,
            topVideos: topic.topVideos,
            // Include directional connections for selected topic views
            outgoingConnections: topic.connections.map(conn => ({
              targetTopic: conn.topic.name,
              strength: conn.weight
            }))
          };
        });
      
      // Use the pre-calculated relationships and adjust IDs to be 1-based
      const relationships = calculatedRelationships.map(rel => ({
        source: rel.source + 1,  // Convert to 1-based indexing for frontend
        target: rel.target + 1,
        strength: rel.maxStrength,  // Use max strength for visual display
        forwardStrength: rel.forwardStrength,  // Available for directional analysis
        reverseStrength: rel.reverseStrength,  // Available for directional analysis
        label: rel.label
      }));
      
      res.json({
        topics,
        relationships
      });
    } catch (error) {
      console.error('Error in /api/topics/graph:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch topic graph' });
    }
  });

  // Audio processing API endpoints
  app.get('/api/audio/status', (req, res) => {
    try {
      const videosNeedingAudio = getVideosNeedingAudioProcessing();
      const videosNeedingTranscription = getVideosNeedingTranscription();
      
      res.json({
        videosNeedingAudio: videosNeedingAudio.length,
        videosNeedingTranscription: videosNeedingTranscription.length,
        pendingAudio: videosNeedingAudio,
        pendingTranscription: videosNeedingTranscription
      });
    } catch (error) {
      res.status(500).json({ error: error.message || 'Failed to fetch audio status' });
    }
  });

  app.post('/api/audio/process', async (req, res) => {
    try {
      console.log('Starting audio processing...');
      const result = await processAudioDownloads();
      res.json({ 
        ok: true, 
        message: `Audio processing completed: ${result.processed}/${result.total} videos processed`,
        ...result
      });
    } catch (error) {
      console.error('Error in audio processing:', error);
      res.status(500).json({ error: error.message || 'Failed to process audio' });
    }
  });

  app.post('/api/transcriptions/process', async (req, res) => {
    try {
      console.log('Starting transcription processing...');
      const result = await processTranscriptions();
      res.json({ 
        ok: true, 
        message: `Transcription processing completed: ${result.processed}/${result.total} videos processed`,
        ...result
      });
    } catch (error) {
      console.error('Error in transcription processing:', error);
      res.status(500).json({ error: error.message || 'Failed to process transcriptions' });
    }
  });

  // Settings API endpoints
  app.get('/api/settings', (req, res) => {
    try {
      const settings = getSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: error.message || 'Failed to fetch settings' });
    }
  });

  app.post('/api/settings', (req, res) => {
    try {
      const { settings } = req.body;
      if (!settings || typeof settings !== 'object') {
        return res.status(400).json({ error: 'Invalid settings object' });
      }

      // Save each setting individually
      Object.entries(settings).forEach(([key, value]) => {
        setSetting(key, JSON.stringify(value));
      });

      res.json({ ok: true, message: 'Settings saved successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message || 'Failed to save settings' });
    }
  });

  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });

  return app;
}

createServer();


