# Profile System - Quick Start Guide

## 🚀 Getting Started in 2 Minutes

### Step 1: Create Your First Profile
1. Open the GSPN Data Scraper popup
2. Click the **👤 Profile button** (top-right corner)
3. Type a profile name: `"My First Profile"`
4. Click **[+ Create Profile]**
5. ✓ Profile created!

### Step 2: Configure Profile Settings
1. Click on your new profile card
2. The profile detail modal opens
3. **Configure your preferences:**
   - Toggle **Closer Helper** (On/Off)
   - Toggle **Auto Export** (On/Off)
   - Select **Export Format** (Excel or CSV)
   - Choose **Theme** (Light or Dark)
4. Click **[💾 Save Changes]**
5. ✓ Settings saved!

### Step 3: Load & Use Profile
1. Go back to your profile
2. Click **[✓ Load Profile]**
3. ✓ Profile activated!
4. Your settings apply immediately
5. Use the main popup as normal

---

## 📋 Common Tasks

### Create Multiple Profiles
**Use Case:** Different workflows, settings for different tasks

```
Profile 1: "Daily Work"
  ✓ Closer Helper: ON
  ✓ Auto Export: ON

Profile 2: "Manual Processing"
  ✓ Closer Helper: OFF
  ✓ Auto Export: OFF

Profile 3: "Bulk Export"
  ✓ Closer Helper: OFF
  ✓ Auto Export: ON
  ✓ Format: CSV
```

**Steps:**
1. Create each profile (see Quick Start)
2. Click profile → Configure → Save
3. Repeat for each profile
4. Load desired profile when needed

### Switch Between Profiles
**Time:** 5 seconds

```
Current Profile: "Daily Work"
Need: "Manual Processing"

1. Click 👤 Profile button
2. Click "Manual Processing" card
3. Click [✓ Load Profile]
4. Done! Settings switched
```

### Backup Your Profiles
**Use Case:** Protect your settings

```
1. Open Profile Manager
2. Click any profile
3. Click [⬇️ Export]
4. Save JSON file to safe location
5. You can restore it later with [⬆️ Import Profile]
```

### Share Profiles with Team
**Use Case:** Standardize workflows across team

```
Team Lead Creates Profile:
1. Configure "Team Standard Settings"
2. Click [⬇️ Export]
3. Share JSON file

Team Member Imports Profile:
1. Receive JSON file
2. Open Profile Manager
3. Click [⬆️ Import Profile]
4. Select the JSON file
5. Profile installed as "Team Standard Settings (Imported)"
6. Click to load
```

### Reset to Default
**If something goes wrong:**

1. Open Profile Manager
2. Click [⬇️ Delete] on problematic profile
3. Confirm deletion
4. Create new profile with defaults
5. Set your preferences again

---

## 🎯 Real-World Examples

### Example: Office Worker

**Morning Profile (8 AM - 12 PM)**
- Closer Helper: ON
- Auto Export: OFF
- Theme: Light
- Action: Manual processing, careful work

**Afternoon Profile (1 PM - 5 PM)**
- Closer Helper: ON  
- Auto Export: ON (auto-save work)
- Theme: Light
- Action: Bulk processing, quick turnover

**Friday Evening Profile**
- Closer Helper: OFF
- Auto Export: ON
- Format: CSV
- Theme: Dark (eye strain relief)
- Action: End-of-week cleanup, faster

### Example: Power User

**Development Profile**
- For testing and debugging
- Closer Helper: OFF
- Auto Export: OFF
- Manual control of everything

**Production Profile**
- Safe settings for live work
- Closer Helper: ON (safe)
- Auto Export: ON (automated)
- Format: Excel (client expects)

**Backup Profile**
- Emergency settings
- All safety checks ON
- Never auto-export
- Manual review required

---

## ⚡ Pro Tips

### Tip 1: Use Descriptive Names
✅ GOOD: "Monday-Friday Daily Work", "Weekend Processing"
❌ BAD: "Profile1", "Test", "Backup"

### Tip 2: Export Regularly
- Export profiles weekly
- Store backups safely
- Recover if data lost

