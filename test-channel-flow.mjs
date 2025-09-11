#!/usr/bin/env node

// Test script for the new channel finding flow with actual APIs
import { findChannelsBySearchTerm } from './backend/src/scraping/channel-finder.js';
import { getChannelByHandle } from './backend/src/scraping/instagram.js';
import { upsertSuggestedChannel, listSuggestedChannels } from './backend/src/database/index.js';
import dotenv from 'dotenv';

dotenv.config({ path: './backend/.env' });

async function testChannelFlow() {
    console.log('🧪 Testing NEW channel finding flow with actual API calls...\n');
    
    try {
        // Show initial state
        console.log('📊 Initial suggested channels count:', listSuggestedChannels().length);
        
        // Test 1: Find URLs using actual Apify API
        console.log('\n🔍 Step 1: Finding channel URLs with Apify...');
        const urls = await findChannelsBySearchTerm('cooking recipes', 2);  // Using a different search term
        console.log(`✅ Found ${urls.length} URLs:`);
        urls.forEach((url, i) => {
            console.log(`  ${i + 1}. ${url.username} - ${url.url}`);
        });
        
        if (urls.length === 0) {
            console.log('❌ No URLs found, ending test');
            return;
        }
        
        // Test 2: Analyze channels using Instagram API
        console.log('\n📱 Step 2: Analyzing channels with Instagram API...');
        const analyzedChannels = [];
        
        for (const [index, urlData] of urls.entries()) {
            try {
                console.log(`\n   Analyzing ${index + 1}/${urls.length}: ${urlData.username}`);
                
                const channelInfo = await getChannelByHandle({ handle: urlData.username });
                console.log(`   ✅ Got channel info: ${channelInfo.channelTitle || urlData.username}`);
                console.log(`      Followers: ${channelInfo.subscriberCount || 'N/A'}`);
                console.log(`      Bio: ${channelInfo.profileData?.biography?.substring(0, 50) || 'N/A'}...`);
                // Debug: show external URLs structure
                console.log(`      External URLs:`, channelInfo.profileData?.externalUrls);
                
                // Create suggested channel data
                const suggestedChannelData = {
                    id: `ig_${urlData.username}`,
                    username: urlData.username,
                    fullName: channelInfo.channelTitle || null,
                    followersCount: channelInfo.subscriberCount || null,
                    followsCount: channelInfo.profileData?.followsCount || null,
                    postsCount: channelInfo.profileData?.postsCount || null,
                    verified: channelInfo.profileData?.verified ? 1 : 0,
                    isPrivate: 0,
                    biography: channelInfo.profileData?.biography || null,
                    externalUrl: Array.isArray(channelInfo.profileData?.externalUrls) && channelInfo.profileData.externalUrls.length > 0 ? channelInfo.profileData.externalUrls[0].url : null,
                    profilePicUrl: channelInfo.thumbnailUrl || null,
                    localProfilePicPath: channelInfo.thumbnailUrl?.startsWith('/api/images/') ? channelInfo.thumbnailUrl : null,
                    searchTerm: urlData.searchTerm,
                    platform: 'instagram'
                };
                
                analyzedChannels.push(suggestedChannelData);
                
                // Small delay to be respectful
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.log(`   ❌ Failed to analyze ${urlData.username}: ${error.message}`);
            }
        }
        
        // Test 3: Store in database
        console.log('\n💾 Step 3: Storing in suggested channels database...');
        let storedCount = 0;
        
        for (const channelData of analyzedChannels) {
            try {
                upsertSuggestedChannel(channelData);
                storedCount++;
                console.log(`   ✅ Stored: ${channelData.username} (${channelData.fullName || 'No name'})`);
            } catch (error) {
                console.log(`   ❌ Failed to store ${channelData.username}: ${error.message}`);
            }
        }
        
        // Show final results
        const finalCount = listSuggestedChannels().length;
        console.log('\n📊 Final Results:');
        console.log(`   • URLs found: ${urls.length}`);
        console.log(`   • Channels analyzed: ${analyzedChannels.length}`);
        console.log(`   • Channels stored: ${storedCount}`);
        console.log(`   • Total suggested channels in DB: ${finalCount}`);
        
        console.log('\n🎉 Test completed successfully! The new flow is working with actual APIs.');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error(error.stack);
    }
}

testChannelFlow();
