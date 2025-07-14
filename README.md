# AICleaner - Advanced Text Cleanup Extension for ChatGPT

AICleaner is a powerful Chrome extension that automatically fixes common text formatting issues in ChatGPT conversations. It provides instant, real-time text processing with comprehensive cleanup options and detailed statistics tracking.

## Features

### 🔧 Text Transformations
- **Em/En Dashes** (—, –) → Custom replacement character (default: hyphen)
- **Curly Quotes** (", ", ', ') → Straight quotes (", ')
- **Ellipsis** (…) → Three dots (...)
- **Invisible Characters** → Spaces (non-breaking spaces, zero-width chars, etc.)
- **Accented Characters** (é, ñ, ü, etc.) → Plain ASCII (e, n, u, etc.)
- **Space Normalization** → Multiple spaces reduced to single spaces

### 📊 Advanced Features
- **Real-time Processing** - Instant text cleanup as ChatGPT generates responses
- **Detailed Statistics** - Track total fixes and breakdown by category
- **Copy-to-Clipboard** - Copy cleaned text for pasting anywhere
- **Settings Export/Import** - Backup and share your configurations
- **Debug Panel** - Troubleshoot connection and processing issues
- **Preset Options** - Quick setup for common replacement patterns

### 🎨 Modern Interface
- Clean, responsive popup design
- Visual feedback for all operations
- Error handling with helpful messages
- Session statistics tracking
- History of recent text transformations

## Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension folder
5. The AICleaner icon should appear in your extensions toolbar

## Usage

### Basic Setup
1. **Navigate to ChatGPT** - Go to https://chatgpt.com or https://chat.openai.com
2. **Click the AICleaner icon** in your browser toolbar
3. **Configure text fixes** - Enable/disable specific transformations
4. **Set dash replacement** - Choose what to replace em/en dashes with
5. **Save settings** - Click "Save Settings" to apply changes

### Text Fix Options
- ✅ **Em/En dashes → hyphen** - Converts — and – to your chosen replacement
- ✅ **Curly quotes → straight quotes** - Converts " " and ' ' to " and '
- ✅ **Ellipsis → three dots** - Converts … to ...
- ✅ **Remove invisible chars** - Removes non-breaking spaces and hidden characters
- ⚠️ **Strip accents** - Converts é→e, ñ→n (disabled by default)
- ✅ **Normalize spaces** - Reduces multiple spaces to single spaces

### Advanced Features
- **Test Now** - Manually trigger text processing on current page
- **Debug Panel** - View connection status and processing information
- **Copy Fixed Text** - Copy processed text to clipboard for use elsewhere
- **Export Settings** - Save configuration as JSON file
- **Import Settings** - Load saved configuration

## Technical Details

### Architecture
The extension consists of three main components:

1. **Content Script** (`content.js`) - Runs on ChatGPT pages, monitors DOM changes, applies text transformations
2. **Popup UI** (`popup.js`, `popup.html`) - Provides user interface for configuration and control
3. **Background Service** (`background.js`) - Handles extension lifecycle and cross-component communication

### Performance Optimizations
- **Throttled Processing** - Limits text processing to prevent performance issues
- **Smart Filtering** - Only processes text nodes that contain target characters
- **Processed Node Tracking** - Prevents reprocessing of already-cleaned text
- **Safe Element Filtering** - Skips scripts, styles, and editable content

### Browser Compatibility
- **Chrome** - Full support (Manifest V3)
- **Edge** - Should work (Chromium-based)
- **Firefox** - Not supported (different manifest format)

## Development

### Project Structure
```
├── manifest.json          # Extension manifest
├── popup.html             # Popup interface
├── popup.js               # Popup logic and UI control
├── content.js             # Content script for text processing
├── background.js          # Background service worker
├── icon.png              # Extension icon
└── README.md             # This file
```

### Building
No build process required - this is a vanilla JavaScript extension.

### Testing
1. Load the extension in Chrome developer mode
2. Navigate to ChatGPT
3. Open the popup and verify all controls work
4. Test text transformations with sample content
5. Check browser console for any errors

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source. Feel free to modify and distribute.

## Author

**luxxyarns** - [GitHub Profile](https://github.com/luxxyarns)

## Support

For issues, questions, or feature requests:
- Open an issue on GitHub
- Check the debug panel for troubleshooting information
- Review browser console for error messages

## Changelog

### Version 2.0
- Complete rewrite with modern architecture
- Added multiple text transformation types
- Implemented real-time processing with MutationObserver
- Added detailed statistics tracking
- Improved UI with debug panel and copy functionality
- Enhanced error handling and logging
- Added settings export/import
- Optimized performance with throttling and smart filtering

### Version 1.x
- Basic em dash replacement functionality
- Simple popup interface
- Manual processing trigger

## Privacy

AICleaner:
- Only runs on ChatGPT pages (chatgpt.com, chat.openai.com)
- Processes text locally in your browser
- Does not send any data to external servers
- Stores settings locally using Chrome's storage API
- Does not track or collect user data