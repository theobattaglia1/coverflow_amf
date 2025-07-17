import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

const DATA_DIR = path.join(process.cwd(), 'data');
const SERVER_URL = 'http://localhost:10000';

// Create test assets.json file
const testAssetsData = {
    images: [
        {
            url: "https://storage.googleapis.com/allmyfriends-assets-2025/test1.jpg",
            type: "image",
            filename: "test1.jpg"
        },
        {
            url: "https://storage.googleapis.com/allmyfriends-assets-2025/test2.jpg",
            type: "image", 
            filename: "test2.jpg"
        }
    ],
    children: [
        {
            type: "folder",
            name: "Hudson",
            children: [
                {
                    type: "image",
                    url: "https://storage.googleapis.com/allmyfriends-assets-2025/Hudson/existing.jpg",
                    name: "existing image",
                    uploadedAt: "2025-07-14T01:42:32.381Z"
                }
            ]
        },
        {
            type: "folder",
            name: "TestFolder",
            children: []
        }
    ]
};

async function setupTestData() {
    console.log('Setting up test data...');
    
    // Backup existing assets.json if it exists
    const assetsPath = path.join(DATA_DIR, 'assets.json');
    const backupPath = path.join(DATA_DIR, 'assets-test-backup.json');
    
    try {
        if (fs.existsSync(assetsPath)) {
            fs.copyFileSync(assetsPath, backupPath);
            console.log('Backed up existing assets.json');
        }
        
        // Write test data
        fs.writeFileSync(assetsPath, JSON.stringify(testAssetsData, null, 2));
        console.log('Test data written to assets.json');
    } catch (error) {
        console.error('Error setting up test data:', error);
        return false;
    }
    
    return true;
}

async function restoreData() {
    console.log('Restoring original data...');
    
    const assetsPath = path.join(DATA_DIR, 'assets.json');
    const backupPath = path.join(DATA_DIR, 'assets-test-backup.json');
    
    try {
        if (fs.existsSync(backupPath)) {
            fs.copyFileSync(backupPath, assetsPath);
            fs.unlinkSync(backupPath);
            console.log('Restored original assets.json');
        }
    } catch (error) {
        console.error('Error restoring data:', error);
    }
}

async function testBulkMove() {
    console.log('\nTesting bulk move endpoint...');
    
    // Test 1: Move asset from root to folder
    console.log('Test 1: Moving asset from root to Hudson folder');
    
    const moveRequest = {
        assetUrls: ["https://storage.googleapis.com/allmyfriends-assets-2025/test1.jpg"],
        targetFolder: "Hudson"
    };
    
    try {
        const response = await fetch(`${SERVER_URL}/api/assets/bulk-move`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(moveRequest)
        });
        
        const result = await response.json();
        console.log('Move response status:', response.status);
        console.log('Move response:', result);
        
        if (response.ok && result.success) {
            console.log('✅ Test 1 passed');
        } else {
            console.log('❌ Test 1 failed');
        }
    } catch (error) {
        console.error('Test 1 error:', error);
        console.log('❌ Test 1 failed');
    }
    
    // Verify the move worked
    const assetsPath = path.join(DATA_DIR, 'assets.json');
    const updatedAssets = JSON.parse(fs.readFileSync(assetsPath, 'utf-8'));
    
    console.log('\nVerification:');
    console.log('Root images count:', updatedAssets.images.length);
    console.log('Hudson children count:', updatedAssets.children[0].children.length);
    
    if (updatedAssets.images.length === 1 && updatedAssets.children[0].children.length === 2) {
        console.log('✅ Asset move verification passed');
    } else {
        console.log('❌ Asset move verification failed');
    }
    
    // Test 2: Move asset back to root
    console.log('\nTest 2: Moving asset from folder back to root');
    
    const moveBackRequest = {
        assetUrls: ["https://storage.googleapis.com/allmyfriends-assets-2025/test1.jpg"],
        targetFolder: "ROOT"
    };
    
    try {
        const response = await fetch(`${SERVER_URL}/api/assets/bulk-move`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(moveBackRequest)
        });
        
        const result = await response.json();
        console.log('Move back response status:', response.status);
        console.log('Move back response:', result);
        
        if (response.ok && result.success) {
            console.log('✅ Test 2 passed');
        } else {
            console.log('❌ Test 2 failed');
        }
    } catch (error) {
        console.error('Test 2 error:', error);
        console.log('❌ Test 2 failed');
    }
    
    // Test 3: Invalid folder path
    console.log('\nTest 3: Testing invalid folder path');
    
    const invalidMoveRequest = {
        assetUrls: ["https://storage.googleapis.com/allmyfriends-assets-2025/test2.jpg"],
        targetFolder: "NonExistentFolder"
    };
    
    try {
        const response = await fetch(`${SERVER_URL}/api/assets/bulk-move`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(invalidMoveRequest)
        });
        
        const result = await response.json();
        console.log('Invalid move response status:', response.status);
        console.log('Invalid move response:', result);
        
        if (response.status === 404 && result.error.includes('Target folder not found')) {
            console.log('✅ Test 3 passed (correctly rejected invalid folder)');
        } else {
            console.log('❌ Test 3 failed (should have rejected invalid folder)');
        }
    } catch (error) {
        console.error('Test 3 error:', error);
        console.log('❌ Test 3 failed');
    }
}

async function waitForServer() {
    console.log('Waiting for server to start...');
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
        try {
            const response = await fetch(`${SERVER_URL}/api/health`);
            if (response.ok) {
                console.log('Server is ready!');
                return true;
            }
        } catch (error) {
            // Server not ready yet
        }
        
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log(`Attempt ${attempts}/${maxAttempts}`);
    }
    
    console.log('Server did not start in time');
    return false;
}

async function runTests() {
    console.log('Starting integration tests for bulk-move endpoint...\n');
    
    if (!await setupTestData()) {
        console.log('Failed to setup test data');
        return;
    }
    
    if (!await waitForServer()) {
        console.log('Server is not available');
        await restoreData();
        return;
    }
    
    await testBulkMove();
    
    await restoreData();
    console.log('\nAll tests completed!');
}

// If this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runTests().catch(console.error);
}

export { runTests };