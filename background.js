/**
 * AICleaner - Advanced Text Cleanup Extension for ChatGPT
 * Background Service Worker
 * 
 * This service worker handles extension lifecycle events, settings migration,
 * and cross-component communication for the AICleaner extension.
 * 
 * @author nordfriese
 * @version 2.0
 * @description Background service worker for AICleaner extension
 * 
 * Features:
 * - Extension installation and update handling
 * - Default settings initialization
 * - Settings migration between versions
 * - Cross-tab communication and state management
 * - Error logging and debugging support
 * - Tab monitoring for ChatGPT pages
 * 
 * Responsibilities:
 * - Initialize default settings on first install
 * - Handle version updates and data migration
 * - Manage communication between popup and content scripts
 * - Monitor tab changes for ChatGPT pages
 * - Provide extension status and health information
 * - Handle error reporting from other components
 * 
 * Architecture:
 * - Service Worker pattern for efficient background processing
 * - Chrome extension APIs for lifecycle management
 * - Chrome storage API for settings persistence
 * - Event-driven architecture for component communication
 */

class AICleanerBackgroundService {
  constructor() {
    this.debugMode = true;
    this.init();
  }

  log(message, data = null) {
    if (this.debugMode) {
      console.log(`[AICleaner-BG] ${message}`, data || '');
    }
  }

  init() {
    this.log('Background service initializing...');
    this.setupEventListeners();
    this.log('Background service initialized');
  }

  setupEventListeners() {
    // Handle extension installation/update
    chrome.runtime.onInstalled.addListener((details) => {
      this.handleInstalled(details);
    });

    // Handle messages from content scripts
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open
    });

    // Handle tab updates to inject content script if needed
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      this.handleTabUpdate(tabId, changeInfo, tab);
    });

    this.log('Event listeners set up');
  }

  handleInstalled(details) {
    if (details.reason === 'install') {
      this.log('Extension installed for the first time');
      this.setDefaultSettings();
    } else if (details.reason === 'update') {
      this.log(`Extension updated from version ${details.previousVersion}`);
      this.handleUpdate(details.previousVersion);
    }
  }

  async setDefaultSettings() {
    try {
      const defaultSettings = {
        replacer: '-',
        history: [],
        totalReplacements: 0,
        debugMode: true,
        autoReplace: true,
        scanDelay: 100,
        fixEmDash: true,
        fixCurlyQuotes: true,
        fixEllipsis: true,
        fixInvisibleChars: true,
        fixAccents: false,
        fixSpaces: true,
        fixStats: {},
        installDate: Date.now()
      };

      await new Promise(resolve => {
        chrome.storage.sync.set(defaultSettings, resolve);
      });

      this.log('Default settings initialized', defaultSettings);
    } catch (error) {
      this.log('Error setting default settings:', error);
    }
  }

  async handleUpdate(previousVersion) {
    try {
      // Migration logic for updates
      const data = await new Promise(resolve => {
        chrome.storage.sync.get(null, resolve);
      });

      let needsUpdate = false;
      const updates = {};

      // Add new settings if they don't exist
      if (!data.hasOwnProperty('debugMode')) {
        updates.debugMode = true;
        needsUpdate = true;
      }

      if (!data.hasOwnProperty('autoReplace')) {
        updates.autoReplace = true;
        needsUpdate = true;
      }

      if (!data.hasOwnProperty('scanDelay')) {
        updates.scanDelay = 100;
        needsUpdate = true;
      }

      if (!data.hasOwnProperty('fixEmDash')) {
        updates.fixEmDash = true;
        needsUpdate = true;
      }

      if (!data.hasOwnProperty('fixCurlyQuotes')) {
        updates.fixCurlyQuotes = true;
        needsUpdate = true;
      }

      if (!data.hasOwnProperty('fixEllipsis')) {
        updates.fixEllipsis = true;
        needsUpdate = true;
      }

      if (!data.hasOwnProperty('fixInvisibleChars')) {
        updates.fixInvisibleChars = true;
        needsUpdate = true;
      }

      if (!data.hasOwnProperty('fixAccents')) {
        updates.fixAccents = false;
        needsUpdate = true;
      }

      if (!data.hasOwnProperty('fixSpaces')) {
        updates.fixSpaces = true;
        needsUpdate = true;
      }

      if (!data.hasOwnProperty('fixStats')) {
        updates.fixStats = {};
        needsUpdate = true;
      }

      if (!data.hasOwnProperty('updateDate')) {
        updates.updateDate = Date.now();
        needsUpdate = true;
      }

      if (needsUpdate) {
        await new Promise(resolve => {
          chrome.storage.sync.set(updates, resolve);
        });
        this.log('Settings migrated for update', updates);
      }

    } catch (error) {
      this.log('Error handling update:', error);
    }
  }

  handleMessage(message, sender, sendResponse) {
    this.log('Message received:', message);

    switch (message.action) {
      case 'updateStats':
        this.handleStatsUpdate(message, sender);
        sendResponse({ success: true });
        break;

      case 'getStatus':
        this.getExtensionStatus().then(status => {
          sendResponse({ success: true, status });
        });
        break;

      case 'logError':
        this.log(`Error from ${sender.tab?.url}:`, message.error);
        sendResponse({ success: true });
        break;

      default:
        this.log('Unknown message action:', message.action);
        sendResponse({ success: false, error: 'Unknown action' });
    }
  }

  async handleStatsUpdate(message, sender) {
    try {
      const tabInfo = {
        url: sender.tab?.url,
        title: sender.tab?.title,
        timestamp: Date.now()
      };

      this.log(`Stats update from tab: ${tabInfo.title}`, {
        count: message.count,
        url: tabInfo.url
      });

      // Could store per-tab statistics here if needed
      
    } catch (error) {
      this.log('Error handling stats update:', error);
    }
  }

  async handleTabUpdate(tabId, changeInfo, tab) {
    // Only act on complete page loads for ChatGPT
    if (changeInfo.status !== 'complete') return;
    
    const isChatGPT = tab.url && (
      tab.url.includes('chat.openai.com') || 
      tab.url.includes('chatgpt.com')
    );

    if (isChatGPT) {
      this.log(`ChatGPT tab loaded: ${tab.url}`);
      
      try {
        // Ensure content script is injected and ready
        await chrome.tabs.sendMessage(tabId, { action: 'ping' });
      } catch (error) {
        // Content script not responding, might need injection
        this.log('Content script not responding, may need manual injection');
      }
    }
  }

  async getExtensionStatus() {
    try {
      const data = await new Promise(resolve => {
        chrome.storage.sync.get([
          'totalReplacements',
          'history',
          'replacer',
          'installDate'
        ], resolve);
      });

      return {
        totalReplacements: data.totalReplacements || 0,
        historyCount: (data.history || []).length,
        currentReplacer: data.replacer || '-',
        installDate: data.installDate,
        isActive: true
      };
    } catch (error) {
      this.log('Error getting extension status:', error);
      return { isActive: false, error: error.message };
    }
  }
}

// Initialize AICleaner background service
new AICleanerBackgroundService();