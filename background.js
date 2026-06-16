// Privacy Shield Background Service Worker

// Initialize default settings on install
chrome.runtime.onInstalled.addListener(() => {
  const DEFAULT_SETTINGS = {
    enabled: true,
    blurIntensity: 8,
    revealOnHover: true,
    currencies: ["$", "€", "£", "Rs", "PKR", "₹", "¥"],
    customRegex: "",
    customSelectors: {
      "github.com": [".repo-amount-mock", "[data-testid=\"text-total-received\"]"]
    },
    excludedSites: []
  };

  chrome.storage.local.get(null, (existing) => {
    const toSet = {};
    for (let key in DEFAULT_SETTINGS) {
      if (existing[key] === undefined) {
        toSet[key] = DEFAULT_SETTINGS[key];
      }
    }
    if (Object.keys(toSet).length > 0) {
      chrome.storage.local.set(toSet, () => {
        console.log("Privacy Shield: Default settings initialized.", toSet);
      });
    }
  });
});

// Handle custom hotkey commands
chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle-blur") {
    chrome.storage.local.get("enabled", (data) => {
      const currentStatus = data.enabled !== undefined ? data.enabled : true;
      const nextStatus = !currentStatus;
      
      chrome.storage.local.set({ enabled: nextStatus }, () => {
        console.log(`Privacy Shield: Toggled via command shortcut. Enabled = ${nextStatus}`);
        
        // Optional: Notify active tab using browser action badge
        updateBadge(nextStatus);
      });
    });
  }
});

// Helper to update the badge indicating status
function updateBadge(enabled) {
  const text = enabled ? "" : "OFF";
  const color = enabled ? "#10b981" : "#ef4444";
  
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
}

// Update badge on startup based on current storage
chrome.storage.local.get("enabled", (data) => {
  const enabled = data.enabled !== undefined ? data.enabled : true;
  updateBadge(enabled);
});

// Listen to storage changes to keep badge synced
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "local" && changes.enabled) {
    updateBadge(changes.enabled.newValue);
  }
});
