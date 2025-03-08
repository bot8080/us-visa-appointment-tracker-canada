# 🌐 US Visa Appointment Tracker

![License](https://img.shields.io/github/license/yourusername/us-visa-appointment-tracker)
![GitHub last commit](https://img.shields.io/github/last-commit/yourusername/us-visa-appointment-tracker)
![Chrome Web Store Version](https://img.shields.io/chrome-web-store/v/yourextensionid)

A Chrome extension that helps track available US visa appointment dates across multiple consulate locations.

<p align="center">
  <img src="screenshots/extension-popup.png" alt="Extension Screenshot" width="400"/>
</p>

## ✨ Features

- **🌎 Track Multiple Locations**: Monitor visa appointment availability at different US consulates
- **🔄 Real-time Updates**: Refresh appointment data with a single click
- **👁️ On-page Display**: View appointment data directly on the usvisa-info.com website
- **🎨 Visual Indicators**: Color-coded appointments based on how soon they're available
- **⚙️ Location Management**: Add or remove locations you want to track

## 📥 Installation

### Chrome Web Store
*Coming soon*

### Manual Installation
1. Download or clone this repository
   ```
   git clone https://github.com/yourusername/us-visa-appointment-tracker.git
   ```
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked" and select the directory containing the extension files
5. The extension icon should appear in your browser toolbar

## 🚀 Usage

1. **Login to usvisa-info.com**: The extension needs to be authorized with your session
2. **Extract Page Data**: Click "Extract Data from Current Page" when logged in
3. **Refresh Data**: Click "Refresh Data" to check for available appointments
4. **Add Locations**: Go to Settings tab to add locations you want to track
   - You'll need the location ID which can be found in the URL when viewing that location
5. **Toggle Display**: Use "Show/Hide on Page" to display appointment data on the website

<p align="center">
  <img src="screenshots/on-page-display.png" alt="On-page display" width="600"/>
</p>

## 🔧 How It Works

The extension works by:
1. Extracting your authenticated session cookies from usvisa-info.com
2. Making authenticated API requests to check appointment availability for each location
3. Displaying the results in a user-friendly format
4. Storing data locally so you can check availability without repeatedly visiting the website

## 🛡️ Privacy Notice

This extension:
- Does NOT store or transmit your personal information to any external servers
- Only communicates directly with the official usvisa-info.com website
- Stores appointment data and cookies locally in your browser only
- Requires cookie access to authenticate with the visa website (it cannot function without this)

## 👨‍💻 Development

### Project Structure
- `manifest.json` - Extension configuration
- `popup.html/js` - User interface for the extension popup
- `background.js` - Background service worker that handles data fetching
- `content.js` - Content script that modifies the usvisa-info.com page

### Building From Source
No build process required - the extension can be loaded directly from the source files.

## 📃 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## ⚠️ Disclaimer

This extension is not affiliated with, endorsed by, or connected to the US Department of State or any official visa services. It is simply a tool to help users monitor appointment availability on the official visa website.