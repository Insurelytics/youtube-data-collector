import fs from 'node:fs';
import { google } from 'googleapis';
import Instructor from "@instructor-ai/instructor";
import OpenAI from "openai";
import { z } from "zod";

const SHEET_HEADER = ['Company Name', 'Front Man', 'IG Handle', 'Followers', 'Notes'];

const ChannelInfoSchema = z.object({
  companyName: z.string().describe("The company or brand name. Empty string if can't determine from the channel name and bio."),
  frontMan: z.string().describe("The front man or main person representing the channel/company. Empty string if can't determine from the channel name and bio."),
  humanReadableIdentifier: z.string().describe("A simplified identifier for the channel/company. Must not be an empty string. Must be all CAPS, preferably 2-3 words, and easily match to the channel name, company name, and/or front man name.")
});

let aiClient = null;
function getAIClient() {
  if (!aiClient && process.env.OPENAI_API_KEY) {
    const oai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      organization: process.env.OPENAI_ORG_ID ?? undefined
    });
    aiClient = Instructor({
      client: oai,
      mode: "FUNCTIONS"
    });
  }
  return aiClient;
}

async function extractChannelInfo(channelName, bio) {
  const client = getAIClient();
  if (!client) {
    console.warn('[AI] OpenAI API key not configured, skipping AI extraction');
    const fallbackId = (channelName || '').toString().trim().toUpperCase() || 'CHANNEL';
    return { companyName: '', frontMan: '', humanReadableIdentifier: fallbackId };
  }
  
  try {
    const result = await client.chat.completions.create({
      messages: [{ 
        role: "user", 
        content: `Given this channel information, identify the company name and front man (main person). Set to "" if you can't tell from this info.

Channel Name: ${channelName}
Bio: ${bio || 'N/A'}`
      }],
      model: "gpt-4.1-mini",
      response_model: { 
        schema: ChannelInfoSchema, 
        name: "ChannelInfo"
      }
    });
    console.log('[AI] Channel info extracted:', result);
    return result;
  } catch (error) {
    console.error('[AI] Failed to extract channel info:', error);
    const fallbackId = (channelName || '').toString().trim().toUpperCase() || 'CHANNEL';
    return { companyName: '', frontMan: '', humanReadableIdentifier: fallbackId };
  }
}

function formatFollowers(n) {
  if (n == null || isNaN(Number(n))) return '';
  const num = Number(n);
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
  return String(num);
}

async function getAuthenticatedSheetsClient() {
  let credentials = null;
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON) {
    try { credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON); } catch {}
  }
  if (!credentials && process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH) {
    const text = fs.readFileSync(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH, 'utf8');
    credentials = JSON.parse(text);
  }
  if (!credentials) throw new Error('Missing service account credentials');

  const jwt = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: [ 'https://www.googleapis.com/auth/spreadsheets' ]
  });
  await jwt.authorize();
  return google.sheets({ version: 'v4', auth: jwt });
}

