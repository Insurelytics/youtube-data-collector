// Constants from the original React component
const PERFORMANCE_THRESHOLDS = {
    EXCELLENT: 1.8,
    VERY_GOOD: 1.5,
    GOOD: 1.2,
    ABOVE_AVG: 1.05,
    AVERAGE: 0.95,
};

const ENABLE_MOVEMENT = true; // Set to true to enable force simulation, false to see static preprocessing
const FORCE_STRENGTH = 0.5; // Controls how weak the forces are (0.1 = very weak, 1.0 = normal strength)
const NUM_PHYSICS_CONNECTIONS = 3; // Maximum number of connections per node for physics simulation
const SIMULATION_ITERATIONS = 500; // Run simulation to completion with this many ticks

// Global state
let allTopics = [];
let allRelationships = [];
let filteredRelationships = [];
let finalNodes = [];
let selectedTopic = null;
let isSimulationComplete = false;
let isSimulationRunning = false;
let selectedTopicVideos = [];
let loadingVideos = false;
let connectedNodeIds = new Set();

// DOM elements
let graphSvg, graphGroup, loadingState, videosCard, selectedTopicTitle, videosLoading, videosGrid, noVideos;

// Zoom behavior
let zoomBehavior;

// Utility functions
const getNodeRadius = (videoCount) => Math.max(8, Math.min(20, 8 + videoCount * 0.8));
const getNodeSize = (vc) => Math.max(16, Math.min(40, 16 + vc * 1.6));

const getMultiplierColor = (m) => {
    if (m >= PERFORMANCE_THRESHOLDS.EXCELLENT) return { primary: "#10b981", secondary: "#065f46", glow: "rgba(16, 185, 129, 0.4)" };
    if (m >= PERFORMANCE_THRESHOLDS.VERY_GOOD) return { primary: "#22c55e", secondary: "#166534", glow: "rgba(34, 197, 94, 0.4)" };
    if (m >= PERFORMANCE_THRESHOLDS.GOOD) return { primary: "#84cc16", secondary: "#365314", glow: "rgba(132, 204, 22, 0.4)" };
    if (m >= PERFORMANCE_THRESHOLDS.ABOVE_AVG) return { primary: "#eab308", secondary: "#713f12", glow: "rgba(234, 179, 8, 0.4)" };
    if (m >= PERFORMANCE_THRESHOLDS.AVERAGE) return { primary: "#f59e0b", secondary: "#92400e", glow: "rgba(245, 158, 11, 0.4)" };
    if (m >= 0.8) return { primary: "#f97316", secondary: "#9a3412", glow: "rgba(249, 115, 22, 0.4)" };
    return { primary: "#ef4444", secondary: "#991b1b", glow: "rgba(239, 68, 68, 0.4)" };
};

// Hash-based deterministic positioning
function hashStringToSeed(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
}

function getRandomPosition(topic, width = 3000, height = 2000) {
    const seed = hashStringToSeed(topic);
    
    // Create a proper PRNG with independent x and y values
    function lcg(seed) {
        const a = 1664525;
        const c = 1013904223;
        const m = Math.pow(2, 32);
        return ((a * seed + c) % m) / m;
    }
    
    // Use different seeds for x and y to ensure independence
    const x = lcg(seed);
    const y = lcg(seed * 9973); // Use a different prime multiplier for y
    
    return {
        x: x * width,
        y: y * height
    };
}

