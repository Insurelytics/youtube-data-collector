#!/usr/bin/env node
import { downloadAndExtractAudio } from '../video_processing/video-utils.js';

function usage() {
  console.error('usage: node src/scripts/test-ig-audio.js <instagram_url_or_shortcode>');
  process.exit(1);
}

async function main() {
  const arg = process.argv[2];
  if (!arg) usage();

  // Accept either full URL or shortcode
  let shortcode = arg;
  const m = String(arg).match(/(?:reel|p|tv)\/([^/?#]+)/);
  if (m && m[1]) {
    shortcode = m[1];
  }

  const url = `https://www.instagram.com/reel/${shortcode}/`;
  const videoId = `ig_${shortcode}`;

  try {
    const proxyPwd = process.env.APIFY_PROXY_PASSWORD;
    if (!proxyPwd) {
      console.error('ERROR: APIFY_PROXY_PASSWORD is not set. Aborting.');
      process.exit(2);
    }
    console.error('Using residential proxy via APIFY proxy.');

    console.log(`Testing Instagram audio download for ${url} ...`);
    const out = await downloadAndExtractAudio(url, videoId, 'instagram');
    console.log(out);
  } catch (e) {
    console.error('FAILED');
    console.error(e?.stack || e?.message || String(e));
    process.exit(1);
  }
}

main();


