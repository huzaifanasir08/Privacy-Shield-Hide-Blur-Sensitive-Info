
# 🛡️ Privacy Shield — Hide & Blur Sensitive Info

A lightweight, high-performance Chrome Extension built with Manifest V3 that instantly hides and blurs sensitive information (balances, PII, database URIs, API keys, and custom elements) on any webpage.

Perfect for developers, remote workers, SaaS presenters, content creators, and streamers who want to protect their privacy during screen shares, video recordings, or presentations.

---

## ✨ Key Features

***🔍 Visual Element Selector (Inspect Mode)**

* Pick and hide elements visually (like DevTools). Click *"Select Element on Page"* from the popup, hover over any section to see a **teal neon highlight overlay** and a live CSS selector tooltip, and click to blur it instantly.

***💸 Automatic Balance & Currency Scanning**

* Scans page contents dynamically to hide monetary values worldwide (`$`, `€`, `£`, `Rs.`, `PKR`, `₹`, `¥`, etc.) as soon as they mount.

***⚡ Zero Flicker Injections**

* Custom CSS selectors are injected directly into the document root at `document_start`, preventing sensitive data from flashing during page loads.

***🔄 Full Single-Page App (SPA) Support**

* Leverages optimized, debounced `MutationObserver` and `TreeWalker` algorithms to catch content loading dynamically in React, Next.js, Vue, and AJAX dashboards without causing browser lag.

***🎛️ Glassmorphic Control Dashboard**

* Slate-dark settings panel to toggle temporary hover-reveal, adjust blur intensity, whitelist specific domains, and manage custom CSS selectors.

***⌨️ Instant Hotkey Toggle**

* Press `Alt + Shift + B` to toggle the protection filter globally at any moment.

***🔒 Privacy-First Design**

* All scanning, calculations, and custom selector rules happen 100% offline on your local machine using Chrome's secure storage API. Zero analytics or server calls.

---

## 📸 Visual Demonstration

### Custom Selectors & Balances Blurred

Below is the extension active on our custom dark-mode financial sandbox:


<img width="1280" height="800" alt="Without Blur" src="https://github.com/user-attachments/assets/46a83986-7e97-4ae1-90dd-dbd260328556" />


### Extension Control Popup

Adjust settings, add/remove selectors, and inspect the page directly from the extension popup interface:


<img width="1280" height="800" alt="Sheild Managment" src="https://github.com/user-attachments/assets/98670bd3-8f58-47cf-a545-0f5dd0e9f16b" />


### Visual Selector (Inspect Mode)

Hovering over elements highlights them with a neon cyan overlay and previews their CSS selector path before clicking:


<img width="1280" height="800" alt="CSS Selector" src="https://github.com/user-attachments/assets/b33b7a15-2f47-47b1-9362-4465b4365565" />


### Blurred Content

The content is blurred to conceal related information. Selected selectors are added to the list and are saved permanently until removed:


<img width="1280" height="800" alt="Selection Blurred 1" src="https://github.com/user-attachments/assets/3de71806-ee49-4639-9940-22976b0fd46c" />

<img width="1280" height="800" alt="Selection Blurred 2" src="https://github.com/user-attachments/assets/0b42adb2-3510-439d-bad6-5a7e08e1ed95" />




---

## 🛠️ Project Structure

```text

├── manifest.json         # Extension Manifest V3 metadata & permissions

├── background.js        # Background worker for commands & badge states

├── content.js           # DOM scanner, MutationObserver, and Inspect Mode

├── content.css          # Core blurs, hover-reveals, and overlay styles

├── popup.html           # Settings UI (Control panel)

├── popup.css            # Slate-dark glassmorphism styling

├── popup.js             # Chrome Storage syncing & visual selectors dispatcher

├── mock_dashboard.html  # Premium Fintech sandbox for E2E testing

├── test_extension.py    # Playwright E2E extension test suite

└── test_inspect.py      # Playwright inspect-mode hover/click test suite

```

---

## 🚀 Quick Start / Local Installation

### 1. Load the Extension in Chrome

1. Open Google Chrome and go to `chrome://extensions/`.
2. Turn on **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked** (button in the top-left corner).
4. Select the directory containing this repository (the folder containing `manifest.json`).

### 2. Launch the Test Sandbox

To see the extension in action and test its features locally, open the mock dashboard:

1. In your terminal, navigate to this project folder.
2. Start a local HTTP server:

   ```bash

   python -m http.server 8080

   ```
3. Navigate to: [http://localhost:8080/mock_dashboard.html](http://localhost:8080/mock_dashboard.html)

---

## 🧪 Running Automated Tests

The repository includes a comprehensive, browser-based end-to-end (E2E) test suite written with Python and Playwright.

### Prerequisites

Make sure Python is installed, then set up the test dependencies:

```bash

pipinstallplaywright

playwrightinstall

```

### Run the Tests

Ensure you do not have any local server running on port `8080` (or Django running on `8000`), then run:

```bash

# Run general extension features & storage tests

pythontest_extension.py


# Run visual inspect mode hover, click & select tests

pythontest_inspect.py

```

Test screenshots showing various UI states will be automatically saved inside the `test_artifacts/` directory.

---

## 📜 License

This project is licensed under the MIT License. Feel free to modify, distribute, and integrate it into your workflows.
