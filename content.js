/**
 * AICleaner - Advanced Text Cleanup Extension for ChatGPT
 * Content Script Module
 * 
 * This content script runs on ChatGPT pages and provides real-time text processing
 * to fix common formatting issues like em/en dashes, curly quotes, ellipsis,
 * invisible characters, accented characters, and space normalization.
 * 
 * @author luxxyarns
 * @version 2.0
 * @description Content script for real-time text processing on ChatGPT pages
 * 
 * Features:
 * - Real-time text processing using MutationObserver
 * - Multiple text transformation types with individual enable/disable
 * - Performance optimized with throttling and processed node tracking
 * - Shadow DOM support for modern web components
 * - Comprehensive error handling and logging
 * - Statistics tracking with detailed per-fix-type counters
 * - Communication with popup UI for settings and status updates
 * 
 * Text Transformations:
 * - Em/En dashes (—, –) → custom replacement character
 * - Curly quotes (", ", ', ') → straight quotes (", ')
 * - Ellipsis (…) → three dots (...)
 * - Invisible/non-breaking characters → spaces
 * - Accented characters (é, ñ, etc.) → plain ASCII (e, n, etc.)
 * - Multiple spaces → single spaces
 * 
 * Performance Features:
 * - Throttled mutation observation (100ms default)
 * - WeakSet tracking of processed nodes to avoid reprocessing
 * - Intelligent text filtering to skip nodes without target characters
 * - Safe element filtering to avoid breaking scripts/styles
 * 
 * Architecture:
 * - Uses MutationObserver for efficient DOM monitoring
 * - TreeWalker API for fast text node traversal
 * - Chrome extension messaging for popup communication
 * - Chrome storage API for settings persistence
 * - Modular design with separate methods for each transformation type
 */

class AICleanerProcessor {
  constructor() {
    this.debugMode = true;
    this.isActive = false;
    this.observer = null;
    this.settings = { replacer: "-", history: [] };
    this.replacementCount = 0;
    this.processedNodes = new WeakSet();
    this.lastScanTime = 0;
    this.scanThrottle = 100; // ms
    
    this.init();
  }

  log(message, data = null) {
    if (this.debugMode) {
      console.log(`[AICleaner] ${message}`, data || '');
    }
  }

  async init() {
    try {
      this.log('Content script initializing...');
      await this.loadSettings();
      this.setupMessageListener();
      this.startObserver();
      this.performInitialScan();
      this.isActive = true;
      this.log('Content script initialized successfully');
    } catch (error) {
      this.log('Error initializing content script:', error);
    }
  }

