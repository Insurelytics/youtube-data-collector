import { getTopicGraph } from './src/topic-math.js';

console.log('Testing getTopicGraph() function...\n');

try {
    const topicGraph = getTopicGraph();
    
    console.log(`Found ${topicGraph.length} topics in the graph\n`);
    
    // Display detailed information about each topic
    topicGraph.forEach((topic, index) => {
        console.log(`=== Topic ${index + 1}: "${topic.name}" ===`);
        console.log(`Videos associated: ${topic.videos.length}`);
        console.log(`Engagement multiplier: ${topic.engagementMultiplier?.toFixed(3) || 'N/A'}`);
        console.log(`Connections to other topics: ${topic.connections.length}`);
        
        if (topic.videos.length > 0) {
            console.log('Sample videos:');
            topic.videos.slice(0, 3).forEach(video => {
                if (video) {
                    console.log(`  - "${video.title}" (Views: ${video.viewCount || 0}, Engagement: ${video.engagementScore?.toFixed(0) || 'N/A'}, Normalized: ${video.normalizedEngagementScore?.toFixed(2) || 'N/A'})`);
                }
            });
        }
        
        if (topic.connections.length > 0) {
            console.log('Top connections:');
            topic.connections
                .sort((a, b) => b.weight - a.weight)
                .slice(0, 3)
                .forEach(conn => {
                    console.log(`  - "${conn.topic.name}" (weight: ${conn.weight?.toFixed(3) || 'N/A'})`);
                });
        }
        
        console.log(''); // Empty line for spacing
    });
    
    // Summary statistics
    const totalVideos = topicGraph.reduce((sum, topic) => sum + topic.videos.length, 0);
    const totalConnections = topicGraph.reduce((sum, topic) => sum + topic.connections.length, 0);
    const avgEngagementMultiplier = topicGraph
        .filter(topic => topic.engagementMultiplier && !isNaN(topic.engagementMultiplier))
        .reduce((sum, topic) => sum + topic.engagementMultiplier, 0) / 
        topicGraph.filter(topic => topic.engagementMultiplier && !isNaN(topic.engagementMultiplier)).length;
    
    console.log('=== SUMMARY ===');
    console.log(`Total topics: ${topicGraph.length}`);
    console.log(`Total video associations: ${totalVideos}`);
    console.log(`Total topic connections: ${totalConnections}`);
    console.log(`Average engagement multiplier: ${avgEngagementMultiplier?.toFixed(3) || 'N/A'}`);
    
    // Find topics with highest engagement multipliers
    const topTopics = topicGraph
        .filter(topic => topic.engagementMultiplier && !isNaN(topic.engagementMultiplier))
        .sort((a, b) => b.engagementMultiplier - a.engagementMultiplier)
        .slice(0, 5);
    
    if (topTopics.length > 0) {
        console.log('\nTop 5 topics by engagement multiplier:');
        topTopics.forEach((topic, index) => {
            console.log(`${index + 1}. "${topic.name}" - ${topic.engagementMultiplier.toFixed(3)} (${topic.videos.length} videos)`);
        });
    }
    
} catch (error) {
    console.error('Error running getTopicGraph():', error);
    console.error('Stack trace:', error.stack);
}
