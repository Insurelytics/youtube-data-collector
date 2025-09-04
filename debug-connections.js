import { getTopicGraph } from './src/topic-math.js';

// Debug the topic connections
console.log('Starting debug of topic connections...');

const topicGraph = getTopicGraph();

// Find hopecore topic
const hopecoreTopic = topicGraph.find(topic => topic.name === 'hopecore');

if (!hopecoreTopic) {
    console.log('ERROR: hopecore topic not found in graph!');
    process.exit(1);
}

console.log('\n=== HOPECORE TOPIC DEBUG ===');
console.log('Topic name:', hopecoreTopic.name);
console.log('Number of videos:', hopecoreTopic.videos.length);
console.log('Engagement multiplier:', hopecoreTopic.engagementMultiplier);
console.log('Number of connections:', hopecoreTopic.connections.length);

console.log('\nVideos associated with hopecore:');
hopecoreTopic.videos.forEach((video, index) => {
    console.log(`  ${index + 1}. ${video.title} (ID: ${video.id})`);
});

console.log('\nConnections for hopecore:');
hopecoreTopic.connections.forEach((connection, index) => {
    console.log(`  ${index + 1}. ${connection.topic.name} (weight: ${connection.weight})`);
});

console.log('\n=== CHECKING OTHER TOPICS FOR SHARED VIDEOS ===');

// Get the video ID that hopecore is associated with
const hopecoreVideoId = hopecoreTopic.videos[0]?.id;
console.log('Hopecore video ID:', hopecoreVideoId);

// Check other topics that should be connected
const expectedTopics = ['coding', 'programming', 'softwareengineer', 'webdevelopment', 'javascript', 'programmerhumor'];

expectedTopics.forEach(topicName => {
    const topic = topicGraph.find(t => t.name === topicName);
    if (topic) {
        const hasSharedVideo = topic.videos.some(video => video.id === hopecoreVideoId);
        console.log(`${topicName}: has shared video = ${hasSharedVideo}, total videos = ${topic.videos.length}`);
        
        if (hasSharedVideo) {
            // Calculate what the connection weight should be
            const sharedVideos = topic.videos.filter(video => hopecoreTopic.videos.some(hv => hv.id === video.id));
            const expectedWeight = sharedVideos.length / topic.videos.length;
            console.log(`  Expected connection weight from ${topicName} to hopecore: ${expectedWeight}`);
            
            // Check if there's actually a connection in hopecore's connections
            const connectionToHopecore = hopecoreTopic.connections.find(conn => conn.topic.name === topicName);
            if (connectionToHopecore) {
                console.log(`  Actual connection weight: ${connectionToHopecore.weight}`);
            } else {
                console.log(`  NO CONNECTION FOUND in hopecore's connections!`);
            }
        }
    } else {
        console.log(`${topicName}: NOT FOUND in topic graph!`);
    }
});

console.log('\n=== RAW CONNECTION CALCULATION DEBUG ===');
// Let's manually calculate connections for hopecore to see what's happening
console.log('Manually calculating connections for hopecore...');

topicGraph.forEach(otherTopic => {
    if (otherTopic.name === 'hopecore') return;
    
    // Find shared videos
    const sharedVideos = hopecoreTopic.videos.filter(video => 
        otherTopic.videos.some(v => v.id === video.id)
    );
    
    if (sharedVideos.length > 0) {
        const weight = sharedVideos.length / hopecoreTopic.videos.length;
        console.log(`  ${otherTopic.name}: ${sharedVideos.length} shared videos, weight = ${weight}`);
    }
});
