import fs from 'node:fs';
import { google } from 'googleapis';

const SHEET_HEADER = ['Company Name', 'Front Man', 'IG Handle', 'Followers', 'Notes'];

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
          const rowNum = foundRowIndex + 2;
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
        const row = [
          companyName,
          '',
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

  app.post('/api/drive/export-channels', async (req, res) => {
    try {
      const providedId = (req.body?.spreadsheetId || '').toString();
      const ws = getWorkspace(req.workspaceId);
      const spreadsheetId = providedId || (ws && ws.spreadsheetId ? String(ws.spreadsheetId) : '');
      if (!spreadsheetId) return res.status(400).json({ error: 'spreadsheetId not set for workspace and not provided' });

      const sheets = await getAuthenticatedSheetsClient();
      const headerResult = await addHeaderIfNeeded(sheets, spreadsheetId);
      const existingLinks = await getExistingLinks(sheets, spreadsheetId);

      const channels = listChannels();
      const formattedRows = channels.map((c) => {
        const companyName = c.title || c.channelName || '-';
        const handle = (c.handle || '').toString().replace(/^@+/, '');
        let igLink = '-';
        if (handle) {
          if ((c.platform || '').toLowerCase() === 'instagram') {
            igLink = `https://www.instagram.com/${handle}`;
          } else {
            igLink = `https://www.youtube.com/@${handle}`;
          }
        }
        return [
          companyName,
          '',
          igLink,
          formatFollowers(typeof c.subscriberCount === 'number' ? c.subscriberCount : null),
          ''
        ];
      });
      
      const rows = formattedRows.filter(r => {
        const link = (r[2] || '').toString().trim().toLowerCase();
        return link && !existingLinks.has(link);
      });

      if (rows.length === 0 && !headerResult.added) {
        return res.json({ ok: true, appended: 0, headerAdded: false });
      }

      let totalAppended = headerResult.added ? 1 : 0;
      let headerUpdatedRangeA1 = headerResult.range;
      let dataUpdatedRangeA1 = null;

      if (rows.length) {
        const appendRes = await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: 'A1',
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          requestBody: { values: rows }
        });
        const updates = appendRes?.data?.updates;
        const updated = (updates && (updates.updatedRows || updates.updatedCells)) ? (updates.updatedRows || rows.length) : rows.length;
        totalAppended += updated;
        dataUpdatedRangeA1 = appendRes?.data?.updates?.updatedRange || null;
      }

      try {
        const meta = await sheets.spreadsheets.get({ spreadsheetId, includeGridData: false });
        const sheetsListMeta = meta?.data?.sheets || [];

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

        const firstSheetId = sheetsListMeta[0]?.properties?.sheetId;
        const firstSheetTitle = sheetsListMeta[0]?.properties?.title;
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

        const headerParsed = parseA1(headerUpdatedRangeA1);
        const dataParsed = parseA1(dataUpdatedRangeA1);
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
        addWrapRequest(dataParsed);

        if (requests.length) {
          await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
        }
      } catch (_) {
        // Ignore column resizing errors
      }

      res.json({ ok: true, appended: totalAppended, headerAdded: headerResult.added });
    } catch (e) {
      res.status(500).json({ error: e?.message || 'Failed to export channels' });
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
}