// Preprocessing: move closely connected topics closer together
function preprocessConnectedPairs(nodes, relationships, strengthThreshold = 0.8, iterations = 1) {
    let processedNodes = [...nodes];
    
    // Filter relationships above the threshold
    const strongConnections = relationships.filter(rel => rel.strength >= strengthThreshold);
    
    for (let iter = 0; iter < iterations; iter++) {
        const usedPairsThisIteration = new Set();
        
        for (const rel of strongConnections) {
            const pairKey1 = `${rel.source}-${rel.target}`;
            const pairKey2 = `${rel.target}-${rel.source}`;
            
            // Skip if this pair has already been processed in THIS iteration
            if (usedPairsThisIteration.has(pairKey1) || usedPairsThisIteration.has(pairKey2)) continue;
            
            // Mark this pair as used for this iteration only
            usedPairsThisIteration.add(pairKey1);
            usedPairsThisIteration.add(pairKey2);
            
            // Find the nodes and average their positions
            const sourceNode = processedNodes.find(n => n.id === rel.source);
            const targetNode = processedNodes.find(n => n.id === rel.target);
            
            if (sourceNode && targetNode && sourceNode.x !== undefined && sourceNode.y !== undefined && 
                targetNode.x !== undefined && targetNode.y !== undefined) {
                const avgX = (sourceNode.x + targetNode.x) / 2;
                const avgY = (sourceNode.y + targetNode.y) / 2;
                
                sourceNode.x = avgX;
                sourceNode.y = avgY;
                targetNode.x = avgX;
                targetNode.y = avgY;
            }
        }
    }
    
    return processedNodes;
}

// Separate overlapping nodes, prioritizing weaker connections to move first
function separateOverlappingNodes(nodes, relationships, maxIterations = 50) {
    const processedNodes = [...nodes];
    
    // Calculate total connection strength for each node
    const nodeStrengths = new Map();
    relationships.forEach(rel => {
        nodeStrengths.set(rel.source, (nodeStrengths.get(rel.source) || 0) + rel.strength);
        nodeStrengths.set(rel.target, (nodeStrengths.get(rel.target) || 0) + rel.strength);
    });
    
    // Sort nodes by connection strength (weakest first)
    const nodesByStrength = processedNodes.slice().sort((a, b) => {
        const strengthA = nodeStrengths.get(a.id) || 0;
        const strengthB = nodeStrengths.get(b.id) || 0;
        return strengthA - strengthB;
    });
    
    for (let iter = 0; iter < maxIterations; iter++) {
        let movedAny = false;
        
        for (const node of nodesByStrength) {
            if (!node.x || !node.y) continue;
            
            const nodeRadius = getNodeRadius(node.videoCount);
            
            // Check for overlaps with other nodes
            for (const otherNode of processedNodes) {
                if (node.id === otherNode.id || !otherNode.x || !otherNode.y) continue;
                
                const otherRadius = getNodeRadius(otherNode.videoCount);
                const minDistance = nodeRadius + otherRadius + 10; // 10px padding
                
                const dx = node.x - otherNode.x;
                const dy = node.y - otherNode.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < minDistance) {
                    // Move the current node away from the overlapping node
                    const angle = Math.atan2(dy, dx);
                    const targetDistance = minDistance + 5; // Extra padding
                    
                    node.x = otherNode.x + Math.cos(angle) * targetDistance;
                    node.y = otherNode.y + Math.sin(angle) * targetDistance;
                    
                    movedAny = true;
                    break; // Only move away from first overlapping node per iteration
                }
            }
        }
        
        if (!movedAny) {
            break;
        }
    }
    
    return processedNodes;
}

// Filter connections to keep only the strongest ones per node for physics
function filterConnectionsForPhysics(relationships, maxConnectionsPerNode) {
    // Group connections by node
    const nodeConnections = new Map();
    
    relationships.forEach(rel => {
        if (!nodeConnections.has(rel.source)) nodeConnections.set(rel.source, []);
        if (!nodeConnections.has(rel.target)) nodeConnections.set(rel.target, []);
        
        nodeConnections.get(rel.source).push(rel);
        nodeConnections.get(rel.target).push(rel);
    });
    
    // For each node, keep only the strongest connections
    const filteredConnections = new Set();
    
    nodeConnections.forEach((connections, nodeId) => {
        // Sort by strength (strongest first) and take top N
        const sortedConnections = connections
            .sort((a, b) => b.strength - a.strength)
            .slice(0, maxConnectionsPerNode);
        
        sortedConnections.forEach(rel => {
            // Create a consistent key for the relationship
            const key = rel.source < rel.target ? `${rel.source}-${rel.target}` : `${rel.target}-${rel.source}`;
            filteredConnections.add(key);
        });
    });
    
    // Filter original relationships to keep only the selected ones
    const result = relationships.filter(rel => {
        const key = rel.source < rel.target ? `${rel.source}-${rel.target}` : `${rel.target}-${rel.source}`;
        return filteredConnections.has(key);
    });
    
    return result;
}