async function addHeaderIfNeeded(sheets, spreadsheetId) {
  const getRes = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'A1:E1000' });
  const values = getRes?.data?.values || [];
  const hasHeader = values.some(r => JSON.stringify((r || []).slice(0, 5).map(x => (x || '').trim())) === JSON.stringify(SHEET_HEADER));
  
  if (!hasHeader) {
    const headerAppend = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'A1',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [SHEET_HEADER] }
    });
    try {
      const meta = await sheets.spreadsheets.get({ spreadsheetId, includeGridData: false });
      const sheetsListMeta = meta?.data?.sheets || [];
      const firstSheetId = sheetsListMeta[0]?.properties?.sheetId;
      const firstSheetTitle = sheetsListMeta[0]?.properties?.title;
      const parseA1 = (a1) => {
        if (!a1 || typeof a1 !== 'string') return null;
        const m = a1.match(/^([^!]+)!([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
        if (!m) return null;
        const sheetTitle = m[1];
        const startRow = parseInt(m[3], 10);
        const endRow = parseInt(m[5], 10);
        const colToIndex = (col) => col.split('').reduce((acc, ch) => acc * 26 + (ch.charCodeAt(0) - 64), 0) - 1;
        return {
          sheetTitle,
          startRowIndex: Math.max(0, startRow - 1),
          endRowIndex: endRow,
          startColumnIndex: colToIndex(m[2]),
          endColumnIndex: colToIndex(m[4]) + 1
        };
      };
      const findSheetIdByTitle = (title) => {
        const s = sheetsListMeta.find(x => x?.properties?.title === title);
        return s?.properties?.sheetId ?? firstSheetId;
      };
      const requests = [];
      if (firstSheetId != null) {
        const base = 100;
        const sizes = [
          Math.round(2.0 * base),
          Math.round(1.5 * base),
          Math.round(2.0 * base),
          Math.round(1.5 * base),
          Math.round(5.0 * base),
        ];
        const resizeReqs = sizes.map((px, idx) => ({
          updateDimensionProperties: {
            range: {
              sheetId: firstSheetId,
              dimension: 'COLUMNS',
              startIndex: idx,
              endIndex: idx + 1,
            },
            properties: { pixelSize: px },
            fields: 'pixelSize',
          }
        }));
        requests.push(...resizeReqs);
      }
      const headerUpdatedRangeA1 = headerAppend?.data?.updates?.updatedRange;
      const headerParsed = parseA1(headerUpdatedRangeA1);
      const addWrapRequest = (parsed) => {
        if (!parsed) return;
        const sheetId = findSheetIdByTitle(parsed.sheetTitle || firstSheetTitle);
        if (sheetId == null) return;
        requests.push({
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: parsed.startRowIndex,
              endRowIndex: parsed.endRowIndex,
              startColumnIndex: 0,
              endColumnIndex: 5,
            },
            cell: { userEnteredFormat: { wrapStrategy: 'WRAP' } },
            fields: 'userEnteredFormat.wrapStrategy'
          }
        });
      };
      addWrapRequest(headerParsed);
      // Ensure header is bold and data rows are not bold
      if (headerParsed) {
        const sheetId = findSheetIdByTitle(headerParsed.sheetTitle || firstSheetTitle);
        if (sheetId != null) {
          // Bold header row (A1:E1)
          requests.push({
            repeatCell: {
              range: {
                sheetId,
                startRowIndex: headerParsed.startRowIndex,
                endRowIndex: headerParsed.endRowIndex,
                startColumnIndex: 0,
                endColumnIndex: 5,
              },
              cell: { userEnteredFormat: { textFormat: { bold: true } } },
              fields: 'userEnteredFormat.textFormat.bold'
            }
          });
          // Set non-header rows (A2:E1000) to not bold
          requests.push({
            repeatCell: {
              range: {
                sheetId,
                startRowIndex: headerParsed.startRowIndex + 1,
                endRowIndex: headerParsed.startRowIndex + 1000,
                startColumnIndex: 0,
                endColumnIndex: 5,
              },
              cell: { userEnteredFormat: { textFormat: { bold: false } } },
              fields: 'userEnteredFormat.textFormat.bold'
            }
          });
        }
      }
      if (requests.length) {
        await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
      }
    } catch (_) {
      // Ignore column resizing errors
    }
    return { added: true, range: headerAppend?.data?.updates?.updatedRange || null };
  }
  
  return { added: false };
}

