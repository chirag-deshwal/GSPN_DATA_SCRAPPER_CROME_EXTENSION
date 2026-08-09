# Profile System - Technical Implementation

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│         GSPN Data Scraper Extension                 │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Popup (popup.html/js)  ←→  Profile Manager.js     │
│        ↓                           ↓                │
│     Closer Helper       Chrome Storage Local        │
│     Toggle Settings     (Profiles Database)         │
│                                                     │
│  Profile Manager Page (profiles.html/js/css)       │
│        ↓                                            │
│  Full Profile CRUD UI                              │
│  Import/Export JSON                                │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## File Purposes

### 1. profileManager.js
**Role:** Core business logic for profile operations

**Key Methods:**
```javascript
// CRUD Operations
async getAllProfiles()           // Retrieve all profiles
async getCurrentProfile()        // Get active profile
async createProfile(name, settings)  // Create new
async loadProfile(profileId)     // Activate profile
async updateProfile(id, updates) // Modify profile
async deleteProfile(profileId)   // Remove profile

// Import/Export
async exportProfile(profileId)   // Download as JSON
async importProfile(jsonString)  // Upload JSON

// Apply Settings
async applyProfileSettings(settings)  // Sync to extension
```

**Data Storage:**
```
chrome.storage.local:
  {
    "userProfiles": [
      {
        "id": "timestamp",
        "name": "Profile Name",
        "createdAt": "ISO-string",
        "updatedAt": "ISO-string",
        "settings": {
          "closerHelperEnabled": boolean,
          "autoExport": boolean,
          "autoExportFormat": "xls|csv",
          "theme": "light|dark"
        }
      }
    ],
    "currentProfile": { ...profile object... }
  }
```

### 2. profiles.html / profiles.css / profiles.js
**Role:** Complete UI for profile management

**UI Components:**
- Profile creation form
- Profile cards grid (responsive)
- Detail modal for editing
- Import/Export buttons
- Confirmation dialogs
- Toast notifications

**Event Handlers:**
- Create profile
- Load/Edit/Delete profile
- Import/Export profile
- Modal interactions

### 3. popup.html / popup.js
**Role:** Integration point between main popup and profiles

**Changes Made:**
- Added profile button (👤) in header
- Loads profileManager.js
- Syncs Closer Helper toggle with profiles
- Listens for profile application events

## Data Flow

### Creating a Profile
```
User Input Form
       ↓
profileManager.createProfile()
       ↓
Generate ID & timestamp
       ↓
chrome.storage.local.set()
       ↓
profiles array updated
       ↓
UI refreshed
       ↓
Success toast
```

### Loading a Profile
```
User clicks "Load Profile"
       ↓
profileManager.loadProfile(id)
       ↓
Find profile in storage
       ↓
Set as currentProfile
       ↓
applyProfileSettings()
       ↓
chrome.storage.local.set()
       ↓
Send message to popup
       ↓
Popup updates Closer Helper toggle
       ↓
Settings applied instantly
```

### Exporting a Profile
```
User clicks "Export"
       ↓
profileManager.exportProfile(id)
       ↓
JSON.stringify(profile)
       ↓
Create Blob
       ↓
Generate download URL
       ↓
Trigger browser download
       ↓
File saved as JSON
```

### Importing a Profile
```
User selects JSON file
       ↓
file.text() - read content
       ↓
profileManager.importProfile(jsonString)
       ↓
JSON.parse() - validate
       ↓
Generate new ID
       ↓
Add "(Imported)" to name
       ↓
Save to storage
       ↓
UI updated
       ↓
Success notification
```

## Integration with Extension

### Popup Integration
```javascript
// Load profile settings when popup opens
async function loadProfileSettings() {
  const currentProfile = await profileManager.getCurrentProfile();
  if (currentProfile) {
    // Apply settings from profile
  }
}

// Listen for profile changes
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'profileApplied') {
    loadProfileSettings();  // Reload
  }
});
```

