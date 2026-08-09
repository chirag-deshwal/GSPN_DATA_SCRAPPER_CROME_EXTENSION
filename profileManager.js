/**
 * Profile Manager
 * Handles saving, loading, and managing user profiles with preferences
 */

class ProfileManager {
  constructor() {
    this.defaultProfile = {
      name: 'Default',
      createdAt: new Date().toISOString(),
      settings: {
        closerHelperEnabled: true,
        autoExport: false,
        autoExportFormat: 'xls',
        theme: 'light'
      }
    };
  }

  /**
   * Get all saved profiles
   */
  async getAllProfiles() {
    return new Promise((resolve) => {
      chrome.storage.local.get('userProfiles', (data) => {
        const profiles = data.userProfiles || [];
        resolve(profiles);
      });
    });
  }

  /**
   * Get current active profile
   */
  async getCurrentProfile() {
    return new Promise((resolve) => {
      chrome.storage.local.get('currentProfile', (data) => {
        resolve(data.currentProfile || null);
      });
    });
  }

  /**
   * Create a new profile
   */
  async createProfile(profileName, settings = {}) {
    try {
      const profiles = await this.getAllProfiles();
      
      // Check if profile name already exists
      if (profiles.some(p => p.name === profileName)) {
        throw new Error(`Profile "${profileName}" already exists`);
      }

      const newProfile = {
        id: Date.now().toString(),
        name: profileName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        settings: {
          closerHelperEnabled: settings.closerHelperEnabled !== false,
          autoExport: settings.autoExport || false,
          autoExportFormat: settings.autoExportFormat || 'xls',
          theme: settings.theme || 'light'
        }
      };

      profiles.push(newProfile);
      
      return new Promise((resolve) => {
        chrome.storage.local.set({ userProfiles: profiles }, () => {
          resolve(newProfile);
        });
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Load a profile (set as current)
   */
  async loadProfile(profileId) {
    try {
      const profiles = await this.getAllProfiles();
      const profile = profiles.find(p => p.id === profileId);

      if (!profile) {
        throw new Error('Profile not found');
      }

      return new Promise((resolve) => {
        chrome.storage.local.set({ currentProfile: profile }, () => {
          // Apply settings
          this.applyProfileSettings(profile.settings);
          resolve(profile);
        });
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update a profile
   */
  async updateProfile(profileId, updates) {
    try {
      const profiles = await this.getAllProfiles();
      const profileIndex = profiles.findIndex(p => p.id === profileId);

      if (profileIndex === -1) {
        throw new Error('Profile not found');
      }

      const profile = profiles[profileIndex];
      profile.name = updates.name || profile.name;
      profile.settings = { ...profile.settings, ...updates.settings };
      profile.updatedAt = new Date().toISOString();
      profiles[profileIndex] = profile;

      return new Promise((resolve) => {
        chrome.storage.local.set({ userProfiles: profiles }, () => {
          // Update current profile if it's the active one
          chrome.storage.local.get('currentProfile', (data) => {
            if (data.currentProfile && data.currentProfile.id === profileId) {
              chrome.storage.local.set({ currentProfile: profile }, () => {
                this.applyProfileSettings(profile.settings);
                resolve(profile);
              });
            } else {
              resolve(profile);
            }
          });
        });
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete a profile
   */
  async deleteProfile(profileId) {
    try {
      const profiles = await this.getAllProfiles();
      const filteredProfiles = profiles.filter(p => p.id !== profileId);

      return new Promise((resolve) => {
        chrome.storage.local.set({ userProfiles: filteredProfiles }, () => {
          // If deleted profile was current, clear current
          chrome.storage.local.get('currentProfile', (data) => {
            if (data.currentProfile && data.currentProfile.id === profileId) {
              chrome.storage.local.remove('currentProfile', () => {
                resolve(true);
              });
            } else {
              resolve(true);
            }
          });
        });
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Apply profile settings to extension
   */
  async applyProfileSettings(settings) {
    return new Promise((resolve) => {
      chrome.storage.local.set({
        closerHelperEnabled: settings.closerHelperEnabled,
        autoExport: settings.autoExport,
        autoExportFormat: settings.autoExportFormat,
        theme: settings.theme
      }, () => {
        // Dispatch event to notify popup of changes
        chrome.runtime.sendMessage({
          action: 'profileApplied',
          settings: settings
        }).catch(() => {
          // Popup may not be open, that's okay
        });
        resolve();
      });
    });
  }

  /**
   * Export profile as JSON
   */
  async exportProfile(profileId) {
    try {
      const profiles = await this.getAllProfiles();
      const profile = profiles.find(p => p.id === profileId);

      if (!profile) {
        throw new Error('Profile not found');
      }

      return JSON.stringify(profile, null, 2);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Import profile from JSON
   */
  async importProfile(jsonString) {
    try {
      const importedData = JSON.parse(jsonString);
      
      // Validate profile structure
      if (!importedData.name || !importedData.settings) {
        throw new Error('Invalid profile format');
      }

      const profiles = await this.getAllProfiles();
      
      // Generate new ID to avoid conflicts
      const newProfile = {
        id: Date.now().toString(),
        name: `${importedData.name} (Imported)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        settings: importedData.settings
      };

      profiles.push(newProfile);

      return new Promise((resolve) => {
        chrome.storage.local.set({ userProfiles: profiles }, () => {
          resolve(newProfile);
        });
      });
    } catch (error) {
      throw error;
    }
  }
}

// Create singleton instance
const profileManager = new ProfileManager();