  async loadSettings() {
    return new Promise(resolve => {
      chrome.storage.sync.get([
        "replacer", 
        "history", 
        "totalReplacements",
        "fixEmDash",
        "fixCurlyQuotes", 
        "fixEllipsis",
        "fixInvisibleChars",
        "fixAccents",
        "fixSpaces"
      ], (data) => {
        this.settings = {
          replacer: data.replacer || "-",
          history: data.history || [],
          totalReplacements: data.totalReplacements || 0,
          fixEmDash: data.fixEmDash !== false,
          fixCurlyQuotes: data.fixCurlyQuotes !== false,
          fixEllipsis: data.fixEllipsis !== false,
          fixInvisibleChars: data.fixInvisibleChars !== false,
          fixAccents: data.fixAccents === true,
          fixSpaces: data.fixSpaces !== false
        };
        this.log('Settings loaded:', this.settings);
        resolve();
      });
    });
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.log('Message received:', message);
      
      try {
        switch (message.action) {
          case 'ping':
            sendResponse({ 
              success: true, 
              status: 'active',
              url: window.location.href,
              isActive: this.isActive,
              replacementCount: this.replacementCount
            });
            break;
            
          case 'testReplace':
            this.log('Test replacement requested');
            this.performImmediateScan();
            const testReplacements = this.replacementCount;
            sendResponse({ 
              success: true, 
              message: `Test scan completed. Total replacements: ${testReplacements}`,
              replacements: testReplacements
            });
            break;
            
          case 'settingsUpdated':
            this.log('Settings update received');
            this.loadSettings().then(() => {
              this.performImmediateScan();
              sendResponse({ success: true, message: 'Settings updated and scan performed' });
            }).catch(error => {
              this.log('Error updating settings:', error);
              sendResponse({ success: false, error: error.message });
            });
            return true; // Keep message channel open for async response
            
          default:
            this.log('Unknown action:', message.action);
            sendResponse({ success: false, error: `Unknown action: ${message.action}` });
        }
      } catch (error) {
        this.log('Error handling message:', error);
        sendResponse({ success: false, error: error.message });
      }
    });
  }

  startObserver() {
    if (this.observer) {
      this.observer.disconnect();
    }

    this.observer = new MutationObserver((mutations) => {
      this.handleMutations(mutations);
    });

    const config = {
      childList: true,
      subtree: true,
      characterData: true,
      characterDataOldValue: false
    };

    this.observer.observe(document.body, config);
    this.log('MutationObserver started');
  }

  handleMutations(mutations) {
    const now = Date.now();
    if (now - this.lastScanTime < this.scanThrottle) {
      return;
    }
    this.lastScanTime = now;

    let shouldScan = false;

    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.TEXT_NODE && this.containsTargetText(node.textContent)) {
            shouldScan = true;
            break;
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            if (this.containsTargetTextInSubtree(node)) {
              shouldScan = true;
              break;
            }
          }
        }
      } else if (mutation.type === 'characterData') {
        if (this.containsTargetText(mutation.target.textContent)) {
          shouldScan = true;
        }
      }

      if (shouldScan) break;
    }

    if (shouldScan) {
      this.log('Mutations detected, scanning for text to clean...');
      this.performScan();
    }
  }

  containsTargetText(text) {
    return this.needsProcessing(text);
  }

  containsTargetTextInSubtree(element) {
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    let node;
    while (node = walker.nextNode()) {
      if (this.containsTargetText(node.textContent)) {
        return true;
      }
    }
    return false;
  }

  async performInitialScan() {
    this.log('Performing initial scan...');
    
    // Wait for page to be more stable
    await this.waitForPageLoad();
    
    // Multiple scans to catch dynamically loaded content
    setTimeout(() => this.performScan(), 500);
    setTimeout(() => this.performScan(), 1500);
    setTimeout(() => this.performScan(), 3000);
  }

  waitForPageLoad() {
    return new Promise(resolve => {
      if (document.readyState === 'complete') {
        resolve();
      } else {
        window.addEventListener('load', resolve, { once: true });
      }
    });
  }

  performImmediateScan() {
    this.log('Performing immediate scan...');
    this.performScan();
  }

  performScan() {
    if (!this.isActive) return;

    const startTime = performance.now();
    const localHistory = [];
    let replacementsThisScan = 0;

    try {
      // Scan main document
      replacementsThisScan += this.replaceInRoot(document.body, localHistory);

      // Scan shadow roots
      const shadowRoots = this.findShadowRoots();
      for (const shadowRoot of shadowRoots) {
        replacementsThisScan += this.replaceInRoot(shadowRoot, localHistory);
      }

      // Update statistics and history
      if (replacementsThisScan > 0) {
        this.replacementCount += replacementsThisScan;
        this.updateStorageWithResults(localHistory, replacementsThisScan);
        
        const scanTime = (performance.now() - startTime).toFixed(2);
        this.log(`Scan completed: ${replacementsThisScan} replacements in ${scanTime}ms`);
      }

    } catch (error) {
      this.log('Error during scan:', error);
    }
  }

  findShadowRoots() {
    const shadowRoots = [];
    const elements = document.querySelectorAll('*');
    
    for (const element of elements) {
      if (element.shadowRoot) {
        shadowRoots.push(element.shadowRoot);
      }
    }
    
    return shadowRoots;
  }

  applyTextFixes(text) {
    let fixedText = text;
    let fixCounts = {
      emDash: 0,
      curlyQuotes: 0,
      ellipsis: 0,
      invisibleChars: 0,
      accents: 0,
      spaces: 0
    };

    // Em/En dash fixes
    if (this.settings.fixEmDash) {
      const emDashRegex = /[\u2014\u2013]/g;
      const matches = fixedText.match(emDashRegex);
      if (matches) {
        fixCounts.emDash = matches.length;
        fixedText = fixedText.replace(emDashRegex, this.settings.replacer);
      }
    }

    // Curly quotes fixes
    if (this.settings.fixCurlyQuotes) {
      const curlyQuoteRegex = /[\u201C\u201D\u2018\u2019]/g;
      const matches = fixedText.match(curlyQuoteRegex);
      if (matches) {
        fixCounts.curlyQuotes = matches.length;
        fixedText = fixedText
          .replace(/[\u201C\u201D]/g, '"')  // Curly double quotes
          .replace(/[\u2018\u2019]/g, "'"); // Curly single quotes
      }
    }

    // Ellipsis fixes
    if (this.settings.fixEllipsis) {
      const ellipsisRegex = /\u2026/g;
      const matches = fixedText.match(ellipsisRegex);
      if (matches) {
        fixCounts.ellipsis = matches.length;
        fixedText = fixedText.replace(ellipsisRegex, '...');
      }
    }

    // Invisible/non-breaking character fixes
    if (this.settings.fixInvisibleChars) {
      const invisibleRegex = /[\u00A0\u2000-\u200F\u2028\u2029\u202F\u205F\u3000\uFEFF]/g;
      const matches = fixedText.match(invisibleRegex);
      if (matches) {
        fixCounts.invisibleChars = matches.length;
        fixedText = fixedText.replace(invisibleRegex, ' ');
      }
    }

    // Accent stripping
    if (this.settings.fixAccents) {
      const accentMap = {
        'À': 'A', 'Á': 'A', 'Â': 'A', 'Ã': 'A', 'Ä': 'A', 'Å': 'A',
        'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a', 'å': 'a',
        'È': 'E', 'É': 'E', 'Ê': 'E', 'Ë': 'E',
        'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e',
        'Ì': 'I', 'Í': 'I', 'Î': 'I', 'Ï': 'I',
        'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i',
        'Ò': 'O', 'Ó': 'O', 'Ô': 'O', 'Õ': 'O', 'Ö': 'O',
        'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o',
        'Ù': 'U', 'Ú': 'U', 'Û': 'U', 'Ü': 'U',
        'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u',
        'Ñ': 'N', 'ñ': 'n', 'Ç': 'C', 'ç': 'c'
      };
      
      let accentCount = 0;
      fixedText = fixedText.replace(/[À-ÿ]/g, (char) => {
        if (accentMap[char]) {
          accentCount++;
          return accentMap[char];
        }
        return char;
      });
      fixCounts.accents = accentCount;
    }

    // Space normalization
    if (this.settings.fixSpaces) {
      const spaceRegex = /\s+/g;
      const beforeSpaces = fixedText.match(spaceRegex);
      const afterSpaces = fixedText.replace(spaceRegex, ' ').trim();
      
      if (beforeSpaces && afterSpaces !== fixedText.trim()) {
        fixCounts.spaces = beforeSpaces.length;
        fixedText = afterSpaces;
      }
    }

    return { fixedText, fixCounts };
  }

  replaceInRoot(root, localHistory) {
    if (!root) return 0;

    let totalReplacements = 0;
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          // Skip already processed nodes
          if (this.processedNodes.has(node)) {
            return NodeFilter.FILTER_SKIP;
          }
          
          // Skip nodes that don't need processing
          if (!this.needsProcessing(node.textContent)) {
            return NodeFilter.FILTER_SKIP;
          }
          
          // Skip certain elements for performance/safety
          const parent = node.parentElement;
          if (parent && (
            parent.tagName === 'SCRIPT' ||
            parent.tagName === 'STYLE' ||
            parent.tagName === 'NOSCRIPT' ||
            parent.isContentEditable ||
            parent.closest('[contenteditable="true"]')
          )) {
            return NodeFilter.FILTER_SKIP;
          }
          
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let node;
    while (node = walker.nextNode()) {
      const original = node.textContent;
      const { fixedText, fixCounts } = this.applyTextFixes(original);
      
      if (original !== fixedText) {
        try {
          node.textContent = fixedText;
          this.processedNodes.add(node);
          
          const totalFixes = Object.values(fixCounts).reduce((sum, count) => sum + count, 0);
          
          localHistory.push({
            before: original,
            after: fixedText,
            timestamp: Date.now(),
            url: window.location.href,
            fixCounts: fixCounts,
            totalFixes: totalFixes
          });
          
          totalReplacements += totalFixes;
          
        } catch (error) {
          this.log('Error replacing text in node:', error);
        }
      }
    }

    return totalReplacements;
  }

  needsProcessing(text) {
    if (!text) return false;
    
    // Check if any of the enabled fixes would apply
    if (this.settings.fixEmDash && /[\u2014\u2013]/.test(text)) return true;
    if (this.settings.fixCurlyQuotes && /[\u201C\u201D\u2018\u2019]/.test(text)) return true;
    if (this.settings.fixEllipsis && /\u2026/.test(text)) return true;
    if (this.settings.fixInvisibleChars && /[\u00A0\u2000-\u200F\u2028\u2029\u202F\u205F\u3000\uFEFF]/.test(text)) return true;
    if (this.settings.fixAccents && /[À-ÿ]/.test(text)) return true;
    if (this.settings.fixSpaces && /\s{2,}/.test(text)) return true;
    
    return false;
  }

  async updateStorageWithResults(localHistory, replacementCount) {
    try {
      const currentData = await new Promise(resolve => {
        chrome.storage.sync.get(["history", "totalReplacements", "fixStats"], resolve);
      });

      const newHistory = (currentData.history || []).concat(localHistory);
      const newTotal = (currentData.totalReplacements || 0) + replacementCount;

      // Aggregate fix statistics
      const currentFixStats = currentData.fixStats || {
        emDash: 0, curlyQuotes: 0, ellipsis: 0, 
        invisibleChars: 0, accents: 0, spaces: 0
      };

      localHistory.forEach(entry => {
        if (entry.fixCounts) {
          currentFixStats.emDash += entry.fixCounts.emDash || 0;
          currentFixStats.curlyQuotes += entry.fixCounts.curlyQuotes || 0;
          currentFixStats.ellipsis += entry.fixCounts.ellipsis || 0;
          currentFixStats.invisibleChars += entry.fixCounts.invisibleChars || 0;
          currentFixStats.accents += entry.fixCounts.accents || 0;
          currentFixStats.spaces += entry.fixCounts.spaces || 0;
        }
      });

      // Keep history manageable (last 100 entries)
      const trimmedHistory = newHistory.slice(-100);

      await new Promise(resolve => {
        chrome.storage.sync.set({
          history: trimmedHistory,
          totalReplacements: newTotal,
          fixStats: currentFixStats
        }, resolve);
      });

      // Notify popup of stats update and send processed text
      try {
        const processedText = localHistory.map(entry => entry.after).join('\n');
        chrome.runtime.sendMessage({
          action: 'updateStats',
          count: replacementCount,
          processedText: processedText,
          fixStats: currentFixStats
        });
      } catch (error) {
        this.log('Could not notify popup:', error);
      }

      this.log(`Storage updated - ${replacementCount} new replacements, total: ${newTotal}`);

    } catch (error) {
      this.log('Error updating storage:', error);
    }
  }

  destroy() {
    this.log('Destroying content script...');
    this.isActive = false;
    
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    
    this.processedNodes = new WeakSet();
  }
}

// Initialize the AICleaner content script
function initializeAICleaner() {
  try {
    if (window.aiCleanerProcessor) {
      console.log('[AICleaner] Already initialized, destroying previous instance');
      window.aiCleanerProcessor.destroy();
    }
    
    window.aiCleanerProcessor = new AICleanerProcessor();
    console.log('[AICleaner] Content script initialized successfully');
  } catch (error) {
    console.error('[AICleaner] Failed to initialize content script:', error);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeAICleaner);
} else {
  initializeAICleaner();
}

// Handle page unload
window.addEventListener('beforeunload', () => {
  if (window.aiCleanerProcessor) {
    window.aiCleanerProcessor.destroy();
  }
});

// Add global error handler for the content script
window.addEventListener('error', (event) => {
  if (event.filename && event.filename.includes('content.js')) {
    console.error('[AICleaner] Content script error:', event.error);
  }
});