async function getExistingLinks(sheets, spreadsheetId) {
  const getRes = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'A1:E1000' });
  const values = getRes?.data?.values || [];
  return new Set(
    values
      .map(r => (Array.isArray(r) && r.length >= 3 ? String(r[2] || '') : ''))
      .map(s => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function registerDriveRoutes(app, { getWorkspace, updateWorkspaceSpreadsheetId, updateWorkspaceDriveFolderId, getChannel, listChannels }) {
  
  app.get('/api/drive/service-email', (req, res) => {
    try {
      let email = null;
      const impersonate = process.env.GOOGLE_IMPERSONATE_USER || null;
      if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON) {
        try {
          const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON);
          email = creds.client_email || null;
        } catch {}
      }
      if (!email && process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH) {
        try {
          const text = fs.readFileSync(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH, 'utf8');
          const creds = JSON.parse(text);
          email = creds.client_email || null;
        } catch {}
      }
      res.json({ email, impersonate });
    } catch (e) {
      res.status(500).json({ error: 'Failed to resolve service email' });
    }
  });

  app.get('/api/drive/check-share', async (req, res) => {
    try {
      const folderId = (req.query.folderId || '').toString();
      if (!folderId) return res.status(400).json({ error: 'folderId required' });

      let credentials = null;
      if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON) {
        try { credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON); } catch {}
      }
      if (!credentials && process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH) {
        const text = fs.readFileSync(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH, 'utf8');
        credentials = JSON.parse(text);
      }
      if (!credentials) return res.status(400).json({ error: 'Missing service account credentials' });

      const jwt = new google.auth.JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: [
          'https://www.googleapis.com/auth/drive.readonly',
          'https://www.googleapis.com/auth/drive.metadata.readonly'
        ]
      });
      await jwt.authorize();
      const drive = google.drive({ version: 'v3', auth: jwt });

      try {
        await drive.files.get({ fileId: folderId, fields: 'id, name', supportsAllDrives: true });
        return res.json({ shared: true });
      } catch (err) {
        return res.json({ shared: false });
      }
    } catch (e) {
      res.status(500).json({ error: e?.message || 'Failed to check share' });
    }
  });

  app.get('/api/drive/folder-info', async (req, res) => {
    try {
      const folderId = (req.query.folderId || '').toString();
      if (!folderId) return res.status(400).json({ error: 'folderId required' });

      let credentials = null;
      if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON) {
        try { credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON); } catch {}
      }
      if (!credentials && process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH) {
        const text = fs.readFileSync(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH, 'utf8');
        credentials = JSON.parse(text);
      }
      if (!credentials) return res.status(400).json({ error: 'Missing service account credentials' });

      const jwt = new google.auth.JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: [
          'https://www.googleapis.com/auth/drive.readonly',
          'https://www.googleapis.com/auth/drive.metadata.readonly'
        ]
      });
      await jwt.authorize();
      const drive = google.drive({ version: 'v3', auth: jwt });

      const meta = await drive.files.get({ fileId: folderId, fields: 'id, name', supportsAllDrives: true });
      const list = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        pageSize: 10,
        fields: 'files(id, name, mimeType)',
        includeItemsFromAllDrives: true,
        supportsAllDrives: true
      });

      res.json({
        id: folderId,
        name: meta?.data?.name || null,
        files: (list?.data?.files || []).map(f => ({ id: f.id, name: f.name, mimeType: f.mimeType }))
      });
    } catch (e) {
      res.status(500).json({ error: e?.message || 'Failed to fetch folder info' });
    }
  });

  app.post('/api/drive/create-spreadsheet', async (req, res) => {
    try {
      const body = req.body || {};
      let folderId = (body.folderId || '').toString();
      const title = (body.title || 'Channel Data').toString();

      if (!folderId) {
        const ws = getWorkspace(req.workspaceId);
        folderId = (ws && ws.driveFolderId) ? String(ws.driveFolderId) : '';
      }
      console.info('[drive] create-spreadsheet request', {
        workspaceId: req.workspaceId,
        providedFolderId: (body.folderId || null),
        resolvedFolderId: folderId,
        title
      });
      if (!folderId) return res.status(400).json({ error: 'driveFolderId not set for workspace and not provided' });

      let credentials = null;
      if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON) {
        try { credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON); } catch {}
      }
      if (!credentials && process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH) {
        const text = fs.readFileSync(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH, 'utf8');
        credentials = JSON.parse(text);
      }
      if (!credentials) return res.status(400).json({ error: 'Missing service account credentials' });

      console.info('[drive] using service account', { serviceEmail: credentials?.client_email || null });
      const jwtOptions = {
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: [
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/spreadsheets'
        ]
      };
      if (process.env.GOOGLE_IMPERSONATE_USER) {
        jwtOptions.subject = process.env.GOOGLE_IMPERSONATE_USER;
        console.info('[drive] impersonating user for creation', { subject: jwtOptions.subject });
      }
      const jwt = new google.auth.JWT(jwtOptions);
      await jwt.authorize();

      const drive = google.drive({ version: 'v3', auth: jwt });
      const sheets = google.sheets({ version: 'v4', auth: jwt });

      const createRes = await drive.files.create({
        requestBody: {
          name: title,
          mimeType: 'application/vnd.google-apps.spreadsheet',
          parents: [folderId]
        },
        fields: 'id, name, parents',
        supportsAllDrives: true
      });
      const fileId = createRes?.data?.id;
      console.info('[drive] created file response', { id: fileId, name: createRes?.data?.name, parents: createRes?.data?.parents });
      if (!fileId) return res.status(500).json({ error: 'Failed to create spreadsheet' });

      try {
        const createdMeta = await drive.files.get({ fileId, fields: 'id, parents', supportsAllDrives: true });
        const parents = createdMeta?.data?.parents || [];
        console.info('[drive] created file parents check', { id: fileId, parents, expectedParent: folderId });
        if (!parents.includes(folderId)) {
          const upd = await drive.files.update({ fileId, addParents: folderId, supportsAllDrives: true, fields: 'id, parents' });
          console.info('[drive] added parent to file', { id: fileId, parents: upd?.data?.parents });
        }
      } catch {}

      await sheets.spreadsheets.values.update({
        spreadsheetId: fileId,
        range: 'A1:D1',
        valueInputOption: 'RAW',
        requestBody: { values: [[ 'Channel', 'Company Name', 'Instagram Handle', 'Follower Count' ]] }
      });

      res.json({ ok: true, spreadsheetId: fileId, name: createRes?.data?.name });
    } catch (e) {
      const err = e;
      const errorInfo = {
        message: err?.message || String(err),
        code: err?.code || err?.response?.status,
        statusText: err?.response?.statusText,
        errors: err?.errors || err?.response?.data || err?.response?.data?.error || null
      };
      console.error('[drive] create-spreadsheet error', errorInfo);
      res.status(500).json({ error: errorInfo.message });
    }
  });

  app.get('/api/drive/check-sheet', async (req, res) => {
    try {
      const spreadsheetId = (req.query.id || '').toString();
      if (!spreadsheetId) return res.status(400).json({ error: 'id required' });

      let credentials = null;
      if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON) {
        try { credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON); } catch {}
      }
      if (!credentials && process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH) {
        const text = fs.readFileSync(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH, 'utf8');
        credentials = JSON.parse(text);
      }
      if (!credentials) return res.status(400).json({ error: 'Missing service account credentials' });

      const jwt = new google.auth.JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: [ 'https://www.googleapis.com/auth/spreadsheets.readonly' ]
      });
      await jwt.authorize();
      const sheets = google.sheets({ version: 'v4', auth: jwt });
      const meta = await sheets.spreadsheets.get({ spreadsheetId, includeGridData: false });
      return res.json({ ok: true, title: meta?.data?.properties?.title || null });
    } catch (e) {
      res.status(500).json({ error: e?.message || 'Failed to check sheet' });
    }
  });

  app.get('/api/drive/sheet-info', async (req, res) => {
    try {
      const spreadsheetId = (req.query.id || '').toString();
      if (!spreadsheetId) return res.status(400).json({ error: 'id required' });

      let credentials = null;
      if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON) {
        try { credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON); } catch {}
      }
      if (!credentials && process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH) {
        const text = fs.readFileSync(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH, 'utf8');
        credentials = JSON.parse(text);
      }
      if (!credentials) return res.status(400).json({ error: 'Missing service account credentials' });

      const jwt = new google.auth.JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: [ 'https://www.googleapis.com/auth/spreadsheets.readonly' ]
      });
      await jwt.authorize();
      const sheets = google.sheets({ version: 'v4', auth: jwt });
      const meta = await sheets.spreadsheets.get({ spreadsheetId, includeGridData: false });
      const title = meta?.data?.properties?.title || null;
      const sheetsList = (meta?.data?.sheets || []).map(s => s?.properties?.title).filter(Boolean);
      res.json({ id: spreadsheetId, title, sheets: sheetsList });
    } catch (e) {
      res.status(500).json({ error: e?.message || 'Failed to fetch sheet info' });
    }
  });

  app.post('/api/drive/add-channel', async (req, res) => {
    try {
      const { channelId } = req.body || {};
      if (!channelId) return res.status(400).json({ error: 'channelId required' });

      const ws = getWorkspace(req.workspaceId);
      const spreadsheetId = ws && ws.spreadsheetId ? String(ws.spreadsheetId) : '';
      if (!spreadsheetId) return res.status(400).json({ error: 'spreadsheetId not set for workspace' });

      const sheets = await getAuthenticatedSheetsClient();
      const headerResult = await addHeaderIfNeeded(sheets, spreadsheetId);
      const existingLinks = await getExistingLinks(sheets, spreadsheetId);

      const channel = getChannel(channelId);
      if (!channel) return res.status(404).json({ error: 'Channel not found' });

      const companyName = channel.title || channel.channelName || '-';
      const handle = (channel.handle || '').toString().replace(/^@+/, '');
      let igLink = '-';
      if (handle) {
        if ((channel.platform || '').toLowerCase() === 'instagram') {
          igLink = `https://www.instagram.com/${handle}`;
        } else {
          igLink = `https://www.youtube.com/@${handle}`;
        }
      }

      const linkLower = igLink.trim().toLowerCase();
      const getRes = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'A1:E1000' });
      const values = getRes?.data?.values || [];
      let foundRowIndex = -1;
      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        const link = (row[2] || '').toString().trim().toLowerCase();
        if (link === linkLower) {
          foundRowIndex = i;
          break;
        }
      }
      const newFollowers = formatFollowers(typeof channel.subscriberCount === 'number' ? channel.subscriberCount : null);
      if (foundRowIndex !== -1) {
        const currentRow = values[foundRowIndex];
        const currentFollowers = (currentRow[3] || '').toString().trim();
        if (currentFollowers !== newFollowers) {
          const rowNum = foundRowIndex + 1;
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `D${rowNum}`,
            valueInputOption: 'RAW',
            requestBody: { values: [[newFollowers]] }
          });
          return res.json({ ok: true, updated: true, followersUpdated: true });
        } else {
          return res.json({ ok: true, added: false, message: 'Channel already exists with current subscribers' });
        }
      } else {
        // If this is the first channel row (row 2), sanity check there is only one sheet
        if (values.length <= 1) {
          const meta = await sheets.spreadsheets.get({ spreadsheetId, includeGridData: false });
          const sheetsCount = (meta?.data?.sheets || []).length;
          // TODO: Make this first-channel sheet integrity check more robust for future versions
          if (sheetsCount > 1) {
            return res.status(400).json({ error: 'Spreadsheet corrupted: unexpected extra sheet. Please contact the simplarity AI team.' });
          }
        }

        const channelInfo = await extractChannelInfo(channel.title || channel.channelName || '', channel.biography || '');
        const row = [
          channelInfo.companyName || channelInfo.frontMan || '',
          channelInfo.frontMan || '',
          igLink,
          newFollowers,
          ''
        ];
        const appendRes = await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: 'A1',
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          requestBody: { values: [row] }
        });
        // Best-effort: unbold the newly added row after a brief delay if it inherited bold formatting
        try {
          await new Promise(resolve => setTimeout(resolve, 500));
          const updatedRange = appendRes?.data?.updates?.updatedRange;
          if (typeof updatedRange === 'string') {
            // Parse A1 range like: Sheet1!A10:E10
            const m = updatedRange.match(/^([^!]+)!([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
            if (m) {
              const sheetTitle = m[1];
              const startRow = Math.max(0, parseInt(m[3], 10) - 1);
              const endRow = Math.max(startRow + 1, parseInt(m[5], 10));
              const meta = await sheets.spreadsheets.get({ spreadsheetId, includeGridData: false });
              const sheet = (meta?.data?.sheets || []).find(s => s?.properties?.title === sheetTitle);
              const sheetId = sheet?.properties?.sheetId;
              if (sheetId != null) {
                await sheets.spreadsheets.batchUpdate({
                  spreadsheetId,
                  requestBody: {
                    requests: [
                      {
                        repeatCell: {
                          range: {
                            sheetId,
                            startRowIndex: startRow,
                            endRowIndex: endRow,
                            startColumnIndex: 0,
                            endColumnIndex: 5,
                          },
                          cell: { userEnteredFormat: { textFormat: { bold: false } } },
                          fields: 'userEnteredFormat.textFormat.bold'
                        }
                      }
                    ]
                  }
                });
              }
            }
          }
        } catch (_) {
          // ignore formatting errors
        }

        // Create reels sheet named exactly as humanReadableIdentifier and add styled header
        const reelsTitle = (channelInfo && channelInfo.humanReadableIdentifier) ? String(channelInfo.humanReadableIdentifier) : 'CHANNEL';
        try {
          const addSheetRes = await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
              requests: [
                { addSheet: { properties: { title: reelsTitle } } }
              ]
            }
          });
          const added = addSheetRes?.data?.replies?.[0]?.addSheet?.properties;
          const reelsSheetId = added?.sheetId;
          // Write header
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${reelsTitle}!A1:D1`,
            valueInputOption: 'RAW',
            requestBody: { values: [[ 'LINK', 'VIEWS', 'HOOK', 'NOTES' ]] }
          });
          // Apply black background with white text for header A1:D1 and resize columns
          if (reelsSheetId != null) {
            const base = 100;
            const sizes = [
              Math.round(2.0 * base),  // LINK: 200
              Math.round(1.0 * base),  // VIEWS: 100
              Math.round(1.5 * base),  // HOOK: 150
              Math.round(3.0 * base),  // NOTES: 300
            ];
            const resizeReqs = sizes.map((px, idx) => ({
              updateDimensionProperties: {
                range: {
                  sheetId: reelsSheetId,
                  dimension: 'COLUMNS',
                  startIndex: idx,
                  endIndex: idx + 1,
                },
                properties: { pixelSize: px },
                fields: 'pixelSize',
              }
            }));
            await sheets.spreadsheets.batchUpdate({
              spreadsheetId,
              requestBody: {
                requests: [
                  ...resizeReqs,
                  {
                    repeatCell: {
                      range: {
                        sheetId: reelsSheetId,
                        startRowIndex: 0,
                        endRowIndex: 1,
                        startColumnIndex: 0,
                        endColumnIndex: 4,
                      },
                      cell: { userEnteredFormat: {
                        backgroundColor: { red: 0, green: 0, blue: 0 },
                        textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 } }
                      } },
                      fields: 'userEnteredFormat(backgroundColor,textFormat.foregroundColor)'
                    }
                  }
                ]
              }
            });
          }
        } catch (err) {
          // If reels sheet creation fails, return error to the frontend
          return res.status(500).json({ error: err?.message || 'Failed to create reels sheet' });
        }

        return res.json({ 
          ok: true, 
          added: true, 
          headerAdded: headerResult.added,
          range: appendRes?.data?.updates?.updatedRange || null 
        });
      }
    } catch (e) {
      res.status(500).json({ error: e?.message || 'Failed to add channel to spreadsheet' });
    }
  });

  app.post('/api/workspaces/current/spreadsheet', (req, res) => {
    try {
      const { spreadsheetId } = req.body || {};
      if (!spreadsheetId || typeof spreadsheetId !== 'string') {
        return res.status(400).json({ error: 'spreadsheetId required' });
      }
      const ws = getWorkspace(req.workspaceId);
      if (!ws) return res.status(404).json({ error: 'Workspace not found' });
      updateWorkspaceSpreadsheetId(req.workspaceId, spreadsheetId);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e?.message || 'Failed to update spreadsheet id' });
    }
  });

  app.post('/api/workspaces/current/drive-folder', (req, res) => {
    try {
      const { driveFolderId } = req.body || {};
      if (!driveFolderId || typeof driveFolderId !== 'string') {
        return res.status(400).json({ error: 'driveFolderId required' });
      }
      const ws = getWorkspace(req.workspaceId);
      if (!ws) return res.status(404).json({ error: 'Workspace not found' });
      updateWorkspaceDriveFolderId(req.workspaceId, driveFolderId);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e?.message || 'Failed to update drive folder id' });
    }
  });

  app.post('/api/drive/add-reel', async (req, res) => {
    try {
      const { channelId, videoLink, viewCount } = req.body || {};
      if (!channelId) return res.status(400).json({ error: 'channelId required' });
      if (!videoLink) return res.status(400).json({ error: 'videoLink required' });

      const ws = getWorkspace(req.workspaceId);
      const spreadsheetId = ws && ws.spreadsheetId ? String(ws.spreadsheetId) : '';
      if (!spreadsheetId) return res.status(400).json({ error: 'spreadsheetId not set for workspace' });

      const sheets = await getAuthenticatedSheetsClient();
      const channel = getChannel(channelId);
      if (!channel) return res.status(404).json({ error: 'Channel not found' });

      const handle = (channel.handle || '').toString().replace(/^@+/, '');
      let igLink = '';
      if (handle) {
        if ((channel.platform || '').toLowerCase() === 'instagram') {
          igLink = `https://www.instagram.com/${handle}`;
        } else {
          igLink = `https://www.youtube.com/@${handle}`;
        }
      }

      // Find channel in first sheet by matching IG handle
      const getRes = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'A1:E1000' });
      const values = getRes?.data?.values || [];
      let channelRowIndex = -1;
      const igLinkLower = igLink.trim().toLowerCase();
      
      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        const link = (row[2] || '').toString().trim().toLowerCase();
        if (link === igLinkLower) {
          channelRowIndex = i;
          break;
        }
      }

      if (channelRowIndex === -1) {
        return res.status(404).json({ error: 'Channel not found in spreadsheet. Please add the channel first.' });
      }

      // Get all sheets to find the target sheet by index
      const meta = await sheets.spreadsheets.get({ spreadsheetId, includeGridData: false });
      const sheetsList = (meta?.data?.sheets || []);
      
      // Row index to sheet index mapping: row 2 (index 1) -> sheet index 1, etc.
      const targetSheetIndex = channelRowIndex;
      if (targetSheetIndex >= sheetsList.length) {
        return res.status(404).json({ error: 'Reels sheet not found for this channel' });
      }

      const targetSheet = sheetsList[targetSheetIndex];
      const sheetTitle = targetSheet?.properties?.title;
      if (!sheetTitle) {
        return res.status(404).json({ error: 'Invalid reels sheet' });
      }

      let normalizedLink = videoLink.toString().trim();
      if (normalizedLink.endsWith('/')) {
        normalizedLink = normalizedLink.slice(0, -1);
      }

      // Add reel to the sheet
      const views = formatFollowers(typeof viewCount === 'number' ? viewCount : null);
      const row = [normalizedLink, views, '', ''];

      // Prevent duplicates: check if videoLink already exists in column A
      const videoLinkLower = normalizedLink.toLowerCase();
      const existingReelsRes = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${sheetTitle}!A1:B10000` });
      const reelValues = existingReelsRes?.data?.values || [];
      let existingRowIndex = -1;
      for (let i = 1; i < reelValues.length; i++) {
        const r = reelValues[i];
        let existingLink = (r?.[0] || '').toString().trim();
        if (existingLink.endsWith('/')) {
          existingLink = existingLink.slice(0, -1);
        }
        const link = existingLink.toLowerCase();
        if (link === videoLinkLower) { existingRowIndex = i; break; }
      }
      if (existingRowIndex !== -1) {
        const currentRow = reelValues[existingRowIndex] || [];
        const currentViews = (currentRow[1] || '').toString().trim();
        if (currentViews !== views) {
          const rowNum = existingRowIndex + 1;
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${sheetTitle}!B${rowNum}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [[views]] }
          });
          return res.json({ 
            ok: true, 
            updated: true, 
            viewsUpdated: true, 
            sheetTitle, 
            spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${targetSheet.properties.sheetId}` 
          });
        }
        return res.json({ 
          ok: true, 
          added: false, 
          message: 'Reel already exists with current views', 
          sheetTitle,
          spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${targetSheet.properties.sheetId}` 
        });
      }
      
      const appendRes = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetTitle}!A1`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [row] }
      });

      // Reset styling: remove background color, text color, and bold from the newly added row
      try {
        await new Promise(resolve => setTimeout(resolve, 500));
        const updatedRange = appendRes?.data?.updates?.updatedRange;
        if (typeof updatedRange === 'string') {
          const m = updatedRange.match(/^([^!]+)!([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
          if (m) {
            const startRow = Math.max(0, parseInt(m[3], 10) - 1);
            const endRow = Math.max(startRow + 1, parseInt(m[5], 10));
            const sheetId = targetSheet?.properties?.sheetId;
            if (sheetId != null) {
              await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                requestBody: {
                  requests: [
                    {
                      repeatCell: {
                        range: {
                          sheetId,
                          startRowIndex: startRow,
                          endRowIndex: endRow,
                          startColumnIndex: 0,
                          endColumnIndex: 4,
                        },
                        cell: { userEnteredFormat: {
                          backgroundColor: { red: 1, green: 1, blue: 1 },
                          textFormat: { foregroundColor: { red: 0, green: 0, blue: 0 }, bold: false },
                          wrapStrategy: 'WRAP'
                        } },
                        fields: 'userEnteredFormat(backgroundColor,textFormat,wrapStrategy)'
                      }
                    }
                  ]
                }
              });
            }
          }
        }
      } catch (_) {
        // ignore formatting errors
      }

      res.json({ 
        ok: true, 
        added: true, 
        sheetTitle,
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${targetSheet.properties.sheetId}` 
      });
    } catch (e) {
      res.status(500).json({ error: e?.message || 'Failed to add reel to spreadsheet' });
    }
  });
}
