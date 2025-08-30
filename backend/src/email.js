// Email notification system for YouTube Data Collector
// Adapted from the example project's send-mail.js

import FormData from 'form-data';
import Mailgun from 'mailgun.js';
import { getSetting } from './storage.js';

async function sendEmail(to, subject, text, html = null) {
  const mailgun = new Mailgun(FormData);
  const mg = mailgun.client({
    username: "api",
    key: process.env.MAILGUN_API_KEY || "API_KEY",
    // When you have an EU-domain, you must specify the endpoint:
    // url: "https://api.eu.mailgun.net"
  });
  
  try {
    const messageData = {
      from: "YouTube Data Collector <youtube@mail-testing.bschoolland.com>",
      to: [to],
      subject: subject,
      text: text,
    };

    if (html) {
      messageData.html = html;
    }

    const data = await mg.messages.create("mail-testing.bschoolland.com", messageData);
    console.log(`Email sent successfully to ${to}`);
    return data;
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error);
    throw error;
  }
}

function formatVideoSummary(video) {
  const viewCount = video.viewCount ? video.viewCount.toLocaleString() : 'N/A';
  const likeCount = video.likeCount ? video.likeCount.toLocaleString() : 'N/A';
  const commentCount = video.commentCount ? video.commentCount.toLocaleString() : 'N/A';
  const platform = video.platform || 'youtube';
  
  // Generate appropriate URL based on platform
  let contentUrl;
  if (platform === 'instagram') {
    contentUrl = video.shortCode ? `https://www.instagram.com/p/${video.shortCode}/` : 'N/A';
  } else {
    // YouTube or unknown platform
    const videoId = video.id.startsWith('ig_') ? video.id.substring(3) : video.id;
    contentUrl = `https://www.youtube.com/watch?v=${videoId}`;
  }
  
  const contentType = platform === 'instagram' ? 'Post' : 'Video';
  
  return `• ${video.title}
  ${platform === 'instagram' ? 'Account' : 'Channel'}: ${video.channelTitle || 'Unknown'}
  Views: ${viewCount}
  Likes: ${likeCount}
  Comments: ${commentCount}
  Published: ${video.publishedAt ? new Date(video.publishedAt).toLocaleDateString() : 'N/A'}
  Platform: ${platform.charAt(0).toUpperCase() + platform.slice(1)}
  URL: ${contentUrl}`;
}