### Settings Application
```javascript
async applyProfileSettings(settings) {
  // Update chrome.storage.local
  chrome.storage.local.set({
    closerHelperEnabled: settings.closerHelperEnabled,
    autoExport: settings.autoExport,
    autoExportFormat: settings.autoExportFormat,
    theme: settings.theme
  });
  
  // Notify popup
  chrome.runtime.sendMessage({
    action: 'profileApplied',
    settings: settings
  });
}
```

## Error Handling

### Try-Catch Pattern
```javascript
try {
  // Operation
  await profileManager.operation();
} catch (error) {
  showToast(error.message, 'error');
  console.error(error);
} finally {
  // Cleanup
}
```

### Validation
```javascript
// Profile name validation
if (!name || !name.trim()) {
  throw new Error('Profile name cannot be empty');
}

// Duplicate check
if (profiles.some(p => p.name === profileName)) {
  throw new Error(`Profile "${profileName}" already exists`);
}

// JSON validation
if (!importedData.name || !importedData.settings) {
  throw new Error('Invalid profile format');
}
```

## Storage Limits & Performance

### Chrome Storage Limits
- Local storage: 10MB per extension
- Per item: No specific limit
- Profile size: ~200 bytes average
- Capacity: ~50,000 profiles possible (well beyond practical needs)

### Performance Optimization
```javascript
// Async operations don't block UI
await chrome.storage.local.get();
await chrome.storage.local.set();

// Toast notifications auto-dismiss
setTimeout(() => {
  toast.classList.add('hidden');
}, 3000);

// Modal lazy loads only when opened
openProfileModal(profileId) {
  // Fetch data when needed
}
```

## Security Considerations

### Data Protection
- Profiles stored locally (not transmitted)
- No sensitive data in profiles (only preferences)
- Export file is plain JSON (user responsibility)
- No authentication needed (user's local storage)

### Input Validation
```javascript
// HTML escape to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;  // Uses textContent, not innerHTML
  return div.innerHTML;
}

// Applied in rendering
html += `<div>${escapeHtml(profile.name)}</div>`;
```

## Extensibility

### Adding New Profile Settings
1. Add field to `ProfileManager.defaultProfile.settings`
2. Add UI control in `profiles.html` (checkbox/select/input)
3. Update modal form handling in `profiles.js`
4. Settings auto-apply in `applyProfileSettings()`

**Example:**
```javascript
// 1. Add to defaults
defaultProfile: {
  settings: {
    // ...existing...
    newSetting: 'default_value'
  }
}

// 2. Add HTML control
<input id="modalNewSetting" type="checkbox" />

// 3. Update modal form
const newSetting = document.getElementById('modalNewSetting').value;

// 4. Include in updates
settings: {
  newSetting: newSetting
}
```

### Future Features
- Profile scheduling (auto-switch at times)
- Profile templates/presets
- Cloud sync profiles
- Profile version history
- Collaborative profiles (shared teams)

## Testing Checklist

- [ ] Create profile with various names
- [ ] Load profile and verify settings apply
- [ ] Edit profile name and settings
- [ ] Delete profile and confirm
- [ ] Export profile to JSON
- [ ] Import profile from JSON
- [ ] Verify duplicate profile name prevention
- [ ] Check Closer Helper toggle syncs with profile
- [ ] Test modal open/close
- [ ] Verify toast notifications
- [ ] Test responsive design on mobile
- [ ] Clear all storage and start fresh
- [ ] Verify profile persistence after extension reload

## Browser Compatibility
- Chrome 91+ (uses Service Worker manifest v3)
- Storage API: Supported
- File Download: Supported
- Modern ES6+ features: Supported

## Debugging Tips

### View Stored Profiles
```javascript
// In Chrome DevTools console
chrome.storage.local.get('userProfiles', (data) => {
  console.log(data.userProfiles);
});
```

### Clear All Profiles
```javascript
chrome.storage.local.remove('userProfiles', () => {
  console.log('All profiles cleared');
});
```

### View Current Profile
```javascript
chrome.storage.local.get('currentProfile', (data) => {
  console.log(data.currentProfile);
});
```

### Monitor Storage Changes
```javascript
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    console.log('Storage changed:', changes);
  }
});
```
