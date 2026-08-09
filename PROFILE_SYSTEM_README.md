# Profile System - GSPN Data Scraper

## Overview
A complete profile management system has been added to the GSPN Data Scraper extension. This system allows users to save and load different preference profiles with custom settings.

## New Files Created

### 1. **profileManager.js**
Core profile management engine with the following functionality:
- **Create Profiles** - Save user settings as named profiles
- **Load Profiles** - Activate a profile and apply its settings
- **Update Profiles** - Edit profile names and settings
- **Delete Profiles** - Remove profiles
- **Export Profiles** - Download profiles as JSON files
- **Import Profiles** - Upload previously exported profiles

### 2. **profiles.html**
Profile management UI with:
- Create new profile form
- Profile cards showing active status and settings
- Profile detail modal for editing settings
- Import/Export functionality
- Toast notifications for user feedback

### 3. **profiles.css**
Modern styling with:
- Gradient backgrounds (purple/blue theme)
- Responsive grid layout for profile cards
- Modal dialogs for profile editing
- Smooth animations and transitions
- Mobile-friendly responsive design

### 4. **profiles.js**
Profile UI controller handling:
- Profile creation and deletion
- Profile editing and saving
- Loading profiles and applying settings
- Import/Export of profile JSON files
- User feedback via toast notifications

## Features

### Profile Settings
Each profile stores the following user preferences:
- **Closer Helper Status** - Enable/disable Closer Helper on load
- **Auto Export** - Automatically export data after scraping
- **Export Format** - Choose between Excel (.xls) or CSV (.csv)
- **Theme** - Light or dark theme preference

### Profile Management UI
Located at: `profiles.html` (accessible from the main popup)

**Features:**
- ✓ Create new profiles with custom names
- ✓ View all saved profiles in card format
- ✓ See active profile with green indicator
- ✓ View profile creation date
- ✓ Edit profile name and all settings
- ✓ Load profile (activate and apply settings)
- ✓ Delete profiles with confirmation
- ✓ Export profile as JSON
- ✓ Import previously exported profiles
- ✓ Real-time notifications for all actions

### Integration with Main Popup
- New "profile" button (👤 icon) added to top-right of popup header
- Clicking opens the profile manager in a new window
- Settings automatically sync with active profile
- Closer Helper toggle syncs with profile settings

## How to Use

### Creating a Profile
1. Click the **👤 Profile button** in the popup header
2. Enter a profile name (e.g., "Work Settings", "Weekend Mode")
3. Click **Create Profile**
4. Configure settings in the profile card

### Loading a Profile
1. Open Profile Manager (click **👤** button)
2. Click on any profile card
3. Review settings in the modal
4. Click **Load Profile** to activate
5. Settings apply immediately

### Editing a Profile
1. Open Profile Manager
2. Click on a profile card
3. Modify settings in the modal:
   - Change profile name
   - Toggle Closer Helper
   - Toggle Auto Export
   - Select export format
   - Choose theme
4. Click **Save Changes**

### Exporting a Profile
1. Open Profile Manager
2. Click on a profile
3. Click **Export** button
4. Profile saved as JSON file
5. Share with others or backup locally

### Importing a Profile
1. Open Profile Manager
2. Click **Import Profile**
3. Select a JSON profile file
4. Profile imported with "(Imported)" suffix
5. Ready to use immediately

### Deleting a Profile
1. Open Profile Manager
2. Click on a profile
3. Click **Delete Profile**
4. Confirm deletion in popup
5. Profile removed permanently

## Technical Details

### Storage
- Profiles stored in `chrome.storage.local`
- Each profile has unique ID (timestamp-based)
- Settings sync with active profile on popup load
- Supports up to extension storage limits

### Data Structure
```javascript
{
  id: "1234567890",
  name: "Profile Name",
  createdAt: "2026-05-27T...",
  updatedAt: "2026-05-27T...",
  settings: {
    closerHelperEnabled: true,
    autoExport: false,
    autoExportFormat: "xls",
    theme: "light"
  }
}
```

### Popup Integration
- Profile Manager script injected into popup
- Settings auto-load when popup opens
- Changes sync with active profile in real-time
- Handles profile updates even when modal closed

## Benefits

✅ **Save Multiple Configurations** - Different profiles for different workflows
✅ **Quick Setup** - One-click profile loading applies all settings
✅ **Backup & Share** - Export profiles as portable JSON files
✅ **Clean Interface** - Dedicated profile management page
✅ **Real-time Sync** - Settings immediately apply when loaded
✅ **Mobile-Friendly** - Responsive design works on all screen sizes
✅ **User Feedback** - Toast notifications for all operations

## Future Enhancements
- Cloud sync profiles across devices
- Profile presets (templates)
- Schedule automatic profile switching
- Profile-specific keyboard shortcuts
- Advanced filtering in profile manager