async function sendViralVideosEmail(viralVideos, totalNewVideos, jobResults) {
  // Check for email addresses in schedule settings first (current format)
  const scheduleSettingsStr = getSetting('scheduleSettings');
  let emailList = '';
  
  if (scheduleSettingsStr) {
    try {
      const scheduleSettings = JSON.parse(scheduleSettingsStr);
      emailList = scheduleSettings.emailAddresses || '';
    } catch (e) {
      console.warn('Failed to parse schedule settings for email addresses:', e);
    }
  }
  
  // Fallback to emailSettings format if not found
  if (!emailList) {
    const emailListSetting = getSetting('emailSettings');
    if (emailListSetting) {
      try {
        const emailSettings = JSON.parse(emailListSetting);
        emailList = emailSettings.recipients || '';
      } catch (e) {
        console.warn('Failed to parse email settings:', e);
      }
    }
  }
  
  // Final fallback to environment variable
  if (!emailList) {
    emailList = process.env.EMAIL_RECIPIENTS || '';
  }
  
  const emails = emailList.split(',').map(email => email.trim()).filter(email => email);
  
  if (emails.length === 0) {
    console.log('No email addresses configured, skipping email');
    return;
  }

  // Count content by platform
  const platformCounts = viralVideos.reduce((acc, video) => {
    const platform = video.platform || 'youtube';
    acc[platform] = (acc[platform] || 0) + 1;
    return acc;
  }, {});

  const platformSummary = Object.keys(platformCounts)
    .map(platform => `${platformCounts[platform]} ${platform.charAt(0).toUpperCase() + platform.slice(1)}`)
    .join(', ');

  const subject = `Viral Content Alert: ${viralVideos.length} Viral Items Found (${platformSummary})`;
  
  const textContent = `Social Media Data Collector Results

Total new content found: ${totalNewVideos}
Viral content discovered: ${viralVideos.length}${platformSummary ? ` (${platformSummary})` : ''}

${viralVideos.length > 0 ? `Viral Content Details:
${viralVideos.map(formatVideoSummary).join('\n\n')}` : 'No viral content found this time.'}

Sync Job Summary:
${jobResults.map(job => {
  const platform = job.platform || 'youtube';
  const contentType = platform === 'instagram' ? 'posts' : 'videos';
  return `- ${job.channel_title} (${platform.charAt(0).toUpperCase() + platform.slice(1)}): ${job.new_videos} new ${contentType}`;
}).join('\n')}

---
This email was sent automatically by the Social Media Data Collector system.`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .viral-content { 
          background: linear-gradient(to right, #fff3cd, #ffeaa7); 
          padding: 15px; 
          margin: 10px 0; 
          border-radius: 8px; 
          border-left: 4px solid #e17055;
        }
        .stats { color: #636e72; font-size: 0.9em; }
        .content-title { font-weight: bold; color: #2d3436; }
        .channel-name { color: #74b9ff; }
        .platform-badge { 
          background: #00b894; 
          color: white; 
          padding: 2px 8px; 
          border-radius: 12px; 
          font-size: 0.8em; 
          margin-left: 8px;
        }
        .instagram { background: #e84393; }
        .youtube { background: #ff6b6b; }
    </style>
</head>
<body>
    <h2>🔥 Social Media Data Collector Results</h2>
    
    <h3>Summary</h3>
    <p><strong>Total new content found:</strong> ${totalNewVideos}</p>
    <p><strong>Viral content discovered:</strong> ${viralVideos.length}${platformSummary ? ` (${platformSummary})` : ''}</p>
    
    ${viralVideos.length > 0 ? `
    <h3>Viral Content</h3>
    ${viralVideos.map(video => {
      const platform = video.platform || 'youtube';
      let contentUrl;
      if (platform === 'instagram') {
        contentUrl = video.shortCode ? `https://www.instagram.com/p/${video.shortCode}/` : '#';
      } else {
        const videoId = video.id.startsWith('ig_') ? video.id.substring(3) : video.id;
        contentUrl = `https://www.youtube.com/watch?v=${videoId}`;
      }
      
      return `
      <div class="viral-content">
        <div class="content-title">
          ${video.title}
          <span class="platform-badge ${platform}">${platform.charAt(0).toUpperCase() + platform.slice(1)}</span>
        </div>
        <div class="channel-name">${platform === 'instagram' ? 'Account' : 'Channel'}: ${video.channelTitle || 'Unknown'}</div>
        <div class="stats">
          Views: ${video.viewCount ? video.viewCount.toLocaleString() : 'N/A'} | 
          Likes: ${video.likeCount ? video.likeCount.toLocaleString() : 'N/A'} | 
          Comments: ${video.commentCount ? video.commentCount.toLocaleString() : 'N/A'}
        </div>
        <div class="stats">Published: ${video.publishedAt ? new Date(video.publishedAt).toLocaleDateString() : 'N/A'}</div>
        <a href="${contentUrl}" target="_blank">${platform === 'instagram' ? 'View Post' : 'Watch Video'}</a>
      </div>
      `;
    }).join('')}
    ` : ''}
    
    <h3>Sync Job Summary</h3>
    <ul>
      ${jobResults.map(job => {
        const platform = job.platform || 'youtube';
        const contentType = platform === 'instagram' ? 'posts' : 'videos';
        return `<li><strong>${job.channel_title}</strong> (${platform.charAt(0).toUpperCase() + platform.slice(1)}): ${job.new_videos} new ${contentType}</li>`;
      }).join('')}
    </ul>
    
    <hr>
    <p><small>This email was sent automatically by the Social Media Data Collector system.</small></p>
</body>
</html>`;

  // Send email to each address
  const emailPromises = emails.map(async (email) => {
    try {
      await sendEmail(email, subject, textContent, htmlContent);
      console.log(`Successfully sent viral videos email to ${email}`);
    } catch (error) {
      console.error(`Failed to send viral videos email to ${email}:`, error);
    }
  });

  await Promise.all(emailPromises);
  console.log(`Viral videos email notifications sent to ${emails.length} recipients`);
}

export {
  sendEmail,
  sendViralVideosEmail
};
