# Admin Dashboard API Documentation

## Overview
The admin dashboard provides a comprehensive interface for managing covers, assets, and site content for the All My Friends platform.

## Recent Fixes (2025-07-16)
✅ **Fixed 404 errors on `/push-live` endpoint**
✅ **Enhanced data persistence with atomic writes and backups**
✅ **Improved admin routing for both development and production**
✅ **Added comprehensive error handling and logging**
✅ **Implemented backup/restore functionality**

## Admin Endpoints

### Authentication
- `POST /api/login` - User authentication
- `POST /api/logout` - User logout
- `GET /api/me` - Get current user info

### Cover Management
- `POST /save-cover` - Save individual cover (with atomic write and backup)
- `POST /save-covers` - Bulk save covers array
- `POST /delete-cover` - Delete a cover
- `GET /data/covers.json` - Get all covers data

### Asset Management
- `POST /save-assets` - Save assets data
- `POST /upload-image` - Upload new images
- `GET /api/list-gcs-assets` - List Google Cloud Storage assets
- `GET /data/assets.json` - Get all assets data

### Publishing
- `POST /push-live` - **FIXED** - Publish all changes live with validation
  - Enhanced with comprehensive validation
  - Returns detailed status and validation results
  - Proper error handling and rollback

### System Health & Monitoring
- `GET /api/health` - System health check and status
- `GET /api/backup/list` - List available backup files
- `POST /api/backup/restore/:type` - Restore data from backup

### User Management (Admin only)
- `GET /api/users` - List all users
- `POST /api/users` - Create new user
- `DELETE /api/users/:username` - Delete user

## Data Persistence Features

### Atomic Writes
All data operations use atomic file writes:
1. Create backup of existing file
2. Write to temporary file
3. Atomic rename to final location
4. Cleanup and error handling

### Automatic Backups
- Automatic backup before each write operation
- Backup files: `*-backup.json`
- Restore functionality available through API

### Caching
- Intelligent caching with TTL
- Automatic cache invalidation on updates
- Performance optimized for frequent reads

## Development Environment

### Local Testing
```bash
# Start server with authentication bypass
NODE_ENV=development BYPASS_AUTH=true npm start

# Access admin interface
http://localhost:10000/admin/

# Test with admin subdomain simulation
curl -H "Host: admin.localhost:10000" http://localhost:10000/push-live
```

### Production Environment
- Admin interface: `https://admin.allmyfriendsinc.com/`
- Proper subdomain routing
- Enhanced security and session management

## Error Handling

### Comprehensive Logging
- All admin operations are logged with timestamps
- User actions are tracked for audit
- Detailed error messages for debugging

### Validation
- Input validation on all endpoints
- File integrity checks before publishing
- Graceful error responses with details

## Security Features
- Role-based access control (admin, editor, viewer)
- Session management with secure cookies
- CORS configuration for subdomain access
- Rate limiting on authentication endpoints

## Migration Notes
If upgrading from previous versions:
1. Backup files will be automatically created
2. No breaking changes to existing data format
3. Enhanced endpoints are backward compatible
4. Additional logging may increase storage usage