## PROFILE SYSTEM - USER INTERFACE GUIDE

### 1. MAIN POPUP WITH PROFILE BUTTON

```
┌─────────────────────────────────────────┐
│ 🎨 GSPN Data Scraper        👤 Profiles │ ← Click to open Profile Manager
│    Samsung Service Portal               │
└─────────────────────────────────────────┘
│                                         │
│  Status: ⚫ Ready to scrape             │
│                                         │
│  [🔍 Scrape Data]  [⬇️ Export Excel]    │
│                    [📋 Copy]            │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ ⚙️ Closer Helper         [Toggle] 🔧 ││
│  │ Disabled — Enable on GSPN page      ││
│  └─────────────────────────────────────┘│
│                                         │
│  Works only on biz2.samsungcsportal.com │
└─────────────────────────────────────────┘
```

---

### 2. PROFILE MANAGER PAGE

```
┌──────────────────────────────────────────────────────┐
│ ← | Profile Manager                                  │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ Create New Profile                                   │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Enter profile name          [+ Create Profile]  │ │
│ └─────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ Your Profiles                                        │
│                                                      │
│ ┌──────────────────┐  ┌──────────────────┐          │
│ │ Work Settings    │  │ Weekend Mode     │          │
│ │  [✓ Active]      │  │                  │          │
│ │ ✓ Closer: On     │  │ ✓ Closer: Off    │          │
│ │ ✓ Auto Export: On│  │ ✕ Auto Export: Off          │
│ │ Created: 5/20    │  │ Created: 5/18    │          │
│ └──────────────────┘  └──────────────────┘          │
│                                                      │
│ ┌──────────────────┐  ┌──────────────────┐          │
│ │ Development      │  │ Testing Preset   │          │
│ │                  │  │                  │          │
│ │ ✕ Closer: Off    │  │ ✓ Closer: On     │          │
│ │ ✕ Auto Export: Off  │ ✕ Auto Export: Off          │
│ │ Created: 4/15    │  │ Created: 3/10    │          │
│ └──────────────────┘  └──────────────────┘          │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ Import / Export                                      │
│ [⬆️ Import Profile]                                  │
└──────────────────────────────────────────────────────┘
```

---

### 3. PROFILE DETAILS MODAL

```
┌────────────────────────────────────────┐
│ Work Settings                      ✕   │
├────────────────────────────────────────┤
│                                        │
│ Profile Name                           │
│ [Work Settings________________]        │
│                                        │
│ Settings                               │
│ ┌────────────────────────────────────┐│
│ │ ☑ Closer Helper                    ││
│ │   Enable Closer Helper on load     ││
│ │                                     ││
│ │ ☐ Auto Export                      ││
│ │   Export data when scraping done   ││
│ │                                     ││
│ │ Export Format                       ││
│ │ [Excel (.xls) ▼]                   ││
│ │                                     ││
│ │ Theme                               ││
│ │ [Light ▼]                           ││
│ └────────────────────────────────────┘│
│                                        │
│ Created: 5/27/2026, 10:30 AM          │
│ Last updated: 5/27/2026, 2:45 PM      │
│                                        │
├────────────────────────────────────────┤
│ [🗑️ Delete] [⬇️ Export] [💾 Save]    │
│            [✓ Load Profile]            │
└────────────────────────────────────────┘
```

---

### 4. CONFIRMATION DIALOGS

#### Delete Confirmation
```
┌──────────────────────────────────────┐
│ Confirm Action                    ✕  │
├──────────────────────────────────────┤
│ Are you sure you want to delete      │
│ "Weekend Mode"? This action cannot   │
│ be undone.                           │
├──────────────────────────────────────┤
│ [Cancel]              [🗑️ Delete]    │
└──────────────────────────────────────┘
```

---

### 5. NOTIFICATIONS (TOASTS)

```
Success:
┌────────────────────────────────────────┐
│ ✓ Profile "Work Settings" created     │
└────────────────────────────────────────┘

Error:
┌────────────────────────────────────────┐
│ ✗ Profile name already exists          │
└────────────────────────────────────────┘

Info:
┌────────────────────────────────────────┐
│ Profile exported successfully          │
└────────────────────────────────────────┘
```

---

## WORKFLOW EXAMPLES

### Example 1: Create a Work Profile
1. Click 👤 button in popup
2. Type "Work Settings"
3. Click [+ Create Profile]
4. Click on the new card
5. Enable Closer Helper ✓
6. Set Auto Export: On ✓
7. Click [💾 Save Changes]
8. Click [✓ Load Profile]
9. ✓ Settings applied!

### Example 2: Load Weekend Profile
1. Click 👤 button in popup
2. Find "Weekend Mode" card
3. Click on it
4. Review settings (preview in modal)
5. Click [✓ Load Profile]
6. ✓ Settings applied immediately
7. Modal closes automatically

### Example 3: Export & Share Profile
1. Open Profile Manager
2. Click on desired profile
3. Click [⬇️ Export]
4. JSON file downloads
5. Share file with colleague
6. Colleague clicks [⬆️ Import Profile]
7. Selects the JSON file
8. ✓ Profile imported!

### Example 4: Delete Profile
1. Open Profile Manager
2. Click on profile to delete
3. Click [🗑️ Delete]
4. Confirm in popup
5. ✓ Profile deleted
6. Modal closes

---

## SETTINGS REFERENCE

| Setting | Options | Default | Purpose |
|---------|---------|---------|---------|
| Closer Helper | On/Off | Off | Enable Closer Helper by default |
| Auto Export | On/Off | Off | Auto-export after scraping |
| Export Format | .xls / .csv | .xls | Excel or CSV format |
| Theme | Light / Dark | Light | UI theme preference |

---

## KEYBOARD SHORTCUTS
- `Tab` - Navigate between fields
- `Enter` - Submit form / Confirm action
- `Escape` - Close modal

---

## TIPS & TRICKS

💡 **Create Multiple Profiles for Different Tasks**
   - "Daily Operations" - Main workflow
   - "Bulk Processing" - Auto-export enabled
   - "Testing" - Debug settings

💡 **Use Export for Backup**
   - Export profiles regularly
   - Share configs with team
   - Quick recovery if needed

💡 **Profile-Specific Preferences**
   - Different themes for different times
   - Auto-export for specific workflows
   - Quick switching between modes

💡 **Import Team Profiles**
   - Get pre-configured profiles from team
   - Standardize workflows
   - Save setup time

