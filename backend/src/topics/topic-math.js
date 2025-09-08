// Topic Ranking
import { getAllVideos, getAllTopics, getAllVideoTopics } from '../database/index.js';
import { calculateEngagementScore } from '../utils/engagement-utils.js';

// Export the category threshold constant
export const CATEGORY_THRESHOLD = 0.5;

// return a list of topics sorted by how positively they impact video engagement
export function getTopicRanking(topics) {
    // will be a fancy function for sorting topics by how positively they impact video engagement
    return topics;
}

class Connection {
    constructor(topic, weight) {
        this.topic = topic;
        this.weight = weight;
    }
}

class Topic {
    constructor(name, engagementScore, closenessScore, videos, connections = []) {
        this.name = name;
        this.engagementScore = engagementScore;
        this.closenessScore = closenessScore;
        this.videos = videos;
        this.connections = connections;
        this.topVideos = []; // Will be populated with top 3 videos by raw engagement
    }
}

// return a force directed graph of topics along with their engagement multiplier and other metrics
export function getTopicGraph(regularizationWeight = 10, minimumSampleSize = 1, maxNodes = 10) {
    // maxNodes = 1000;
    // 1: Get all videos from the database
    const videos = getAllVideos();
    // 2: Compute engagement score for each video
    videos.forEach(video => {
        video.engagementScore = calculateEngagementScore(video);
    });
    // 3: Normalize engagement score by account average for each video
    // get all channel ids from the videos
    const channelIds = [...new Set(videos.map(video => video.channelId))];
    // for each channel, compute the average engagement score
    channelIds.forEach(channelId => {
        const channelVideos = videos.filter(video => video.channelId === channelId);
        const averageEngagementScore = channelVideos.reduce((sum, video) => sum + video.engagementScore, 0) / channelVideos.length;
        channelVideos.forEach(video => {
            video.normalizedEngagementScore = video.engagementScore / averageEngagementScore;
        });
    });
    // 4: Get all topics from the database
    const topics = getAllTopics();
    // Get the video_topics into memory (this is stupid isn't it...)
    const videoTopics = getAllVideoTopics();
    // Create an array of topic objects with video counts
    const allTopicObjects = topics.map(topic => {
        const matchingVideoTopics = videoTopics.filter(videoTopic => videoTopic.topic_id === topic.id);
        const topicVideos = matchingVideoTopics.map(videoTopic => videos.find(video => video.id === videoTopic.video_id));
        const nonNullVideos = topicVideos.filter(v => v !== undefined);
        return new Topic(topic.name, 0, 0, nonNullVideos);
    });

    // Dynamically adjust minimum sample size if too many topics would be included
    let adjustedMinimumSampleSize = minimumSampleSize;
    let qualifyingTopics = allTopicObjects.filter(topic => topic.videos.length >= adjustedMinimumSampleSize);
    
    // If more topics qualify than maxNodes, increase minimum sample size to limit to ≤maxNodes
    while (qualifyingTopics.length > maxNodes) {
        adjustedMinimumSampleSize++;
        qualifyingTopics = allTopicObjects.filter(topic => topic.videos.length >= adjustedMinimumSampleSize);
        
        // Safety check to prevent infinite loop
        if (adjustedMinimumSampleSize > 100) break;
    }
    
    const topicObjects = qualifyingTopics;
    // 5: Compute topic engagement score by using the scores of the videos that are associated with the topic
    topicObjects.forEach(topic => {
        // how much does this topic affect engagement score? What's the average engagement score for the videos associated with this topic?
        // Apply regularization to prevent low sample sizes from being weighted too heavily
        // We add virtual examples with average engagement (1.0) to smooth the calculation
        const actualSum = topic.videos.reduce((sum, video)=> sum + video.normalizedEngagementScore, 0);
        const virtualSum = regularizationWeight * 1.0; // regularizationWeight examples with average engagement
        topic.engagementMultiplier = (actualSum + virtualSum) / (topic.videos.length + regularizationWeight);
        
        // 5.1: Get top 3 videos by raw engagement score for this topic
        const sortedVideos = topic.videos
            .map(video => ({
                ...video,
                rawEngagement: video.engagementScore // Use raw engagement, not normalized
            }))
            .sort((a, b) => b.rawEngagement - a.rawEngagement)
            .slice(0, 3);
        
        topic.topVideos = sortedVideos.map(video => ({
            title: video.title,
            views: video.viewCount || 0,
            comments: video.commentCount || 0,
            likes: video.likeCount || 0,
            id: video.id,
            publishedAt: video.publishedAt
        }));
    });
    // 6: Compute directional topic connections 
    // Each topic calculates: what percentage of its videos also have each other topic
    topicObjects.forEach(topic => {
        topicObjects.forEach(otherTopic => {
            if (topic.name === otherTopic.name) return;
            // find out how many videos they share
            const sharedVideos = topic.videos.filter(video => otherTopic.videos.some(v => v.id === video.id));
            topic.connections.push(new Connection(otherTopic, sharedVideos.length / topic.videos.length));
        });
    }); 
    
    // 7: Filter out 0% connections and limit to the top 5 connections for each topic
    topicObjects.forEach(topic => {
        topic.connections = topic.connections
            .filter(connection => connection.weight > 0) // Remove 0% connections
            .sort((a, b) => {
                // If weights are equal, sort by topic name for deterministic ordering
                if (b.weight === a.weight) {
                    return a.topic.name.localeCompare(b.topic.name);
                }
                return b.weight - a.weight;
            })
            .slice(0, 50);
    });   
    
    // 8: Detect dynamic categories based on high-strength incoming connections
    // A topic is considered a category if it has multiple topics that frequently appear with it
    const categoryThreshold = CATEGORY_THRESHOLD; // 80% connection strength threshold
    const incomingConnections = new Map(); // Map of topic -> array of incoming high-strength connections
    const outgoingConnections = new Map(); // Map of topic -> array of outgoing high-strength connections
    
    topicObjects.forEach(topic => {
        topic.connections.forEach(connection => {
            if (connection.weight >= categoryThreshold) { // 80% or higher connection
                // Track incoming connections
                if (!incomingConnections.has(connection.topic.name)) {
                    incomingConnections.set(connection.topic.name, []);
                }
                incomingConnections.get(connection.topic.name).push(topic.name);
                
                // Track outgoing connections
                if (!outgoingConnections.has(topic.name)) {
                    outgoingConnections.set(topic.name, []);
                }
                outgoingConnections.get(topic.name).push(connection.topic.name);
            }
        });
    });
    
    // Define categories as topics with at least 2 incoming high-strength connections
    // Resolve conflicts where candidates have high-strength connections to other candidates
    const minIncomingConnections = 2;
    const candidateCategories = new Map(); // Map of topic name to topic object
    const mutualExclusions = new Map(); // Map of topic name to array of topics it excludes
    
    // First pass: identify candidate categories
    incomingConnections.forEach((incomingTopics, targetTopic) => {
        if (incomingTopics.length >= minIncomingConnections) {
            // All topics with sufficient incoming connections are candidates
            const topicObj = topicObjects.find(t => t.name === targetTopic);
            candidateCategories.set(targetTopic, topicObj);
        }
    });
    
    // Second pass: remove candidates that have high-strength connections to other candidates
    const detectedCategories = new Set();
    const disqualified = new Set();
    
    // For each candidate, check if it should be disqualified
    candidateCategories.forEach((topicObj, topicName) => {
        const outgoing = outgoingConnections.get(topicName) || [];
        
        // Check if this candidate connects to any other candidate
        const connectedCandidates = outgoing.filter(otherTopic => candidateCategories.has(otherTopic));
        
        if (connectedCandidates.length > 0) {
            // This topic connects to other candidates - determine who should be disqualified
            connectedCandidates.forEach(otherTopic => {
                const otherTopicObj = candidateCategories.get(otherTopic);
                
                // Disqualify the topic with fewer videos (or later in array if tied)
                if (topicObj.videos.length < otherTopicObj.videos.length) {
                    disqualified.add(topicName);
                } else if (topicObj.videos.length === otherTopicObj.videos.length) {
                    // If tied, disqualify the one that appears later in the array
                    const thisIndex = topicObjects.findIndex(t => t.name === topicName);
                    const otherIndex = topicObjects.findIndex(t => t.name === otherTopic);
                    if (thisIndex > otherIndex) {
                        disqualified.add(topicName);
                    } else {
                        disqualified.add(otherTopic);
                    }
                } else {
                    disqualified.add(otherTopic);
                }
            });
        }
    });
    
    // Add all non-disqualified candidates as categories
    candidateCategories.forEach((topicObj, topicName) => {
        if (!disqualified.has(topicName)) {
            detectedCategories.add(topicName);
        }
    });
    
    // Mark topics as categories or regular topics
    topicObjects.forEach(topic => {
        topic.isCategory = detectedCategories.has(topic.name);
        topic.incomingCategoryConnections = incomingConnections.get(topic.name) || [];
    });
    
    // 9: Calculate bidirectional relationships for visualization
    // Store both directional connections and max-based relationships
    const relationships = [];
    const addedRelationships = new Set();
    
    topicObjects.forEach((topic, sourceIndex) => {
        topic.connections.forEach(connection => {
            const targetIndex = topicObjects.findIndex(t => t.name === connection.topic.name);
            if (targetIndex !== -1) {
                // Create relationship key (always use smaller index first for consistency)
                const relKey = sourceIndex < targetIndex 
                    ? `${sourceIndex}-${targetIndex}` 
                    : `${targetIndex}-${sourceIndex}`;
                
                if (!addedRelationships.has(relKey)) {
                    addedRelationships.add(relKey);
                    
                    // Find the reverse connection
                    const targetTopic = topicObjects[targetIndex];
                    const reverseConnection = targetTopic.connections.find(c => c.topic.name === topic.name);
                    
                    const forwardStrength = connection.weight;
                    const reverseStrength = reverseConnection ? reverseConnection.weight : 0;
                    
                    // Store relationship with both directions
                    relationships.push({
                        source: sourceIndex,
                        target: targetIndex,
                        forwardStrength,  // source -> target
                        reverseStrength,  // target -> source  
                        maxStrength: Math.max(forwardStrength, reverseStrength), // For visualization
                        label: `${topic.name} - ${connection.topic.name}`
                    });
                }
            }
        });
    });
    
    // 10: Return both topics and calculated relationships
    return {
        topics: topicObjects,
        relationships
    };
}