### Tip 3: Version Your Profiles
- "WorkFlow v1.0" 
- "WorkFlow v1.1 - Updated"
- Easy to track changes

### Tip 4: Share Standards
- Create company standard profiles
- Distribute to team
- Ensures consistency

### Tip 5: Use Profiles for Different Clients
- "Client A Settings"
- "Client B Settings"  
- "Client C Settings"
- Quick switching between clients

---

## ❓ Frequently Asked Questions

**Q: How many profiles can I create?**
A: Unlimited! (Practically 50,000+)

**Q: Can I sync profiles across devices?**
A: Not yet, but you can export and import manually.

**Q: Will profiles be lost if I uninstall?**
A: Yes. Export profiles to backup before uninstalling.

**Q: Can I edit a profile without loading it?**
A: Yes! Click on the profile, edit settings, click Save. The profile stays inactive.

**Q: What if I forget a profile's settings?**
A: Click on the profile card to view all settings in the modal.

**Q: Can I delete the active profile?**
A: Yes, but if you delete it, no profile will be active until you load another one.

**Q: How do I reset everything to default?**
A: Delete all profiles and create a new one with default settings.

---

## 🔄 Workflow: First Time Setup

### Scenario: New to Profile System

**Step 1: Audit Current Settings** (2 min)
- Current Closer Helper enabled? Yes/No
- Do you want auto-export? Yes/No
- What export format? (Excel/CSV)
- Preferred theme? (Light/Dark)

**Step 2: Create Profile** (1 min)
- Name it: "Default Settings"
- Configure based on Step 1
- Save changes

**Step 3: Load Profile** (30 sec)
- Click [✓ Load Profile]
- Verify settings apply
- Close Profile Manager

**Step 4: Test Everything** (3 min)
- Use popup normally
- Verify settings work as expected
- Verify Closer Helper toggle reflects profile

**Step 5: Create Variations** (Optional)
- Create 2-3 more profiles for different tasks
- Same naming pattern
- Keep organized

**Total Time:** ~10 minutes ⏱️

---

## 🛠️ Troubleshooting

### Issue: Settings not applying when profile loads
**Solution:**
1. Reload the extension (refresh page)
2. Try loading profile again
3. Check console for errors (DevTools)

### Issue: Can't delete a profile
**Solution:**
1. Close any open modals
2. Try again
3. Confirm deletion in popup

### Issue: Import file not working
**Solution:**
1. Ensure file is valid JSON (not renamed from text)
2. File should be exported from this extension
3. Try exporting from your profile and importing that test file

### Issue: Profile button not visible
**Solution:**
1. Extension may need reload
2. Close and reopen popup
3. Verify popup.html includes profile button

### Issue: Profile settings not saving
**Solution:**
1. Check chrome.storage.local permissions
2. Clear browser cache
3. Reload extension

---

## 📞 Support Resources

### Need Help?
1. Check this guide first
2. Read PROFILE_SYSTEM_README.md for features
3. Check PROFILE_UI_GUIDE.md for visual help
4. Review PROFILE_TECHNICAL_GUIDE.md for advanced info

### Check the Logs
```javascript
// Open DevTools (F12)
// Go to Console tab
// View any error messages
// Send to support with screenshot
```

---

## ✅ Verification Checklist

After setup, verify everything works:
- [ ] Can create profiles
- [ ] Can load profiles  
- [ ] Can edit profile settings
- [ ] Can delete profiles
- [ ] Can export profile to JSON
- [ ] Can import profile from JSON
- [ ] Settings apply when profile loads
- [ ] Closer Helper toggle syncs with profile
- [ ] Notifications work (toast messages)
- [ ] Can switch between profiles quickly

**If all checks pass:** ✅ Profile system ready to use!

---

## 🎓 Next Steps

1. **Create** your main workflow profile
2. **Configure** settings for your use case
3. **Load** the profile
4. **Test** with real data
5. **Create** alternate profiles for other workflows
6. **Export** backups regularly
7. **Share** with team if collaborative

---

## 🚀 You're All Set!

Your profile system is ready. Start creating profiles and enjoy quick settings switching!

**Happy Profiling! 👤**
