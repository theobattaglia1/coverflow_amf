# Bulk Move Asset Tests

This directory contains tests for the asset bulk-move functionality.

## Running the Tests

The integration tests verify that the `/api/assets/bulk-move` endpoint correctly:

1. Moves assets from the root images array to folder children arrays
2. Moves assets between folders 
3. Moves assets from folders back to the root
4. Handles invalid folder paths with proper error responses
5. Maintains the hierarchical folder structure in assets.json

To run the tests:

```bash
cd packages/coverflow
NODE_ENV=development BYPASS_AUTH=true npm start &
# Wait for server to start
node tests/test-bulk-move.js
```

## Test Coverage

- ✅ Moving asset from root to folder
- ✅ Moving asset from folder back to root  
- ✅ Error handling for invalid folder paths
- ✅ Verification of assets.json structure after moves
- ✅ Recursive asset finding and removal
- ✅ Proper folder path resolution