// Create path for curved link
function pathFor(a, b) {
    const mx = ((a.x || 0) + (b.x || 0)) / 2;
    const my = ((a.y || 0) + (b.y || 0)) / 2;
    const dx = (b.x || 0) - (a.x || 0);
    const dy = (b.y || 0) - (a.y || 0);
    const k = 0.12;
    const nx = -dy * k;
    const ny = dx * k;
    return `M ${a.x} ${a.y} Q ${mx + nx} ${my + ny} ${b.x} ${b.y}`;
}

// Format numbers for display
function formatNumber(num) {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
}

// Get video URL based on platform
function getVideoUrl(video) {
    if (video.platform === 'instagram') {
        // For Instagram, always use the public reel link instead of rotating video URLs
        // Extract shortCode from the id (remove 'ig_' prefix) or use shortCode field if available
        const shortCode = video.shortCode || (video.id.startsWith('ig_') ? video.id.substring(3) : video.id);
        return `https://www.instagram.com/p/${shortCode}/`;
    }
    if (video.platform === 'youtube') return `https://www.youtube.com/watch?v=${video.id}`;
    if (video.videoUrl) return video.videoUrl;
    return null;
}

// Get image URL for video thumbnail
function getImageUrl(video) {
    // For Instagram reels, prioritize locally downloaded image to avoid CORS issues
    if (video.platform === 'instagram' && video.localImageUrl) {
        // Extract filename from localImageUrl (could be full path or just filename)
        const filename = video.localImageUrl.includes('/') 
            ? video.localImageUrl.split('/').pop() 
            : video.localImageUrl;
        return `/api/images/${filename}`;
    }
    
    // For YouTube videos, use thumbnails with the correct structure
    if (video.thumbnails) {
        try {
            const t = typeof video.thumbnails === 'string' ? JSON.parse(video.thumbnails) : video.thumbnails;
            const thumbnailUrl = t?.medium?.url || t?.default?.url || t?.high?.url;
            if (thumbnailUrl) return thumbnailUrl;
        } catch {
            // If parsing fails, fallback to placeholder
        }
    }
    
    return '/placeholder-video.jpg';
}

// Update connected node IDs when selection changes
function updateConnectedNodeIds() {
    connectedNodeIds.clear();
    if (!selectedTopic) return;
    
    filteredRelationships.forEach(rel => {
        if (rel.source === selectedTopic) connectedNodeIds.add(rel.target);
        if (rel.target === selectedTopic) connectedNodeIds.add(rel.source);
    });
}

// Event handlers
function handleVideoClick(video) {
    const url = getVideoUrl(video);
    if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
    }
}

function handleChannelClick(video, event) {
    event.stopPropagation(); // Prevent video click
    if (video.channelId) {
        window.location.href = `/dashboard/${video.channelId}`;
    }
}

// API functions
async function fetchTopicGraph(maxNodes = 40) {
    try {
        const response = await fetch(`/api/topics/graph?maxNodes=${maxNodes}`);
        if (!response.ok) throw new Error('Failed to fetch topic graph');
        const data = await response.json();
        return {
            topics: data.topics || [],
            relationships: data.relationships || []
        };
    } catch (error) {
        console.error('Error fetching topic graph:', error);
        return {
            topics: [],
            relationships: []
        };
    }
}

