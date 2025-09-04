// Topic Ranking
import { getAllVideos, getAllTopics, getAllVideoTopics } from './storage.js';
import { calculateEngagementScore } from './engagement-utils.js';

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
export function getTopicGraph(regularizationWeight = 10, minimumSampleSize = 5) {
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
    // Create an array of topic objects
    const topicObjects = topics.map(topic => {
        const matchingVideoTopics = videoTopics.filter(videoTopic => videoTopic.topic_id === topic.id);
        const topicVideos = matchingVideoTopics.map(videoTopic => videos.find(video => video.id === videoTopic.video_id));
        const nonNullVideos = topicVideos.filter(v => v !== undefined);
        return new Topic(topic.name, 0, 0, nonNullVideos);
    }).filter(topic => topic.videos.length >= minimumSampleSize);
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
    // 6: Compute topic closeness score by seeing what percentage of videos with one topic also have the other topic
    topicObjects.forEach(topic => {
        topicObjects.forEach(otherTopic => {
            if (topic.name === otherTopic.name) return;
            // find out how many videos they share
            const sharedVideos = topic.videos.filter(video => otherTopic.videos.some(v => v.id === video.id));
            topic.connections.push(new Connection(otherTopic, sharedVideos.length / topic.videos.length));
        });
    }); 
    // 7: Limit to the top 5 connections for each topic
    topicObjects.forEach(topic => {
        topic.connections.sort((a, b) => {
            // If weights are equal, sort by topic name for deterministic ordering
            if (b.weight === a.weight) {
                return a.topic.name.localeCompare(b.topic.name);
            }
            return b.weight - a.weight;
        });
        topic.connections = topic.connections.slice(0, 5);
    });   
    // 8: return the topic objects
    return topicObjects;
}