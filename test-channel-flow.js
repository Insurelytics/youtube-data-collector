#!/usr/bin/env node

// Test script for the new channel finding flow
import { findChannelsBySearchTerm } from './backend/src/scraping/channel-finder.js';
import { getChannelByHandle } from './backend/src/scraping/instagram.js';
import { upsertSuggestedChannel } from './backend/src/database/index.js';
import dotenv from 'dotenv';

dotenv.config();

async function testChannelFlow() {
    console.log('Testing new channel finding flow...\n');
    
    try {
        // Test 1: Find URLs
        console.log('Step 1: Finding channel URLs...');
        const urls = await findChannelsBySearchTerm('cats pets animals', 2);
        console.log(`Found ${urls.length} URLs:`, urls);
        
        if (urls.length === 0) {
            console.log('No URLs found, ending test');
            return;
        }
        
        // Test 2: Analyze first URL
        console.log('\nStep 2: Analyzing first channel...');
        const firstUrl = urls[0];
        console.log(`Analyzing: ${firstUrl.url}`);
        
        const channelInfo = await getChannelByHandle({ handle: firstUrl.username });
        console.log('Channel info:', channelInfo);
        
        // Test 3: Store in suggested channels
        console.log('\nStep 3: Storing in suggested channels...');
        const suggestedChannelData = {
            id: `ig_${firstUrl.username}`,
            username: firstUrl.username,
            fullName: channelInfo.channelTitle || null,
            followersCount: channelInfo.subscriberCount || null,
            followsCount: channelInfo.profileData?.followsCount || null,
            postsCount: channelInfo.profileData?.postsCount || null,
            verified: channelInfo.profileData?.verified ? 1 : 0,
            isPrivate: 0,
            biography: channelInfo.profileData?.biography || null,
            externalUrl: channelInfo.profileData?.externalUrls?.[0] || null,
            profilePicUrl: channelInfo.thumbnailUrl || null,
            localProfilePicPath: channelInfo.thumbnailUrl?.startsWith('/api/images/') ? channelInfo.thumbnailUrl : null,
            searchTerm: firstUrl.searchTerm,
            platform: 'instagram'
        };
        
        upsertSuggestedChannel(suggestedChannelData);
        console.log('Successfully stored channel data');
        
        console.log('\n✅ Test completed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    }
}

testChannelFlow();