async function fetchTopicVideos(topicName) {
    try {
        const response = await fetch(`/api/topics/${encodeURIComponent(topicName)}/videos?pageSize=9`);
        if (!response.ok) throw new Error('Failed to fetch videos');
        
        const data = await response.json();
        // Deduplicate videos by ID to prevent conflicts
        const videoMap = new Map();
        (data.videos || []).forEach((video) => {
            if (!videoMap.has(video.id)) {
                videoMap.set(video.id, video);
            }
        });
        return Array.from(videoMap.values());
    } catch (error) {
        console.error('Error fetching topic videos:', error);
        return [];
    }
}

// Topic selection
async function selectTopic(topicId) {
    if (selectedTopic === topicId) {
        // Deselect
        selectedTopic = null;
        videosCard.style.display = 'none';
        selectedTopicVideos = [];
    } else {
        // Select new topic
        selectedTopic = topicId;
        const selectedTopicData = allTopics.find(t => t.id === topicId);
        if (!selectedTopicData) return;

        // Show videos card and update title
        videosCard.style.display = 'block';
        selectedTopicTitle.textContent = `Top Videos for "${selectedTopicData.topic}"`;
        
        // Show loading state
        videosLoading.style.display = 'flex';
        videosGrid.style.display = 'none';
        noVideos.style.display = 'none';
        
        // Fetch videos
        try {
            const videos = await fetchTopicVideos(selectedTopicData.topic);
            selectedTopicVideos = videos;
            renderVideos();
        } catch (error) {
            console.error('Error loading videos:', error);
            selectedTopicVideos = [];
            renderVideos();
        } finally {
            videosLoading.style.display = 'none';
        }
    }
    
    updateConnectedNodeIds();
    renderGraph();
}

