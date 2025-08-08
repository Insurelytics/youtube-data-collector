# youtube-data-collector
Collects and displays the last 120 days of videos for a given channel using the YouTube Data API v3. Stores data in SQLite and serves a small UI to browse it.

Quick start

1) Create `.env` with your API key:

```
API_KEY=YOUR_YOUTUBE_DATA_API_V3_KEY
PORT=3000
```

2) Install and run:

```
npm install
npm run dev
```

The server performs an initial sync on startup and serves UI at `http://localhost:3000`.

