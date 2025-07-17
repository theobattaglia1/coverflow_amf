# AMF Admin Dashboard

A modern, accessible admin interface for managing covers and assets in the All My Friends coverflow application.

## Overview

The admin dashboard provides a comprehensive interface for:
- Managing album covers (create, edit, delete, reorder)
- Asset management with folder organization
- User management (admin only)
- Batch operations and bulk editing
- Real-time save states and session management

## Architecture

### Main Components

- **`dashboard-swiss.js`** - Main dashboard logic with enhanced UX/UI features
- **`index.html`** - Primary admin interface
- **`admin.css`** - Swiss-style modern CSS framework
- **`login.html`** - Authentication interface

### Key Features

#### Cover Management
- **Grid/List/Coverflow Views** - Multiple viewing modes for different workflows
- **Drag & Drop Reordering** - Intuitive cover sequence management
- **Batch Operations** - Select multiple covers for bulk actions
- **Live Search & Filtering** - Real-time cover filtering by title, artist, category
- **Pagination** - Performance-optimized pagination for large collections

#### Asset Management
- **Folder Organization** - Hierarchical asset organization
- **Drag & Drop Upload** - Direct file uploads with progress indicators
- **Multi-select Operations** - Bulk asset management
- **Lazy Loading** - Performance-optimized image loading
- **Infinite Scroll** - Seamless browsing of large asset collections

#### UX/UI Enhancements
- **Persistent Batch Toolbar** - Always-visible batch operation controls
- **Loading States** - Skeleton screens and progress indicators
- **Keyboard Shortcuts** - Full keyboard navigation support
- **Modal Accessibility** - ARIA-compliant modals with focus management
- **Confirmation Dialogs** - Prevent accidental destructive actions
- **Onboarding Tips** - Contextual help for new users

### Data Flow

1. **Authentication** - Session-based auth with keepalive
2. **Data Loading** - Covers loaded from `/data/covers.json`, assets from `/api/assets`
3. **State Management** - Local state with change tracking
4. **Auto-save** - Automatic saving when changes detected
5. **Real-time Updates** - UI updates reflect data changes immediately

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + F` | Focus search box |
| `Ctrl/Cmd + B` | Toggle batch mode |
| `Ctrl/Cmd + M` | Toggle multi-select mode |
| `Ctrl/Cmd + A` | Select all items |
| `Escape` | Exit modes/deselect |
| `Ctrl/Cmd + ←/→` | Navigate pages |
| `Delete` | Delete selected assets |

### Accessibility Features

- **ARIA Labels** - Comprehensive screen reader support
- **Focus Management** - Proper tab order and focus trapping
- **Keyboard Navigation** - Full functionality without mouse
- **High Contrast** - Swiss design with clear visual hierarchy
- **Semantic HTML** - Proper heading structure and landmarks

## Development

### File Structure
```
admin/
├── dashboard-swiss.js      # Main dashboard logic
├── index.html             # Primary admin interface
├── admin.css              # Swiss-style CSS framework
├── login.html             # Authentication page
└── README.md             # This documentation
```

### Key Functions

#### Core Functions
- `init()` - Initialize dashboard and setup event listeners
- `loadCovers()` - Load cover data from server
- `loadAssets()` - Load asset data and folder structure
- `saveChanges()` - Save all pending changes to server

#### Cover Management
- `editCover(cover)` - Open edit modal for cover
- `createCoverElement(cover, index)` - Generate cover DOM element
- `toggleBatchMode()` - Switch between normal and batch modes
- `renderCurrentView()` - Render covers in selected view mode

#### Asset Management
- `handleAssetUpload(files)` - Process uploaded asset files
- `navigateToFolder(path)` - Change current folder
- `setupDragAndDrop()` - Initialize drag & drop functionality

#### UX Features
- `showConfirmDialog(message)` - Display confirmation dialog
- `showProgressIndicator(message, progress)` - Show loading progress
- `setupKeyboardShortcuts()` - Initialize keyboard navigation
- `showOnboardingTips()` - Display help tips for new users

### State Management

The dashboard maintains several key state variables:

```javascript
// Core state
let covers = [];              // Array of cover objects
let assets = {};             // Asset data structure
let hasChanges = false;      // Tracks unsaved changes
let currentUser = null;      // Current authenticated user

// UI state
let batchMode = false;       // Batch selection mode
let selectedCovers = new Set(); // Selected cover IDs
let currentViewMode = 'grid'; // Current view mode
let searchTerm = '';         // Current search query

// Performance
let currentPage = 1;         // Current pagination page
let isLoadingMore = false;   // Infinite scroll loading state
```

### Performance Optimizations

- **Lazy Loading** - Images load only when visible
- **Infinite Scroll** - Assets load incrementally
- **Skeleton Screens** - Loading placeholders improve perceived performance
- **Debounced Search** - Search queries debounced to reduce API calls
- **Virtual Scrolling** - Large lists rendered efficiently

### Security Considerations

- **Session Management** - Automatic session keepalive and timeout
- **CSRF Protection** - All form submissions include CSRF tokens
- **Input Validation** - Client and server-side validation
- **Role-based Access** - Different features based on user role

## Troubleshooting

### Common Issues

1. **Modal Not Opening** - Check that `coverModal` element exists in DOM
2. **Images Not Loading** - Verify asset URLs and server accessibility
3. **Save Failures** - Check authentication status and network connectivity
4. **Performance Issues** - Reduce asset count or enable lazy loading

### Debug Mode

Enable debug logging by setting:
```javascript
window.AMF_DEBUG = true;
```

### Browser Support

- Chrome 80+ (recommended)
- Firefox 75+
- Safari 13+
- Edge 80+

## Migration Notes

This dashboard consolidates functionality from previous versions:
- `dashboard.js` - Merged enhanced features
- `dashboard-original.js` - Merged batch operations
- All functionality preserved with enhanced UX/UI