// Render functions
function renderVideos() {
    videosGrid.innerHTML = '';
    
    if (selectedTopicVideos.length === 0) {
        videosGrid.style.display = 'none';
        noVideos.style.display = 'block';
        return;
    }
    
    videosGrid.style.display = 'grid';
    noVideos.style.display = 'none';
    
    selectedTopicVideos.forEach(video => {
        const videoElement = document.createElement('div');
        videoElement.className = 'video-card';
        
        const thumbnailClass = video.platform === 'instagram' ? 'instagram' : 'youtube';
        
        videoElement.innerHTML = `
            <div class="video-content">
                <div class="video-thumbnail ${thumbnailClass}">
                    <img src="${getImageUrl(video)}" alt="${video.title}" onerror="this.src='/placeholder-video.jpg'">
                </div>
                <div class="video-info">
                    <h4 class="video-title" onclick="handleVideoClick(${JSON.stringify(video).replace(/"/g, '&quot;')})">${video.title}</h4>
                    ${video.channelTitle ? `
                        <div class="video-channel" onclick="handleChannelClick(${JSON.stringify(video).replace(/"/g, '&quot;')}, event)">
                            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                <circle cx="12" cy="7" r="4"/>
                            </svg>
                            <span>${video.channelTitle}</span>
                        </div>
                    ` : ''}
                    <div class="video-stats">
                        <div class="video-stat">
                            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                <circle cx="12" cy="12" r="3"/>
                            </svg>
                            ${formatNumber(video.viewCount || 0)}
                        </div>
                        <div class="video-stat">
                            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                            </svg>
                            ${formatNumber(video.likeCount || 0)}
                        </div>
                        <div class="video-stat">
                            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                            </svg>
                            ${formatNumber(video.commentCount || 0)}
                        </div>
                    </div>
                    <div class="video-footer">
                        <div class="badge">
                            ${video.platform === 'youtube' ? 'YouTube' : 'Instagram'}
                        </div>
                        <div class="external-link" onclick="handleVideoClick(${JSON.stringify(video).replace(/"/g, '&quot;')})">
                            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                                <polyline points="15,3 21,3 21,9"/>
                                <line x1="10" y1="14" x2="21" y2="3"/>
                            </svg>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        videosGrid.appendChild(videoElement);
    });
}

function renderGraph() {
    if (!isSimulationComplete || !finalNodes.length) return;
    
    // Clear existing content
    graphGroup.innerHTML = '';
    
    const byId = new Map(finalNodes.map(n => [n.id, n]));
    
    // Render links
    filteredRelationships.forEach((rel, i) => {
        const a = byId.get(rel.source);
        const b = byId.get(rel.target);
        if (!a || !b) return;
        
        const strength = rel.strength || 0;
        const strokeWidth = Math.max(1, Math.min(4, 1 + strength * 3));
        const opacity = Math.max(0.3, Math.min(0.9, 0.4 + strength * 0.6));
        
        // Check if this connection involves the selected topic
        const isConnectedToSelected = selectedTopic && (rel.source === selectedTopic || rel.target === selectedTopic);
        
        // Hide non-connected links when a topic is selected
        if (selectedTopic && !isConnectedToSelected) {
            return;
        }
        
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', 'link-path');
        path.setAttribute('d', pathFor(a, b));
        path.setAttribute('stroke', isConnectedToSelected ? "#60a5fa" : "#94a3b8");
        path.setAttribute('stroke-width', isConnectedToSelected ? strokeWidth + 1 : strokeWidth * 0.5);
        path.setAttribute('stroke-opacity', isConnectedToSelected ? 1 : opacity);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke-linecap', 'round');
        
        graphGroup.appendChild(path);
    });
    
    // Render nodes
    finalNodes.forEach(n => {
        const size = getNodeSize(n.videoCount);
        const r = size / 2;
        const selected = selectedTopic === n.id;
        const connected = connectedNodeIds.has(n.id);
        const dimmed = selectedTopic && !selected && !connected;
        const colors = getMultiplierColor(n.engagementMultiplier);
        
        let strokeColor = colors.primary;
        let strokeWidth = 2;
        
        if (selected) {
            strokeColor = "#fbbf24";
            strokeWidth = 3;
        } else if (connected) {
            strokeColor = "#60a5fa";
            strokeWidth = 2.5;
        }
        
        const nodeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        nodeGroup.setAttribute('class', 'node-group');
        nodeGroup.style.opacity = dimmed ? '0.4' : '1';
        nodeGroup.style.cursor = 'pointer';
        nodeGroup.style.transformOrigin = `${n.x}px ${n.y}px`;
        nodeGroup.style.transition = 'transform 0.2s ease';
        
        // Outer ring for selected/connected nodes
        if (selected || connected) {
            const outerRing = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            outerRing.setAttribute('cx', n.x);
            outerRing.setAttribute('cy', n.y);
            outerRing.setAttribute('r', r + 4);
            outerRing.setAttribute('fill', 'none');
            outerRing.setAttribute('stroke', selected ? "#fbbf24" : "#60a5fa");
            outerRing.setAttribute('stroke-width', '2');
            outerRing.setAttribute('stroke-opacity', '0.5');
            nodeGroup.appendChild(outerRing);
        }
        
        // Main node circle
        const mainCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        mainCircle.setAttribute('cx', n.x);
        mainCircle.setAttribute('cy', n.y);
        mainCircle.setAttribute('r', r);
        mainCircle.setAttribute('fill', colors.primary);
        mainCircle.setAttribute('stroke', strokeColor);
        mainCircle.setAttribute('stroke-width', strokeWidth);
        nodeGroup.appendChild(mainCircle);
        
        // Video count indicator - only for selected/connected nodes
        if (selected || connected) {
            const countCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            countCircle.setAttribute('cx', (n.x || 0) + r * 0.6);
            countCircle.setAttribute('cy', (n.y || 0) - r * 0.6);
            countCircle.setAttribute('r', Math.min(r * 0.3, 6));
            countCircle.setAttribute('fill', '#1f2937');
            countCircle.setAttribute('stroke', '#f3f4f6');
            countCircle.setAttribute('stroke-width', '1');
            countCircle.style.pointerEvents = 'none';
            nodeGroup.appendChild(countCircle);
            
            const countText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            countText.setAttribute('x', (n.x || 0) + r * 0.6);
            countText.setAttribute('y', (n.y || 0) - r * 0.6);
            countText.setAttribute('text-anchor', 'middle');
            countText.setAttribute('dominant-baseline', 'middle');
            countText.setAttribute('class', 'fill-white font-bold pointer-events-none select-none');
            countText.style.fontSize = `${Math.max(5, r * 0.25)}px`;
            countText.style.fill = 'white';
            countText.style.fontWeight = 'bold';
            countText.style.pointerEvents = 'none';
            countText.textContent = n.videoCount;
            nodeGroup.appendChild(countText);
        }
        
        // Main topic text
        const topicText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        topicText.setAttribute('x', n.x || 0);
        topicText.setAttribute('y', n.y || 0);
        topicText.setAttribute('text-anchor', 'middle');
        topicText.setAttribute('dominant-baseline', 'middle');
        topicText.style.fontSize = `${Math.max(8, size / 8)}px`;
        topicText.style.fill = 'white';
        topicText.style.fontWeight = 'bold';
        topicText.style.pointerEvents = 'none';
        topicText.style.textShadow = '0 1px 2px rgba(0,0,0,0.8)';
        if (selected || connected) {
            topicText.style.transform = 'translateY(-4px)';
        }
        topicText.textContent = n.topic;
        nodeGroup.appendChild(topicText);
        
        // Engagement multiplier - only for selected/connected nodes
        if (selected || connected) {
            const multiplierText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            multiplierText.setAttribute('x', n.x || 0);
            multiplierText.setAttribute('y', (n.y || 0) + 6);
            multiplierText.setAttribute('text-anchor', 'middle');
            multiplierText.setAttribute('dominant-baseline', 'middle');
            multiplierText.style.fontSize = `${Math.max(6, size / 10)}px`;
            multiplierText.style.fill = '#fde047';
            multiplierText.style.fontWeight = '500';
            multiplierText.style.pointerEvents = 'none';
            multiplierText.style.textShadow = '0 1px 2px rgba(0,0,0,0.9)';
            multiplierText.textContent = `${n.engagementMultiplier.toFixed(2)}x`;
            nodeGroup.appendChild(multiplierText);
        }
        
        // Event handlers
        nodeGroup.addEventListener('click', (e) => {
            e.stopPropagation();
            selectTopic(selected ? null : n.id);
        });
        
        nodeGroup.addEventListener('mouseenter', () => {
            nodeGroup.style.transform = 'scale(1.1)';
        });
        
        nodeGroup.addEventListener('mouseleave', () => {
            nodeGroup.style.transform = 'scale(1)';
        });
        
        graphGroup.appendChild(nodeGroup);
    });
}

// Separate categories deterministically to ensure they stay far apart
function separateCategories(nodes, minCategoryDistance = 800, maxIterations = 50) {
    const processedNodes = [...nodes];
    const categories = processedNodes.filter(n => n.isCategory);
    
    if (categories.length <= 1) return processedNodes;
    
    for (let iter = 0; iter < maxIterations; iter++) {
        let movedAny = false;
        
        // Check each pair of categories
        for (let i = 0; i < categories.length; i++) {
            for (let j = i + 1; j < categories.length; j++) {
                const cat1 = categories[i];
                const cat2 = categories[j];
                
                if (!cat1.x || !cat1.y || !cat2.x || !cat2.y) continue;
                
                const dx = cat1.x - cat2.x;
                const dy = cat1.y - cat2.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < minCategoryDistance) {
                    console.log('Separating categories', cat1.topic, cat2.topic, distance);
                    // Calculate separation vector - move each category half the needed distance
                    const targetDistance = minCategoryDistance + 50; // Extra padding
                    const moveDistance = (targetDistance - distance) / 2;
                    
                    // Normalize direction vector
                    const magnitude = Math.sqrt(dx * dx + dy * dy);
                    const unitX = magnitude > 0 ? dx / magnitude : 1;
                    const unitY = magnitude > 0 ? dy / magnitude : 0;
                    
                    // Move categories apart along the line connecting them
                    cat1.x += unitX * moveDistance;
                    cat1.y += unitY * moveDistance;
                    cat2.x -= unitX * moveDistance;  
                    cat2.y -= unitY * moveDistance;
                    
                    movedAny = true;
                }
            }
        }
        
        if (!movedAny) break;
    }
    
    return processedNodes;
}

// Initialize seeded nodes with preprocessing
function initializeSeededNodes() {
    // Filter out any invalid topics first
    const validTopics = allTopics.filter(t => t && t.id !== undefined && t.topic);
    
    const nodes = validTopics.map(t => {
        const pos = getRandomPosition(t.topic);
        return {
            ...t,
            x: pos.x,
            y: pos.y,
        };
    });

    // FIRST: Separate categories to ensure they stay far apart
    const categorySeparatedNodes = separateCategories(nodes, 80000000, 50000);

    // THEN: Apply preprocessing to move connected pairs closer
    const preprocessedNodes = preprocessConnectedPairs(categorySeparatedNodes, allRelationships, 0.5, 3);

    // FINALLY: Separate any overlapping nodes (but preserve category separation)
    const separatedNodes = separateOverlappingNodes(preprocessedNodes, allRelationships, 50);

    return separatedNodes;
}

// Run simulation
function runSimulation(seededNodes) {
    if (!seededNodes.length) return;

    // Filter out any invalid nodes before proceeding
    const validNodes = seededNodes.filter(n => n && n.id !== undefined && typeof n.x === 'number' && typeof n.y === 'number');
    if (validNodes.length === 0) return;

    if (!ENABLE_MOVEMENT) {
        // Static mode: Use preprocessed positions directly
        finalNodes = [...validNodes];
        isSimulationComplete = true;
        isSimulationRunning = false;
        loadingState.style.display = 'none';
        centerView();
        renderGraph();
        return;
    }

    // Start simulation loading state
    isSimulationRunning = true;
    isSimulationComplete = false;
    loadingState.style.display = 'flex';
    
    const nodeById = new Map(validNodes.map(n => [n.id, n]));
    const d3Links = filteredRelationships
        .filter(l => l && nodeById.has(l.source) && nodeById.has(l.target))
        .map(l => ({
            source: nodeById.get(l.source),
            target: nodeById.get(l.target),
            strength: l.strength,
        }));

    // Run simulation asynchronously to avoid blocking the UI
    setTimeout(() => {
        // Create a simulation optimized for maximum speed
        const simulation = d3
            .forceSimulation(validNodes)
            .randomSource(d3.randomLcg(1337))
            .force("charge", d3.forceManyBody()
                .strength(-50 * FORCE_STRENGTH) // Stronger forces for faster convergence
                .theta(0.8) // Lower theta for more accuracy during fast sim
            )
            .force(
                "link",
                d3
                    .forceLink(d3Links)
                    .id(d => d.id)
                    .distance(100)
                    .strength(0.2 * FORCE_STRENGTH) // Stronger link forces
                    .iterations(2) // More link iterations for stability
            )
            .force(
                "collide",
                d3
                    .forceCollide()
                    .radius(d => getNodeRadius(d.videoCount) + 5)
                    .strength(0.8 * FORCE_STRENGTH) // Stronger collision
                    .iterations(2) // More collision iterations
            )
            .alpha(0.8) // Higher initial alpha
            .alphaDecay(1 - Math.pow(0.001, 1 / 200)) // Faster decay
            .velocityDecay(0.7) // Higher velocity decay for stability
            .stop(); // Don't start automatically

        // Run simulation to completion as fast as possible
        for (let i = 0; i < SIMULATION_ITERATIONS; ++i) {
            simulation.tick();
            if (simulation.alpha() < 0.005) break; // Stop early if converged
        }

        // Store final positions and mark as complete
        finalNodes = validNodes.map(n => ({ ...n, x: n.x || 0, y: n.y || 0 }));
        
        // Update state
        isSimulationComplete = true;
        isSimulationRunning = false;
        loadingState.style.display = 'none';

        // Center view and render
        centerView();
        renderGraph();

        // Clean up
        simulation.stop();
    }, 10); // Small delay to allow UI to update with loading state
}

// Setup zoom and pan behavior
function setupZoomBehavior() {
    zoomBehavior = d3.zoom()
        .scaleExtent([0.1, 5]) // Allow zooming from 10% to 500%
        .on('zoom', (event) => {
            graphGroup.setAttribute('transform', event.transform);
        });
    
    d3.select(graphSvg).call(zoomBehavior);
}

// Center the view when simulation is complete
function centerView() {
    if (!isSimulationComplete || !finalNodes.length || !zoomBehavior) return;

    // Set initial zoom to fit content
    const pad = 40;
    const xs = finalNodes.map(n => n.x);
    const ys = finalNodes.map(n => n.y);
    const minX = Math.min(...xs) - pad;
    const maxX = Math.max(...xs) + pad;
    const minY = Math.min(...ys) - pad;
    const maxY = Math.max(...ys) + pad;
    
    // Get actual SVG dimensions
    const rect = graphSvg.getBoundingClientRect();
    const width = rect.width || 800;
    const height = rect.height || 500;
    
    const dx = maxX - minX;
    const dy = maxY - minY;
    
    // Prevent division by zero
    if (dx === 0 || dy === 0) return;
    
    const x = (minX + maxX) / 2;
    const y = (minY + maxY) / 2;
    const scale = Math.min(width / dx, height / dy) * 0.9;
    
    // Ensure scale is valid
    if (!isFinite(scale) || scale <= 0) return;
    
    const initialTransform = d3.zoomIdentity
        .translate(width / 2, height / 2)
        .scale(scale)
        .translate(-x, -y);
    
    // Apply the transform using the zoom behavior
    d3.select(graphSvg)
        .transition()
        .duration(750)
        .call(zoomBehavior.transform, initialTransform);
}

// Main initialization function
async function init() {
    // Get DOM elements
    graphSvg = document.getElementById('graphSvg');
    graphGroup = document.getElementById('graphGroup');
    loadingState = document.getElementById('loadingState');
    videosCard = document.getElementById('videosCard');
    selectedTopicTitle = document.getElementById('selectedTopicTitle');
    videosLoading = document.getElementById('videosLoading');
    videosGrid = document.getElementById('videosGrid');
    noVideos = document.getElementById('noVideos');
    
    // Setup zoom and pan behavior
    setupZoomBehavior();
    
    // Set up background click to deselect (with zoom behavior handling)
    d3.select(graphSvg).on('click', (event) => {
        // Only deselect if clicking the background (not a node)
        if (event.target === graphSvg || event.target.tagName === 'rect') {
            selectTopic(null);
        }
    });
    
    try {
        // Fetch data
        console.log('Fetching topic graph data...');
        const { topics, relationships } = await fetchTopicGraph();
        
        console.log(`Loaded ${topics.length} topics and ${relationships.length} relationships`);
        
        allTopics = topics;
        allRelationships = relationships;
        
        // Filter relationships for physics
        filteredRelationships = filterConnectionsForPhysics(relationships, NUM_PHYSICS_CONNECTIONS);
        console.log(`Filtered to ${filteredRelationships.length} relationships for physics`);
        
        // Initialize positions
        const seededNodes = initializeSeededNodes();
        console.log(`Initialized ${seededNodes.length} nodes with positions`);
        
        // Run simulation
        runSimulation(seededNodes);
        
    } catch (error) {
        console.error('Error initializing graph:', error);
        loadingState.innerHTML = '<div class="loading-content"><p style="color: #ef4444;">Error loading graph data</p></div>';
    }
}

// Make functions available globally for HTML onclick handlers
window.handleVideoClick = handleVideoClick;
window.handleChannelClick = handleChannelClick;

// Start the application
document.addEventListener('DOMContentLoaded', init);
