import 'dotenv/config'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { google } from 'googleapis'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const TOKENS_DIR = join(__dirname, '../../.secrets')
const TOKENS_PATH = join(TOKENS_DIR, 'google-oauth-token.json')

function getEnv(name, fallback) {
  return process.env[name] || fallback
}

function ensureDir(path) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true })
}

function getServiceAccountAuth() {
  const keyPath = getEnv('GOOGLE_SERVICE_ACCOUNT_KEY_PATH')
  const keyJson = getEnv('GOOGLE_SERVICE_ACCOUNT_KEY_JSON')
  let credentials
  if (keyJson) {
    credentials = JSON.parse(keyJson)
  } else if (keyPath) {
    credentials = JSON.parse(readFileSync(keyPath, 'utf8'))
  } else {
    throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_KEY_PATH or GOOGLE_SERVICE_ACCOUNT_KEY_JSON')
  }
  const scopes = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/drive.metadata.readonly',
    'https://www.googleapis.com/auth/spreadsheets',
  ]
  return new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes,
  })
}

async function getAuthClient() {
  return getServiceAccountAuth()
}

async function shareFolder(folderId, email) {
  const auth = await getAuthClient()
  const drive = google.drive({ version: 'v3', auth })
  await drive.permissions.create({
    fileId: folderId,
    requestBody: {
      type: 'user',
      role: 'writer',
      emailAddress: email,
    },
    sendNotificationEmail: false,
  })
  console.log(`Shared folder ${folderId} with ${email}`)
}

async function listSpreadsheets(folderId) {
  const auth = await getAuthClient()
  const drive = google.drive({ version: 'v3', auth })
  const q = [
    `'${folderId}' in parents`,
    "mimeType='application/vnd.google-apps.spreadsheet'",
    'trashed=false',
  ].join(' and ')
  const res = await drive.files.list({ q, fields: 'files(id, name)' })
  const files = res.data.files || []
  files.forEach(f => console.log(`${f.id}\t${f.name}`))
  if (files.length === 0) console.log('No spreadsheets found.')
  return files
}

async function writeHelloToAll(folderId) {
  const auth = await getAuthClient()
  const drive = google.drive({ version: 'v3', auth })
  const sheets = google.sheets({ version: 'v4', auth })
  const q = [
    `'${folderId}' in parents`,
    "mimeType='application/vnd.google-apps.spreadsheet'",
    'trashed=false',
  ].join(' and ')
  const res = await drive.files.list({ q, fields: 'files(id, name)' })
  const files = res.data.files || []
  for (const f of files) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: f.id,
      range: 'A1',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [['Hello world']] },
    })
    console.log(`Wrote to ${f.name} (${f.id})`)
  }
  if (files.length === 0) console.log('No spreadsheets to update.')
}

function extractIdFromUrl(url) {
  const match = url.match(/\/folders\/([a-zA-Z0-9-_]+)/)
  return match ? match[1] : null
}

async function main() {
  const [, , cmd, ...args] = process.argv
  try {
    if (cmd === 'share-folder') {
      const folderId = args[0]
      const email = args[1]
      if (!folderId || !email) throw new Error('Usage: share-folder <FOLDER_ID> <EMAIL>')
      await shareFolder(folderId, email)
    } else if (cmd === 'list-sheets') {
      const folderId = args[0]
      if (!folderId) throw new Error('Usage: list-sheets <FOLDER_ID>')
      await listSpreadsheets(folderId)
    } else if (cmd === 'write-hello') {
      const folderId = args[0]
      if (!folderId) throw new Error('Usage: write-hello <FOLDER_ID>')
      await writeHelloToAll(folderId)
    } else if (cmd === 'extract-id') {
      const url = args[0]
      if (!url) throw new Error('Usage: extract-id <URL>')
      const id = extractIdFromUrl(url)
      console.log(id || 'No ID found')
    } else {
      console.log('Commands:')
      console.log('  share-folder <FOLDER_ID> <EMAIL>')
      console.log('  list-sheets <FOLDER_ID>')
      console.log('  write-hello <FOLDER_ID>')
      console.log('  extract-id <URL>')
      console.log('\nEnvironment: set GOOGLE_SERVICE_ACCOUNT_KEY_PATH or GOOGLE_SERVICE_ACCOUNT_KEY_JSON')
    }
  } catch (err) {
    console.error(err.message || err)
    process.exitCode = 1
  }
}

main()


