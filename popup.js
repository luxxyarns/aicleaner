/**
 * AICleaner - Advanced Text Cleanup Extension for ChatGPT
 * 
 * This extension provides comprehensive text cleaning capabilities for ChatGPT conversations,
 * including em/en dash replacement, curly quote straightening, ellipsis conversion,
 * invisible character removal, accent stripping, and space normalization.
 * 
 * @author nordfriese
 * @version 2.0
 * @description Popup UI controller for AICleaner extension
 * 
 * Features:
 * - Real-time text processing with instant replacement
 * - Multiple text fix options (dashes, quotes, ellipsis, etc.)
 * - Detailed statistics tracking with per-fix-type counters
 * - Settings export/import functionality
 * - Debug panel for troubleshooting
 * - Copy-to-clipboard functionality for processed text
 * - Preset replacement options
 * - Modern, responsive UI with visual feedback
 * 
 * Architecture:
 * - Communicates with content script via Chrome extension messaging
 * - Stores settings in Chrome sync storage
 * - Provides real-time feedback and error handling
 * - Modular design with separate methods for each feature
 * 
 * Usage:
 * 1. Configure text fix options using checkboxes
 * 2. Set custom replacement character for em/en dashes
 * 3. Save settings to apply to all ChatGPT pages
 * 4. Use "Test Now" to manually trigger processing
 * 5. View statistics and history of fixes applied
 * 6. Export/import settings for backup/sharing
 */

class AICleaner {
  /**
   * Initialize the AICleaner popup interface
   * Sets up initial state, debug mode, and session statistics
   */
  constructor() {
    this.debugMode = true;
    this.sessionStats = { replacements: 0, startTime: Date.now() };
    this.lastTestResult = null;
    this.init();
  }

  /**
   * Initialize the popup interface
   * Binds event listeners, loads settings, and sets up debug panel
   */
  init() {
    this.log('UI initialized');
    this.bindEvents();
    this.loadSettings();
    this.updateStats();
    this.refreshDebugInfo();
    
    // Show debug panel if in debug mode
    if (this.debugMode) {
      document.getElementById('debugPanel').style.display = 'block';
    }
  }

  /**
   * Log messages to console if debug mode is enabled
   * @param {string} message - The message to log
   * @param {*} data - Optional data to log alongside the message
   */
  log(message, data = null) {
    if (this.debugMode) {
      console.log(`[AICleaner] ${message}`, data || '');
    }
  }

