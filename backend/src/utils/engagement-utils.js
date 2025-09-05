// Shared engagement score calculation utilities

/**
 * Calculate engagement score for a video
 * @param {Object} video - Video object with viewCount, likeCount, commentCount, durationSeconds
 * @param {number} likeWeight - Weight for likes (default: 150)
 * @param {number} commentWeight - Weight for comments (default: 500)
 * @returns {number} Engagement score
 */
export function calculateEngagementScore(video, likeWeight = 150, commentWeight = 500) {
    const views = Number(video.viewCount || 0);
    const likes = Number(video.likeCount || 0);
    const comments = Number(video.commentCount || 0);
    const duration = Number(video.durationSeconds || 0);
    
    // Normalize views by duration (views per minute) + weighted likes and comments
    return views * (duration / 60.0) + likeWeight * likes + commentWeight * comments;
}

/**
 * Generate SQL expression for engagement score calculation
 * @param {number} likeWeight - Weight for likes (default: 150)
 * @param {number} commentWeight - Weight for comments (default: 500)
 * @returns {string} SQL expression for engagement calculation
 */
export function getEngagementSqlExpression(likeWeight = 150, commentWeight = 500) {
    return `COALESCE(viewCount,0) * (COALESCE(durationSeconds,0) / 60.0) + ${likeWeight}*COALESCE(likeCount,0) + ${commentWeight}*COALESCE(commentCount,0)`;
}
