// Privacy Shield Popup Logic

document.addEventListener("DOMContentLoaded", () => {
  let currentHost = "";
  let settings = {
    enabled: true,
    blurIntensity: 8,
    revealOnHover: true,
    currencies: ["$", "€", "£", "Rs", "PKR", "₹", "¥"],
    customRegex: "",
    customSelectors: {},
    excludedSites: []
  };

  const DEFAULT_CURRENCIES = ["$", "€", "£", "¥", "Rs", "PKR", "₹", "USD", "EUR", "GBP"];

  // Cache elements
  const statusLabel = document.getElementById("status-label");
  const btnToggleEnable = document.getElementById("btn-toggle-enable");
  const powerDesc = document.getElementById("power-desc");
  const inputBlurIntensity = document.getElementById("input-blur-intensity");
  const blurVal = document.getElementById("blur-val");
  const btnToggleHover = document.getElementById("btn-toggle-hover");
  
  const cardCurrentSite = document.getElementById("card-current-site");
  const textCurrentDomain = document.getElementById("text-current-domain");
  const btnToggleDomain = document.getElementById("btn-toggle-domain");

  const labelCurrentHost = document.getElementById("label-current-host");
  const inputNewSelector = document.getElementById("input-new-selector");
  const btnAddSelector = document.getElementById("btn-add-selector");
  const selectorsList = document.getElementById("selectors-list");

  const currencyChipsGrid = document.getElementById("currency-chips-grid");
  const btnEnableRegex = document.getElementById("btn-enable-regex");
  const textareaRegex = document.getElementById("textarea-regex");
  const regexValidationStatus = document.getElementById("regex-validation-status");

  const inputNewExclusion = document.getElementById("input-new-exclusion");
  const btnAddExclusion = document.getElementById("btn-add-exclusion");
  const exclusionsList = document.getElementById("exclusions-list");
  const btnInspectElement = document.getElementById("btn-inspect-element");

  // Get current active tab domain
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    let targetTab = tabs[0];
    
    // If the active tab is the popup itself, try to find any open HTTP/HTTPS tab
    if (targetTab && targetTab.url && targetTab.url.startsWith("chrome-extension:")) {
      chrome.tabs.query({}, (allTabs) => {
        const httpTab = allTabs.find(t => t.url && (t.url.startsWith("http:") || t.url.startsWith("https:")));
        if (httpTab) {
          targetTab = httpTab;
          processTab(targetTab);
        } else {
          hideCurrentSiteControls();
          loadStorage();
        }
      });
    } else {
      processTab(targetTab);
    }
  });

  function processTab(tab) {
    if (tab && tab.url) {
      try {
        const url = new URL(tab.url);
        // Simple validation to only handle http/https URLs
        if (url.protocol.startsWith("http")) {
          currentHost = url.hostname.toLowerCase();
          textCurrentDomain.textContent = currentHost;
          labelCurrentHost.textContent = currentHost;
        } else {
          hideCurrentSiteControls();
        }
      } catch (e) {
        hideCurrentSiteControls();
      }
    } else {
      hideCurrentSiteControls();
    }
    loadStorage();
  }

  function loadStorage() {
    // Load configurations from storage
    chrome.storage.local.get(null, (storedSettings) => {
      settings = { ...settings, ...storedSettings };
      initUI();
    });
  }

  function hideCurrentSiteControls() {
    currentHost = "";
    if (cardCurrentSite) cardCurrentSite.style.display = "none";
    if (labelCurrentHost) labelCurrentHost.textContent = "unknown website";
    if (inputNewSelector) inputNewSelector.disabled = true;
    if (btnAddSelector) btnAddSelector.disabled = true;
  }

  // Initialize UI components with stored values
  function initUI() {
    // 1. Core protection switches
    btnToggleEnable.checked = settings.enabled;
    inputBlurIntensity.value = settings.blurIntensity;
    blurVal.textContent = `${settings.blurIntensity}px`;
    btnToggleHover.checked = settings.revealOnHover;

    updateHeaderStatus(settings.enabled);

    // 2. Domain specific enable toggle
    if (currentHost) {
      const isExcluded = settings.excludedSites.includes(currentHost);
      btnToggleDomain.checked = !isExcluded;
    }

    // 3. Render list of selectors for current host
    renderSelectorsList();

    // 4. Render Currencies grids
    renderCurrencyChips();

    // 5. Custom Regex Setup
    const hasCustomRegex = !!(settings.customRegex && settings.customRegex.trim() !== "");
    btnEnableRegex.checked = hasCustomRegex;
    textareaRegex.value = settings.customRegex || "";
    textareaRegex.disabled = !hasCustomRegex;
    updateRegexStatusText(textareaRegex.value, hasCustomRegex);

    // 6. Render whitelist exclusions
    renderExclusionsList();

    // Wire up event listeners
    setupListeners();
  }

  // Header status UI toggle
  function updateHeaderStatus(enabled) {
    const header = document.querySelector(".app-header");
    if (enabled) {
      header.classList.remove("suspended");
      statusLabel.textContent = "Active";
      powerDesc.textContent = "Shield is blurring sensitive values.";
    } else {
      header.classList.add("suspended");
      statusLabel.textContent = "Suspended";
      powerDesc.textContent = "Shield is inactive. Values are visible.";
    }
  }

  // Setup tab switcher navigation
  const navItems = document.querySelectorAll(".nav-item");
  const tabContents = document.querySelectorAll(".tab-content");

  navItems.forEach(item => {
    item.addEventListener("click", () => {
      const targetTab = item.getAttribute("data-target");

      navItems.forEach(btn => btn.classList.remove("active"));
      tabContents.forEach(tab => tab.classList.remove("active"));

      item.classList.add("active");
      document.getElementById(targetTab).classList.add("active");
    });
  });

  // Render currency chips grid
  function renderCurrencyChips() {
    currencyChipsGrid.innerHTML = "";
    
    // Disable chips if regex is active
    const regexActive = btnEnableRegex.checked;

    DEFAULT_CURRENCIES.forEach(symbol => {
      const chip = document.createElement("div");
      chip.className = `chip ${settings.currencies.includes(symbol) ? "active" : ""}`;
      if (regexActive) chip.classList.add("disabled-chip");
      chip.textContent = symbol;

      if (!regexActive) {
        chip.addEventListener("click", () => {
          let updatedList = [...settings.currencies];
          if (updatedList.includes(symbol)) {
            updatedList = updatedList.filter(s => s !== symbol);
            chip.classList.remove("active");
          } else {
            updatedList.push(symbol);
            chip.classList.add("active");
          }
          settings.currencies = updatedList;
          chrome.storage.local.set({ currencies: updatedList });
        });
      }

      currencyChipsGrid.appendChild(chip);
    });
  }

  // Render custom CSS selectors list for current host
  function renderSelectorsList() {
    selectorsList.innerHTML = "";
    if (!currentHost) {
      selectorsList.innerHTML = `<div class="empty-state">Unable to detect host. Selectors disabled.</div>`;
      return;
    }

    const hostSelectors = settings.customSelectors[currentHost] || [];

    if (hostSelectors.length === 0) {
      selectorsList.innerHTML = `<div class="empty-state">No custom selectors added for this site yet.</div>`;
      return;
    }

    hostSelectors.forEach((selector, idx) => {
      const item = document.createElement("div");
      item.className = "list-item";

      const text = document.createElement("span");
      text.className = "item-text";
      text.textContent = selector;
      text.title = selector;

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "btn-delete";
      deleteBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      `;

      deleteBtn.addEventListener("click", () => {
        const updatedList = [...hostSelectors];
        updatedList.splice(idx, 1);
        
        if (updatedList.length > 0) {
          settings.customSelectors[currentHost] = updatedList;
        } else {
          delete settings.customSelectors[currentHost];
        }

        chrome.storage.local.set({ customSelectors: settings.customSelectors }, () => {
          renderSelectorsList();
        });
      });

      item.appendChild(text);
      item.appendChild(deleteBtn);
      selectorsList.appendChild(item);
    });
  }

  // Render whitelist exceptions list
  function renderExclusionsList() {
    exclusionsList.innerHTML = "";

    if (settings.excludedSites.length === 0) {
      exclusionsList.innerHTML = `<div class="empty-state">No websites are whitelisted. Protection is active everywhere.</div>`;
      return;
    }

    settings.excludedSites.forEach((site, idx) => {
      const item = document.createElement("div");
      item.className = "list-item";

      const text = document.createElement("span");
      text.className = "item-domain";
      text.textContent = site;

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "btn-delete";
      deleteBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      `;

      deleteBtn.addEventListener("click", () => {
        const updatedList = [...settings.excludedSites];
        updatedList.splice(idx, 1);
        settings.excludedSites = updatedList;

        chrome.storage.local.set({ excludedSites: updatedList }, () => {
          renderExclusionsList();
          // Update domain checkbox if it was this page
          if (currentHost === site) {
            btnToggleDomain.checked = true;
          }
        });
      });

      item.appendChild(text);
      item.appendChild(deleteBtn);
      exclusionsList.appendChild(item);
    });
  }

  // Regex validation status visual feedback
  function updateRegexStatusText(pattern, enabled) {
    if (!enabled) {
      regexValidationStatus.textContent = "Regex disabled";
      regexValidationStatus.className = "regex-status";
      return;
    }
    if (pattern.trim() === "") {
      regexValidationStatus.textContent = "Waiting for regex input...";
      regexValidationStatus.className = "regex-status";
      return;
    }
    try {
      new RegExp(pattern, "g");
      regexValidationStatus.textContent = "Regex syntax valid";
      regexValidationStatus.className = "regex-status valid";
    } catch (e) {
      regexValidationStatus.textContent = "Invalid regular expression syntax";
      regexValidationStatus.className = "regex-status invalid";
    }
  }

  // Wire up event controls
  function setupListeners() {
    // Enable/Disable toggle
    btnToggleEnable.addEventListener("change", (e) => {
      const val = e.target.checked;
      chrome.storage.local.set({ enabled: val });
      updateHeaderStatus(val);
    });

    // Blur intensity slider
    inputBlurIntensity.addEventListener("input", (e) => {
      const val = parseInt(e.target.value);
      blurVal.textContent = `${val}px`;
      chrome.storage.local.set({ blurIntensity: val });
    });

    // Hover reveal toggle
    btnToggleHover.addEventListener("change", (e) => {
      const val = e.target.checked;
      chrome.storage.local.set({ revealOnHover: val });
    });

    // Toggle current website protection
    if (currentHost) {
      btnToggleDomain.addEventListener("change", (e) => {
        const enableProtection = e.target.checked;
        let list = [...settings.excludedSites];
        
        if (enableProtection) {
          list = list.filter(site => site !== currentHost);
        } else {
          if (!list.includes(currentHost)) {
            list.push(currentHost);
          }
        }
        
        settings.excludedSites = list;
        chrome.storage.local.set({ excludedSites: list }, () => {
          renderExclusionsList();
        });
      });
    }

    // Add Custom CSS Selector
    if (currentHost) {
      const addSelectorHandler = () => {
        const val = inputNewSelector.value.trim();
        if (!val) return;

        const hostSelectors = settings.customSelectors[currentHost] || [];
        if (!hostSelectors.includes(val)) {
          hostSelectors.push(val);
          settings.customSelectors[currentHost] = hostSelectors;
          
          chrome.storage.local.set({ customSelectors: settings.customSelectors }, () => {
            inputNewSelector.value = "";
            renderSelectorsList();
          });
        }
      };

      btnAddSelector.addEventListener("click", addSelectorHandler);
      inputNewSelector.addEventListener("keypress", (e) => {
        if (e.key === "Enter") addSelectorHandler();
      });
    }

    // Custom Regex Toggle checkbox
    btnEnableRegex.addEventListener("change", (e) => {
      const regexActive = e.target.checked;
      textareaRegex.disabled = !regexActive;
      
      let newRegexValue = "";
      if (regexActive) {
        newRegexValue = textareaRegex.value.trim();
      }

      chrome.storage.local.set({ customRegex: newRegexValue }, () => {
        settings.customRegex = newRegexValue;
        updateRegexStatusText(newRegexValue, regexActive);
        renderCurrencyChips(); // Rerender to show disabled state of chips
      });
    });

    // Regex text area input change
    textareaRegex.addEventListener("input", (e) => {
      const pattern = e.target.value.trim();
      updateRegexStatusText(pattern, btnEnableRegex.checked);

      // Verify syntax before saving
      try {
        if (pattern !== "") {
          new RegExp(pattern, "g");
        }
        chrome.storage.local.set({ customRegex: pattern });
        settings.customRegex = pattern;
      } catch (err) {
        // Don't save invalid syntax to storage to avoid breaking content.js
      }
    });

    // Add Whitelist Exclusion domain
    const addExclusionHandler = () => {
      const val = inputNewExclusion.value.trim().toLowerCase();
      if (!val) return;

      // Basic domain validation
      const cleanedDomain = val.replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0];
      if (cleanedDomain === "") return;

      let list = [...settings.excludedSites];
      if (!list.includes(cleanedDomain)) {
        list.push(cleanedDomain);
        settings.excludedSites = list;
        
        chrome.storage.local.set({ excludedSites: list }, () => {
          inputNewExclusion.value = "";
          renderExclusionsList();
          
          // If whitelisted site is the current page, uncheck enabled checkbox
          if (cleanedDomain === currentHost) {
            btnToggleDomain.checked = false;
          }
        });
      }
    };

    btnAddExclusion.addEventListener("click", addExclusionHandler);
    inputNewExclusion.addEventListener("keypress", (e) => {
      if (e.key === "Enter") addExclusionHandler();
    });

    // Start Visual Element Inspector
    if (btnInspectElement) {
      btnInspectElement.addEventListener("click", () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          let targetTab = tabs[0];
          
          // Fallback if active tab is popup page
          if (targetTab && targetTab.url && targetTab.url.startsWith("chrome-extension:")) {
            chrome.tabs.query({}, (allTabs) => {
              const httpTab = allTabs.find(t => t.url && (t.url.startsWith("http:") || t.url.startsWith("https:")));
              if (httpTab) {
                triggerInspectMode(httpTab.id);
              }
            });
          } else if (targetTab && targetTab.url && targetTab.url.startsWith("http")) {
            triggerInspectMode(targetTab.id);
          }
        });
      });
    }

    function triggerInspectMode(tabId) {
      chrome.tabs.sendMessage(tabId, { action: "start-inspect-mode" }, () => {
        window.close(); // Close popup once message is sent
      });
    }
  };
});