  bindEvents() {
    try {
      document.getElementById("saveBtn").addEventListener("click", () => this.saveSettings());
      document.getElementById("testBtn").addEventListener("click", () => this.testReplacement());
      document.getElementById("clearHistory").addEventListener("click", () => this.clearHistory());
      
      document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const value = e.target.getAttribute('data-value');
          document.getElementById('replacer').value = value;
          this.log(`Preset selected: "${value}"`);
        });
      });

      document.getElementById('replacer').addEventListener('input', (e) => {
        this.validateInput(e.target.value);
      });

      // Advanced settings
      document.getElementById('toggleAdvanced').addEventListener('click', () => this.toggleAdvancedSettings());
      document.getElementById('exportSettings').addEventListener('click', () => this.exportSettings());
      document.getElementById('importSettings').addEventListener('click', () => document.getElementById('importFile').click());
      document.getElementById('importFile').addEventListener('change', (e) => this.importSettings(e));
      
      // Range input for scan delay
      const scanDelayInput = document.getElementById('scanDelay');
      const scanDelayValue = document.getElementById('scanDelayValue');
      scanDelayInput.addEventListener('input', (e) => {
        scanDelayValue.textContent = e.target.value;
      });

      // Debug functionality
      document.getElementById('refreshDebug').addEventListener('click', () => this.refreshDebugInfo());

      // Copy functionality
      document.getElementById('copyBtn').addEventListener('click', () => this.copyToClipboard());

      this.log('Event listeners bound successfully');
    } catch (error) {
      this.showStatus('Failed to initialize interface', 'error');
      this.log('Error binding events:', error);
    }
  }

  validateInput(value) {
    const input = document.getElementById('replacer');
    
    if (value.length > 10) {
      input.value = value.substring(0, 10);
      this.showStatus('Maximum 10 characters allowed', 'error');
      return false;
    }
    
    return true;
  }

  async saveSettings() {
    try {
      const saveBtn = document.getElementById('saveBtn');
      const replacer = document.getElementById("replacer").value || "-";
      
      if (!this.validateInput(replacer)) return;

      saveBtn.classList.add('loading');
      this.log(`Saving settings...`);

      const settings = {
        replacer: replacer,
        autoReplace: document.getElementById('autoReplace').checked,
        debugMode: document.getElementById('debugMode').checked,
        scanDelay: parseInt(document.getElementById('scanDelay').value),
        fixEmDash: document.getElementById('fixEmDash').checked,
        fixCurlyQuotes: document.getElementById('fixCurlyQuotes').checked,
        fixEllipsis: document.getElementById('fixEllipsis').checked,
        fixInvisibleChars: document.getElementById('fixInvisibleChars').checked,
        fixAccents: document.getElementById('fixAccents').checked,
        fixSpaces: document.getElementById('fixSpaces').checked,
        lastUpdated: Date.now()
      };

      this.log('Settings to save:', settings);

      const result = await new Promise((resolve, reject) => {
        chrome.storage.sync.set(settings, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });

      this.showStatus('Settings saved successfully!', 'success');
      this.updateCurrentSetting(replacer);
      this.notifyContentScript();
      
    } catch (error) {
      this.showStatus(`Failed to save settings: ${error.message}`, 'error');
      this.log('Error saving settings:', error);
    } finally {
      document.getElementById('saveBtn').classList.remove('loading');
    }
  }

  async testReplacement() {
    try {
      this.log('Testing replacement on current tab');
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      
      this.log('Current tab:', { url: tab.url, id: tab.id, title: tab.title });
      
      if (!tab.url.includes('chatgpt.com') && !tab.url.includes('chat.openai.com')) {
        this.showStatus(`Please navigate to ChatGPT to test (current: ${new URL(tab.url).hostname})`, 'error');
        return;
      }

      this.log('Attempting to send message to content script...');
      
      // First try to ping the content script
      try {
        const pingResponse = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
        this.log('Content script ping response:', pingResponse);
      } catch (pingError) {
        this.log('Content script not responding, attempting injection...');
        
        // Try to inject the content script
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          });
          this.log('Content script injected manually');
          
          // Wait a bit for initialization
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (injectError) {
          this.log('Failed to inject content script:', injectError);
          this.showStatus('Content script injection failed. Try refreshing the page.', 'error');
          return;
        }
      }

      // Now try the test replacement
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'testReplace' });
      this.log('Test replacement response:', response);
      
      this.lastTestResult = response;
      document.getElementById('lastTestResult').textContent = 
        response.success ? `Success: ${response.replacements || 0} replacements` : `Failed: ${response.error}`;
      
      if (response.success) {
        this.showStatus(response.message || 'Test replacement triggered successfully', 'success');
      } else {
        this.showStatus(`Test failed: ${response.error}`, 'error');
      }
      
    } catch (error) {
      this.log('Error testing replacement:', error);
      
      this.lastTestResult = { success: false, error: error.message };
      document.getElementById('lastTestResult').textContent = `Error: ${error.message}`;
      
      if (error.message.includes('Could not establish connection')) {
        this.showStatus('Content script not loaded. Try refreshing the ChatGPT page.', 'error');
      } else if (error.message.includes('The tab was closed')) {
        this.showStatus('Tab was closed during test', 'error');
      } else {
        this.showStatus(`Test failed: ${error.message}`, 'error');
      }
    }
  }

  async notifyContentScript() {
    try {
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      if (tab.url.includes('chatgpt.com') || tab.url.includes('chat.openai.com')) {
        await chrome.tabs.sendMessage(tab.id, { action: 'settingsUpdated' });
        this.log('Content script notified of settings update');
      }
    } catch (error) {
      this.log('Could not notify content script:', error);
    }
  }

  async loadSettings() {
    try {
      const data = await new Promise(resolve => {
        chrome.storage.sync.get([
          "replacer", 
          "history", 
          "totalReplacements", 
          "sessionReplacements",
          "autoReplace",
          "debugMode",
          "scanDelay",
          "fixEmDash",
          "fixCurlyQuotes",
          "fixEllipsis",
          "fixInvisibleChars",
          "fixAccents",
          "fixSpaces",
          "fixStats"
        ], resolve);
      });

      const replacer = data.replacer || "-";
      const history = data.history || [];
      
      document.getElementById("replacer").value = replacer;
      this.updateCurrentSetting(replacer);
      this.renderHistory(history);
      this.updateStats(data);
      
      // Load advanced settings
      document.getElementById('autoReplace').checked = data.autoReplace !== false;
      document.getElementById('debugMode').checked = data.debugMode !== false;
      const scanDelay = data.scanDelay || 100;
      document.getElementById('scanDelay').value = scanDelay;
      document.getElementById('scanDelayValue').textContent = scanDelay;
      
      // Load fix options
      document.getElementById('fixEmDash').checked = data.fixEmDash !== false;
      document.getElementById('fixCurlyQuotes').checked = data.fixCurlyQuotes !== false;
      document.getElementById('fixEllipsis').checked = data.fixEllipsis !== false;
      document.getElementById('fixInvisibleChars').checked = data.fixInvisibleChars !== false;
      document.getElementById('fixAccents').checked = data.fixAccents === true;
      document.getElementById('fixSpaces').checked = data.fixSpaces !== false;
      
      this.log('Settings loaded successfully', data);
      
    } catch (error) {
      this.showStatus('Failed to load settings', 'error');
      this.log('Error loading settings:', error);
    }
  }

  updateCurrentSetting(replacer) {
    const display = replacer === '' ? '(remove)' : replacer;
    const currentSettingEl = document.getElementById('currentSetting');
    if (currentSettingEl) {
      currentSettingEl.textContent = display;
    }
  }

  renderHistory(history) {
    const historyDiv = document.getElementById("history");
    historyDiv.innerHTML = '';

    if (!history || !Array.isArray(history) || history.length === 0) {
      historyDiv.innerHTML = '<div class="empty-state">No replacements yet</div>';
      return;
    }

    try {
      const recentHistory = history.slice(-20).reverse();
      recentHistory.forEach(entry => {
        if (!entry || typeof entry !== 'object') return;
        
        const div = document.createElement("div");
        div.className = "history-item";
        
        const beforeText = (entry.before || '').substring(0, 50) + ((entry.before || '').length > 50 ? '...' : '');
        const afterText = (entry.after || '').substring(0, 50) + ((entry.after || '').length > 50 ? '...' : '');
        
        div.innerHTML = `
          <div class="history-before">${this.escapeHtml(beforeText)}</div>
          <div>↓</div>
          <div class="history-after">${this.escapeHtml(afterText)}</div>
        `;
        
        historyDiv.appendChild(div);
      });

      this.log(`Rendered ${recentHistory.length} history items`);
    } catch (error) {
      this.log('Error rendering history:', error);
      historyDiv.innerHTML = '<div class="empty-state">Error loading history</div>';
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async updateStats(data = null) {
    try {
      if (!data) {
        data = await new Promise(resolve => {
          chrome.storage.sync.get(["totalReplacements", "history", "fixStats"], resolve);
        });
      }

      const totalReplacements = data.totalReplacements || 0;
      const sessionReplacements = this.sessionStats.replacements;
      const fixStats = data.fixStats || {};

      document.getElementById('totalReplacements').textContent = totalReplacements;
      document.getElementById('sessionReplacements').textContent = sessionReplacements;
      
      // Update detailed breakdown
      document.getElementById('emDashCount').textContent = fixStats.emDash || 0;
      document.getElementById('curlyQuoteCount').textContent = fixStats.curlyQuotes || 0;
      document.getElementById('ellipsisCount').textContent = fixStats.ellipsis || 0;
      document.getElementById('invisibleCount').textContent = fixStats.invisibleChars || 0;
      document.getElementById('accentCount').textContent = fixStats.accents || 0;
      document.getElementById('spaceCount').textContent = fixStats.spaces || 0;

      this.log(`Stats updated - Total: ${totalReplacements}, Session: ${sessionReplacements}`);
      
    } catch (error) {
      this.log('Error updating stats:', error);
    }
  }

  async clearHistory() {
    try {
      await new Promise((resolve, reject) => {
        chrome.storage.sync.set({ history: [] }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });

      this.renderHistory([]);
      this.showStatus('History cleared', 'success');
      this.log('History cleared successfully');
      
    } catch (error) {
      this.showStatus('Failed to clear history', 'error');
      this.log('Error clearing history:', error);
    }
  }

  showStatus(message, type = 'success') {
    const statusEl = document.getElementById('statusMessage');
    statusEl.textContent = message;
    statusEl.className = `status-message status-${type} show`;
    
    this.log(`Status: ${type} - ${message}`);
    
    setTimeout(() => {
      statusEl.classList.remove('show');
    }, 3000);
  }

  toggleAdvancedSettings() {
    const advancedSettings = document.getElementById('advancedSettings');
    const isVisible = advancedSettings.style.display !== 'none';
    advancedSettings.style.display = isVisible ? 'none' : 'block';
    this.log(`Advanced settings ${isVisible ? 'hidden' : 'shown'}`);
  }

  async exportSettings() {
    try {
      const data = await new Promise(resolve => {
        chrome.storage.sync.get(null, resolve);
      });

      const exportData = {
        version: '2.0',
        exportDate: new Date().toISOString(),
        settings: {
          replacer: data.replacer,
          autoReplace: data.autoReplace,
          debugMode: data.debugMode,
          scanDelay: data.scanDelay,
          fixEmDash: data.fixEmDash,
          fixCurlyQuotes: data.fixCurlyQuotes,
          fixEllipsis: data.fixEllipsis,
          fixInvisibleChars: data.fixInvisibleChars,
          fixAccents: data.fixAccents,
          fixSpaces: data.fixSpaces
        },
        statistics: {
          totalReplacements: data.totalReplacements,
          historyCount: (data.history || []).length,
          fixStats: data.fixStats
        }
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `aicleaner-settings-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      
      URL.revokeObjectURL(url);
      this.showStatus('Settings exported successfully', 'success');
      this.log('Settings exported');
      
    } catch (error) {
      this.showStatus('Failed to export settings', 'error');
      this.log('Error exporting settings:', error);
    }
  }

  async importSettings(event) {
    try {
      const file = event.target.files[0];
      if (!file) return;

      const text = await file.text();
      const importData = JSON.parse(text);

      if (!importData.settings) {
        throw new Error('Invalid settings file format');
      }

      const settings = importData.settings;
      
      // Update UI with all settings
      if (settings.replacer !== undefined) {
        document.getElementById('replacer').value = settings.replacer;
      }
      if (settings.autoReplace !== undefined) {
        document.getElementById('autoReplace').checked = settings.autoReplace;
      }
      if (settings.debugMode !== undefined) {
        document.getElementById('debugMode').checked = settings.debugMode;
      }
      if (settings.scanDelay !== undefined) {
        document.getElementById('scanDelay').value = settings.scanDelay;
        document.getElementById('scanDelayValue').textContent = settings.scanDelay;
      }
      
      // Update fix options
      if (settings.fixEmDash !== undefined) {
        document.getElementById('fixEmDash').checked = settings.fixEmDash;
      }
      if (settings.fixCurlyQuotes !== undefined) {
        document.getElementById('fixCurlyQuotes').checked = settings.fixCurlyQuotes;
      }
      if (settings.fixEllipsis !== undefined) {
        document.getElementById('fixEllipsis').checked = settings.fixEllipsis;
      }
      if (settings.fixInvisibleChars !== undefined) {
        document.getElementById('fixInvisibleChars').checked = settings.fixInvisibleChars;
      }
      if (settings.fixAccents !== undefined) {
        document.getElementById('fixAccents').checked = settings.fixAccents;
      }
      if (settings.fixSpaces !== undefined) {
        document.getElementById('fixSpaces').checked = settings.fixSpaces;
      }

      this.showStatus('Settings imported successfully', 'success');
      this.log('Settings imported:', settings);
      
    } catch (error) {
      this.showStatus('Failed to import settings', 'error');
      this.log('Error importing settings:', error);
    } finally {
      event.target.value = ''; // Reset file input
    }
  }

  async refreshDebugInfo() {
    try {
      // Get current tab info
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      const hostname = tab.url ? new URL(tab.url).hostname : 'Unknown';
      document.getElementById('currentTabInfo').textContent = `${hostname} (${tab.id})`;
      
      // Check content script status
      try {
        const pingResponse = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
        document.getElementById('contentScriptStatus').textContent = 
          pingResponse.success ? `Active (${pingResponse.replacementCount} replacements)` : 'Inactive';
        document.getElementById('contentScriptStatus').style.color = '#28a745';
      } catch (error) {
        document.getElementById('contentScriptStatus').textContent = 'Not responding';
        document.getElementById('contentScriptStatus').style.color = '#dc3545';
      }
      
      // Update last test result if available
      if (this.lastTestResult) {
        document.getElementById('lastTestResult').textContent = 
          this.lastTestResult.success ? 
            `Success: ${this.lastTestResult.replacements || 0} replacements` : 
            `Failed: ${this.lastTestResult.error}`;
      }
      
      this.log('Debug info refreshed');
      
    } catch (error) {
      this.log('Error refreshing debug info:', error);
      document.getElementById('currentTabInfo').textContent = 'Error loading';
      document.getElementById('contentScriptStatus').textContent = 'Error';
    }
  }

  /**
   * Copy the processed text to clipboard
   * Provides user feedback on success/failure
   */
  async copyToClipboard() {
    try {
      const copyText = document.getElementById('copyText');
      if (!copyText.value) {
        this.showStatus('No text to copy', 'error');
        return;
      }

      await navigator.clipboard.writeText(copyText.value);
      this.showStatus('Text copied to clipboard!', 'success');
      this.log('Text copied to clipboard');
      
    } catch (error) {
      this.showStatus('Failed to copy text', 'error');
      this.log('Error copying to clipboard:', error);
    }
  }
}

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateStats') {
    if (window.aiCleaner) {
      window.aiCleaner.sessionStats.replacements += message.count || 1;
      window.aiCleaner.updateStats();
      
      // Update copy text area if processed text is available
      if (message.processedText) {
        const copyTextArea = document.getElementById('copyText');
        if (copyTextArea) {
          copyTextArea.value = message.processedText;
        }
      }
    }
  }
});

// Initialize the AICleaner popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  try {
    window.aiCleaner = new AICleaner();
  } catch (error) {
    console.error('[AICleaner] Failed to initialize UI:', error);
    // Show basic error message to user
    const container = document.querySelector('.container');
    if (container) {
      container.innerHTML = `
        <div style="padding: 20px; text-align: center; color: #721c24;">
          <h3>Error Loading AICleaner</h3>
          <p>Please reload the extension or check the browser console for details.</p>
          <p style="font-size: 12px; margin-top: 10px;">Error: ${error.message}</p>
        </div>
      `;
    }
  }
});