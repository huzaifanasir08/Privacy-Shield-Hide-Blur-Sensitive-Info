// Privacy Shield Content Script

(function () {
  let settings = {
    enabled: true,
    blurIntensity: 8,
    revealOnHover: true,
    currencies: ["$", "€", "£", "Rs", "PKR", "₹", "¥"],
    customRegex: "",
    customSelectors: {},
    excludedSites: [],
    tabCloakingEnabled: false
  };

  let amountRegex = null;
  let styleElement = null;
  let dynamicStyleElement = null;
  const processedNodes = new WeakSet();
  let scanQueue = [];
  let isProcessingQueue = false;

  // Inspector mode variables
  let isInspecting = false;
  let inspectorOverlay = null;
  let inspectorTooltip = null;
  let currentHoveredElement = null;

  // Tab cloaking variables
  let originalTitle = "";
  let originalFavicons = [];
  let cloakingObserver = null;

  // Initialize
  function init() {
    chrome.storage.local.get(null, (storedSettings) => {
      // Merge stored settings with defaults
      settings = { ...settings, ...storedSettings };

      const currentDomain = window.location.hostname.toLowerCase();
      
      // Check whitelist / excluded sites
      const isExcluded = settings.excludedSites.some(site => {
        const cleaned = site.trim().toLowerCase();
        return currentDomain === cleaned || currentDomain.endsWith('.' + cleaned);
      });

      if (isExcluded) {
        settings.enabled = false;
      }

      applyGlobalStyles();
      compileRegex();
      injectCustomSelectorsCSS(currentDomain);
      applyTabCloaking();

      if (settings.enabled) {
        startObserver();
        // Initial scan for already loaded elements
        queueNodeForScan(document.documentElement);
      }
    });

    // Listen for storage changes
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local') {
        let needsReapply = false;
        let needsRegexRecompile = false;
        let needsSelectorsUpdate = false;

        for (let key in changes) {
          settings[key] = changes[key].newValue;
          if (key === 'enabled' || key === 'blurIntensity' || key === 'revealOnHover') {
            needsReapply = true;
          }
          if (key === 'currencies' || key === 'customRegex') {
            needsRegexRecompile = true;
          }
          if (key === 'customSelectors' || key === 'excludedSites') {
            needsSelectorsUpdate = true;
            needsReapply = true;
          }
          if (key === 'tabCloakingEnabled') {
            needsReapply = true;
          }
        }

        const currentDomain = window.location.hostname.toLowerCase();
        const isExcluded = settings.excludedSites.some(site => {
          const cleaned = site.trim().toLowerCase();
          return currentDomain === cleaned || currentDomain.endsWith('.' + cleaned);
        });

        if (isExcluded) {
          settings.enabled = false;
        }

        if (needsReapply) {
          applyGlobalStyles();
          applyTabCloaking();
        }
        if (needsRegexRecompile) {
          compileRegex();
          // Clear cache and rescan
          processedNodes.delete(document.documentElement);
          queueNodeForScan(document.documentElement);
        }
        if (needsSelectorsUpdate) {
          injectCustomSelectorsCSS(currentDomain);
        }

        if (settings.enabled) {
          startObserver();
        } else {
          stopObserver();
        }
      }
    });

    // Listen for background page commands and inspect mode triggers
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === "toggle-blur") {
        const updatedEnabled = !settings.enabled;
        chrome.storage.local.set({ enabled: updatedEnabled });
      } else if (message.action === "start-inspect-mode") {
        startInspectMode();
        if (sendResponse) sendResponse({ success: true });
      }
    });
  }

  // Apply root variables and toggles to <html> element
  function applyGlobalStyles() {
    const html = document.documentElement;
    if (!html) return;

    // Set CSS custom properties
    html.style.setProperty('--privacy-shield-blur-level', `${settings.blurIntensity}px`);

    // Toggle active state classes
    if (settings.enabled) {
      html.classList.remove('privacy-shield-disabled');
    } else {
      html.classList.add('privacy-shield-disabled');
    }

    if (settings.revealOnHover) {
      html.classList.add('privacy-shield-hover-reveal');
    } else {
      html.classList.remove('privacy-shield-hover-reveal');
    }
  }

  // Apply Tab Cloaking (Stealth Mode)
  function applyTabCloaking() {
    if (!settings.enabled || !settings.tabCloakingEnabled) {
      restoreTabCloaking();
      return;
    }

    // Capture original title if not already set or it's been changed externally
    if (document.title !== "Hidden tab") {
      originalTitle = document.title || "Dashboard";
    }

    // Force Cloaked title
    document.title = "Hidden tab";

    // Shield SVG Favicon
    const shieldFavicon = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2314b8a6"><path d="M12 2s8 3 8 8c0 4.52-2.82 8.79-8 10-5.18-1.21-8-5.48-8-10 0-5 8-8 8-8z" stroke="%23ffffff" stroke-width="2"/></svg>`;

    // Save and replace favicons
    const links = document.querySelectorAll("link[rel*='icon']");
    if (originalFavicons.length === 0 && links.length > 0) {
      links.forEach(link => {
        originalFavicons.push({
          element: link,
          href: link.getAttribute("href"),
          rel: link.getAttribute("rel")
        });
      });
    }

    if (links.length > 0) {
      links.forEach(link => {
        link.setAttribute("href", shieldFavicon);
      });
    } else {
      // Create a favicon element if none exist
      const link = document.createElement("link");
      link.rel = "icon";
      link.type = "image/svg+xml";
      link.href = shieldFavicon;
      document.head.appendChild(link);
    }

    startCloakingObserver(shieldFavicon);
  }

  // Observer to maintain title and favicon even when dynamic frameworks like Next.js try to revert them
  function startCloakingObserver(shieldFavicon) {
    if (cloakingObserver) return;

    cloakingObserver = new MutationObserver((mutations) => {
      // Temporarily disconnect observer to avoid infinite trigger loop
      cloakingObserver.disconnect();

      if (document.title !== "Hidden tab") {
        if (document.title !== "") {
          originalTitle = document.title;
        }
        document.title = "Hidden tab";
      }

      // Maintain shield favicon
      const links = document.querySelectorAll("link[rel*='icon']");
      links.forEach(link => {
        if (link.getAttribute("href") !== shieldFavicon) {
          link.setAttribute("href", shieldFavicon);
        }
      });

      // Reconnect observer
      cloakingObserver.observe(document.head || document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["href", "rel"]
      });

      const titleEl = document.querySelector("title");
      if (titleEl) {
        cloakingObserver.observe(titleEl, {
          characterData: true,
          childList: true
        });
      }
    });

    cloakingObserver.observe(document.head || document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["href", "rel"]
    });

    const titleEl = document.querySelector("title");
    if (titleEl) {
      cloakingObserver.observe(titleEl, {
        characterData: true,
        childList: true
      });
    }
  }

  // Restore normal title and favicon
  function restoreTabCloaking() {
    if (cloakingObserver) {
      cloakingObserver.disconnect();
      cloakingObserver = null;
    }

    if (originalTitle && document.title === "Hidden tab") {
      document.title = originalTitle;
    }

    const links = document.querySelectorAll("link[rel*='icon']");
    if (originalFavicons.length > 0) {
      // Remove newly created favicons
      links.forEach(link => {
        const isOrig = originalFavicons.some(orig => orig.element === link);
        if (!isOrig) {
          link.remove();
        }
      });

      // Restore original hrefs
      originalFavicons.forEach(orig => {
        if (orig.element && orig.element.parentNode) {
          orig.element.setAttribute("href", orig.href);
        }
      });
      originalFavicons = [];
    } else {
      // If we didn't save any original favicons, just remove the SVG one we injected
      links.forEach(link => {
        const href = link.getAttribute("href") || "";
        if (href.startsWith("data:image/svg+xml")) {
          link.remove();
        }
      });
    }
  }

  // Compile regular expression based on currencies list and custom pattern
  function compileRegex() {
    if (settings.customRegex && settings.customRegex.trim() !== '') {
      try {
        amountRegex = new RegExp(settings.customRegex, 'gi');
        return;
      } catch (e) {
        console.error("Privacy Shield: Invalid custom regex provided. Falling back to currencies list.", e);
      }
    }

    if (!settings.currencies || settings.currencies.length === 0) {
      // If no currency list or regex, match nothing (or empty matching group)
      amountRegex = null;
      return;
    }

    // Escape special regex chars from active currencies
    const escapedCurrencies = settings.currencies
      .map(c => c.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'))
      .join('|');

    // Pattern for Prefix Currency: e.g. $ 120, PKR1,200.50, Rs. 50,000
    // Pattern for Suffix Currency: e.g. 100 USD, 50,000 PKR
    // Also captures negative symbols if present
    const pattern = `(?:(?:-|\\+)?(?:${escapedCurrencies})\\s?\\d{1,3}(?:[.,]\\d{3})*(?:\\.\\d+)?)|(?:(?:-|\\+)?\\d{1,3}(?:[.,]\\d{3})*(?:\\.\\d+)?\\s?(?:${escapedCurrencies}))`;
    amountRegex = new RegExp(pattern, 'gi');
  }

  // Inject CSS rules for custom selectors to hide immediately before paint
  function injectCustomSelectorsCSS(currentDomain) {
    if (!dynamicStyleElement) {
      dynamicStyleElement = document.createElement('style');
      dynamicStyleElement.id = 'privacy-shield-dynamic-selectors';
      // Append to html to run at document_start
      document.documentElement.appendChild(dynamicStyleElement);
    }

    if (!settings.enabled) {
      dynamicStyleElement.textContent = '';
      return;
    }

    // Find custom selectors matching current domain or subdomains
    const matchingSelectors = [];
    for (let host in settings.customSelectors) {
      if (currentDomain === host || currentDomain.endsWith('.' + host)) {
        const selectors = settings.customSelectors[host];
        if (Array.isArray(selectors)) {
          selectors.forEach(item => {
            const isObj = item && typeof item === 'object';
            const selectorStr = isObj ? item.selector : item;
            const isEnabled = isObj ? (item.enabled !== false) : true;
            if (selectorStr && isEnabled) {
              matchingSelectors.push(selectorStr);
            }
          });
        }
      }
    }

    if (matchingSelectors.length === 0) {
      dynamicStyleElement.textContent = '';
      return;
    }

    // Generate style rules as individual blocks to prevent syntax errors in one selector from disabling others
    let cssRules = '';
    matchingSelectors.forEach(s => {
      cssRules += `
        ${s} {
          filter: blur(var(--privacy-shield-blur-level, 8px)) !important;
          user-select: none !important;
          transition: filter var(--privacy-shield-reveal-transition) !important;
        }
        html.privacy-shield-hover-reveal ${s}:hover {
          filter: blur(0px) !important;
        }
        html.privacy-shield-disabled ${s} {
          filter: none !important;
          user-select: auto !important;
        }
      `;
    });

    dynamicStyleElement.textContent = cssRules;
  }

  // Check text nodes under a parent element and wrap matches
  function scanTextNodes(node) {
    if (!node || !settings.enabled || !amountRegex) return;

    // Skip scripts, styles, etc.
    const tagName = node.tagName ? node.tagName.toLowerCase() : '';
    if (tagName === 'script' || tagName === 'style' || tagName === 'textarea' || 
        tagName === 'input' || tagName === 'noscript' || tagName === 'code' || 
        tagName === 'svg' || tagName === 'canvas' || node.isContentEditable) {
      return;
    }

    // TreeWalker to scan text nodes
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
      acceptNode: function(textNode) {
        const parent = textNode.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        
        // Skip tags
        const pTagName = parent.tagName.toLowerCase();
        if (pTagName === 'script' || pTagName === 'style' || pTagName === 'textarea' || 
            pTagName === 'input' || pTagName === 'noscript' || pTagName === 'code' || 
            pTagName === 'svg' || pTagName === 'canvas' || parent.isContentEditable ||
            parent.closest('[contenteditable]') ||
            parent.classList.contains('privacy-shield-blur') ||
            parent.closest('.privacy-shield-blur')) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    const nodesToReplace = [];
    let currentTextNode;

    while (currentTextNode = walker.nextNode()) {
      const text = currentTextNode.nodeValue;
      if (!text || text.trim() === '') continue;

      amountRegex.lastIndex = 0;
      if (amountRegex.test(text)) {
        nodesToReplace.push(currentTextNode);
      }
    }

    // Perform replacements after gathering to prevent walker concurrent edits
    nodesToReplace.forEach(textNode => {
      const text = textNode.nodeValue;
      amountRegex.lastIndex = 0;
      
      const fragment = document.createDocumentFragment();
      let lastIndex = 0;
      let match;

      while ((match = amountRegex.exec(text)) !== null) {
        const matchText = match[0];
        const matchIndex = match.index;

        if (matchIndex > lastIndex) {
          fragment.appendChild(document.createTextNode(text.substring(lastIndex, matchIndex)));
        }

        const span = document.createElement('span');
        span.className = 'privacy-shield-blur';
        span.textContent = matchText;
        fragment.appendChild(span);

        lastIndex = amountRegex.lastIndex;
      }

      if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
      }

      if (textNode.parentNode) {
        try {
          textNode.parentNode.replaceChild(fragment, textNode);
        } catch (e) {
          // Suppress errors due to concurrent node structural changes
        }
      }
    });
  }

  // Queue a node to be processed in a debounced chunk
  function queueNodeForScan(node) {
    if (!node || processedNodes.has(node)) return;
    
    // Only queue element or document nodes
    if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_NODE && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) {
      return;
    }

    scanQueue.push(node);
    processedNodes.add(node);

    if (!isProcessingQueue) {
      isProcessingQueue = true;
      // Use requestIdleCallback or setTimeout to process asynchronously
      const scheduler = window.requestIdleCallback || ((cb) => setTimeout(cb, 50));
      scheduler(processQueue);
    }
  }

  // Process the queue of scanned nodes
  function processQueue(deadline) {
    const startTime = performance.now();
    
    while (scanQueue.length > 0) {
      // Check if we are running out of idle time (if using requestIdleCallback)
      if (deadline && deadline.timeRemaining() < 2) {
        break;
      }
      
      // Safety threshold to prevent frame drops
      if (performance.now() - startTime > 16) {
        break;
      }

      const node = scanQueue.shift();
      if (node) {
        scanTextNodes(node);
      }
    }

    if (scanQueue.length > 0) {
      const scheduler = window.requestIdleCallback || ((cb) => setTimeout(cb, 50));
      scheduler(processQueue);
    } else {
      isProcessingQueue = false;
    }
  }

  // Mutation Observer
  let observer = null;

  function startObserver() {
    if (observer) return;

    observer = new MutationObserver((mutations) => {
      for (let i = 0; i < mutations.length; i++) {
        const mutation = mutations[i];
        
        // Handle added nodes
        if (mutation.type === 'childList') {
          for (let j = 0; j < mutation.addedNodes.length; j++) {
            const addedNode = mutation.addedNodes[j];
            queueNodeForScan(addedNode);
          }
        } 
        // Handle text character data changes (e.g. dynamic prices updating in-place)
        else if (mutation.type === 'characterData') {
          const parent = mutation.target.parentNode;
          if (parent && !parent.classList.contains('privacy-shield-blur') && !parent.closest('.privacy-shield-blur')) {
            // Re-scan parent node if text contents changes dynamically
            processedNodes.delete(parent);
            queueNodeForScan(parent);
          }
        }
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  function stopObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  // --- VISUAL ELEMENT INSPECTOR MODE ---
  
  function startInspectMode() {
    if (isInspecting) return;
    isInspecting = true;
    
    // Create highlight elements
    if (!inspectorOverlay) {
      inspectorOverlay = document.createElement('div');
      inspectorOverlay.id = 'privacy-shield-inspect-overlay';
      document.body.appendChild(inspectorOverlay);
    }
    
    if (!inspectorTooltip) {
      inspectorTooltip = document.createElement('div');
      inspectorTooltip.id = 'privacy-shield-inspect-tooltip';
      document.body.appendChild(inspectorTooltip);
    }
    
    inspectorOverlay.style.display = 'block';
    inspectorTooltip.style.display = 'block';
    
    // Add event listeners
    document.addEventListener('mousemove', handleInspectMouseMove, true);
    document.addEventListener('mouseover', handleInspectMouseOver, true);
    document.addEventListener('click', handleInspectClick, true);
    document.addEventListener('keydown', handleInspectKeyDown, true);
    
    // Set crosshair cursor styling on root
    document.documentElement.style.cursor = 'crosshair';
  }

  function stopInspectMode() {
    if (!isInspecting) return;
    isInspecting = false;
    
    if (inspectorOverlay) {
      inspectorOverlay.style.display = 'none';
    }
    if (inspectorTooltip) {
      inspectorTooltip.style.display = 'none';
    }
    
    // Remove event listeners
    document.removeEventListener('mousemove', handleInspectMouseMove, true);
    document.removeEventListener('mouseover', handleInspectMouseOver, true);
    document.removeEventListener('click', handleInspectClick, true);
    document.removeEventListener('keydown', handleInspectKeyDown, true);
    
    // Restore normal cursor
    document.documentElement.style.cursor = '';
    currentHoveredElement = null;
  }

  function handleInspectMouseOver(e) {
    if (!isInspecting) return;
    
    // Skip highlighting our overlay, tooltip, or body root nodes
    if (e.target === inspectorOverlay || e.target === inspectorTooltip || 
        e.target === document.body || e.target === document.documentElement) {
      return;
    }
    
    currentHoveredElement = e.target;
    updateInspectorOverlayPosition();
  }

  function handleInspectMouseMove(e) {
    if (!isInspecting || !currentHoveredElement) return;
    
    // Position tooltip slightly offset from cursor
    if (inspectorTooltip) {
      const x = e.pageX;
      const y = e.pageY;
      
      inspectorTooltip.style.left = `${x + 10}px`;
      inspectorTooltip.style.top = `${y}px`;
    }
  }

  function updateInspectorOverlayPosition() {
    if (!currentHoveredElement || !inspectorOverlay) return;
    
    const rect = currentHoveredElement.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    
    inspectorOverlay.style.top = `${rect.top + scrollTop}px`;
    inspectorOverlay.style.left = `${rect.left + scrollLeft}px`;
    inspectorOverlay.style.width = `${rect.width}px`;
    inspectorOverlay.style.height = `${rect.height}px`;
    
    // Display the selector real-time in the tooltip
    const selector = calculateUniqueSelector(currentHoveredElement);
    if (inspectorTooltip) {
      inspectorTooltip.textContent = selector;
    }
  }

  function handleInspectClick(e) {
    if (!isInspecting) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    if (currentHoveredElement) {
      const selector = calculateUniqueSelector(currentHoveredElement);
      if (selector) {
        saveCustomSelector(selector);
      }
    }
    
    stopInspectMode();
  }

  function handleInspectKeyDown(e) {
    if (!isInspecting) return;
    
    // Escape key terminates inspect mode immediately
    if (e.key === 'Escape') {
      stopInspectMode();
    }
  }

  // Generate unique clean CSS Selector path for selected element
  function calculateUniqueSelector(el) {
    if (!el || el === document.body || el === document.documentElement) return '';

    // 1. Highest Priority: exact stable data-testid
    if (el.getAttribute('data-testid')) {
      const val = el.getAttribute('data-testid');
      if (/^[a-zA-Z0-9_-]+$/.test(val)) {
        return `[data-testid=${val}]`;
      }
      return `[data-testid="${val}"]`;
    }

    // 2. Partial dynamic testid / id check (handles dynamic record IDs with UUID suffixes)
    for (let i = 0; i < el.attributes.length; i++) {
      const attr = el.attributes[i];
      if (attr.name === 'data-testid' || attr.name === 'id') {
        const val = attr.value;
        const uuidPattern = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i;
        if (uuidPattern.test(val)) {
          const prefix = val.split(uuidPattern)[0];
          if (prefix) {
            if (/^[a-zA-Z0-9_-]+$/.test(prefix)) {
              return `[${attr.name}^=${prefix}]`;
            }
            return `[${attr.name}^="${prefix}"]`;
          }
        }
      }
    }

    // 3. Stable non-dynamic ID check
    if (el.id && !/^[0-9]/.test(el.id) && el.id.length < 32 && !/[_-][0-9a-f]{8,}/i.test(el.id)) {
      return `#${el.id}`;
    }

    // 4. Crawl up DOM tree to build unique path selector
    let path = [];
    let current = el;

    while (current && current.nodeType === Node.ELEMENT_NODE) {
      if (current.tagName.toLowerCase() === 'html' || current.tagName.toLowerCase() === 'body') {
        break;
      }

      // Check if parent has stable attribute to stop traversal early and keep selectors short
      if (current.getAttribute('data-testid')) {
        path.unshift(`[data-testid="${current.getAttribute('data-testid')}"]`);
        break;
      }
      if (current.id && !/^[0-9]/.test(current.id) && current.id.length < 32 && !/[_-][0-9a-f]{8,}/i.test(current.id)) {
        path.unshift(`#${current.id}`);
        break;
      }

      let part = current.tagName.toLowerCase();
      
      // Filter out styling layout class utilities, retain semantic component class if exists
      const classes = Array.from(current.classList).filter(c => {
        const isUtility = /^(flex|grid|items-|justify-|p-|m-|text-|font-|border|bg-|rounded|gap-|w-|h-|sm:|md:|lg:|xl:|focus:|hover:|active:|transition|shadow|duration|ease-)/.test(c);
        return !isUtility && !/^[0-9]/.test(c) && c.length < 24;
      });

      if (classes.length > 0) {
        part += '.' + CSS.escape(classes[0]);
      }

      // Compute index among sibling tags
      let siblingIndex = 1;
      let sibling = current.previousElementSibling;
      while (sibling) {
        if (sibling.tagName === current.tagName) {
          siblingIndex++;
        }
        sibling = sibling.previousElementSibling;
      }

      let hasSiblings = false;
      let nextSibling = current.nextElementSibling;
      while (nextSibling) {
        if (nextSibling.tagName === current.tagName) {
          hasSiblings = true;
          break;
        }
        nextSibling = nextSibling.nextElementSibling;
      }

      if (siblingIndex > 1 || hasSiblings) {
        part += `:nth-of-type(${siblingIndex})`;
      }

      path.unshift(part);

      // Check if the selector generated so far uniquely identifies the element
      const selector = path.join(' > ');
      try {
        if (document.querySelectorAll(selector).length === 1) {
          break;
        }
      } catch (e) {
        // Suppress errors due to temporary selector formatting
      }

      current = current.parentElement;
    }

    return path.join(' > ');
  }

  // Save selected selector and display alert toast
  function saveCustomSelector(selector) {
    const currentDomain = window.location.hostname.toLowerCase();
    
    const hostSelectors = settings.customSelectors[currentDomain] || [];
    const exists = hostSelectors.some(item => {
      const itemSelector = (item && typeof item === 'object') ? item.selector : item;
      return itemSelector === selector;
    });

    if (!exists) {
      const defaultLabel = `Selector ${hostSelectors.length + 1}`;
      const label = prompt("Enter a short reference name for this selector:", defaultLabel) || defaultLabel;

      hostSelectors.push({
        selector: selector,
        label: label.trim(),
        enabled: true
      });
      settings.customSelectors[currentDomain] = hostSelectors;
      
      chrome.storage.local.set({ customSelectors: settings.customSelectors }, () => {
        showToast(`Element blurred! Added selector: ${label.trim()}`);
      });
    } else {
      showToast(`Element is already blurred.`);
    }
  }

  // Toast confirmation notification rendering
  function showToast(message) {
    let toast = document.querySelector('.privacy-shield-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'privacy-shield-toast';
      
      const iconSpan = document.createElement('span');
      iconSpan.className = 'privacy-shield-toast-icon';
      iconSpan.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
      `;
      toast.appendChild(iconSpan);
      
      const textNode = document.createElement('span');
      textNode.className = 'privacy-shield-toast-text';
      toast.appendChild(textNode);
      
      document.body.appendChild(toast);
    }
    
    toast.querySelector('.privacy-shield-toast-text').textContent = message;
    
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);
    
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3500);
  }

  // Bootstrap when document.documentElement is available
  if (document.documentElement) {
    init();
  } else {
    const bootstrapObserver = new MutationObserver(() => {
      if (document.documentElement) {
        init();
        bootstrapObserver.disconnect();
      }
    });
    bootstrapObserver.observe(document, { childList: true, subtree: true });
  }
})();
