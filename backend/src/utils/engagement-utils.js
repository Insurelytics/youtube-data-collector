// Shared engagement score calculation utilities

/**
 * Calculate engagement score for a video
 * @param {Object} video - Video object with viewCount, likeCount, commentCount, durationSeconds
 * @param {number} likeWeight - Weight for likes (default: 150)
 * @param {number} commentWeight - Weight for comments (default: 500)
 * @returns {number} Engagement score
 */
export function calculateEngagementScore(video, likeWeight = 150, commentWeight = 500, { includeDuration = true, includeLikesComments = true } = {}) {
    const views = Number(video.viewCount || 0);
    const likes = Number(video.likeCount || 0);
    const comments = Number(video.commentCount || 0);
    const duration = Number(video.durationSeconds || 0);
    
    // Build score based on toggles
    let score = 0;
    if (includeDuration) {
        score += views * (duration / 60.0);
    } else {
        score += views; // plain views
    }
    if (includeLikesComments) {
        score += likeWeight * likes + commentWeight * comments;
    }
    return score;
}

/**
 * Generate SQL expression for engagement score calculation
 * @param {number} likeWeight - Weight for likes (default: 150)
 * @param {number} commentWeight - Weight for comments (default: 500)
 * @returns {string} SQL expression for engagement calculation
 */
export function getEngagementSqlExpression(likeWeight = 150, commentWeight = 500, { includeDuration = true, includeLikesComments = true } = {}) {
    const viewTerm = includeDuration
        ? 'COALESCE(viewCount,0) * (COALESCE(durationSeconds,0) / 60.0)'
        : 'COALESCE(viewCount,0)';
    const parts = [viewTerm];
    if (includeLikesComments) {
        parts.push(`${likeWeight}*COALESCE(likeCount,0) + ${commentWeight}*COALESCE(commentCount,0)`);
    }
    return parts.join(' + ');
}
