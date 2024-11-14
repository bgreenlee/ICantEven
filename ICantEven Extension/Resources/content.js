// Store filter keywords in a Set for efficient lookup
let filterKeywords = new Set();

// Function to check if a URL contains any filtered keywords
function urlContainsFilteredWord(url) {
    const decodedUrl = decodeURIComponent(url.toLowerCase());
    for (let keyword of filterKeywords) {
        if (decodedUrl.includes(keyword.toLowerCase())) {
//            console.log("Found '" + keyword + "' in url: " + decodedUrl);
            return true;
        }
    }
    return false;
}

// Function to check if text contains any of the filter keywords
function containsFilteredWord(text) {
    const lowerText = text.toLowerCase();
    for (let keyword of filterKeywords) {
        if (lowerText.includes(keyword.toLowerCase())) {
            return true;
        }
    }
    return false;
}

// Function to hide elements that match URL criteria
function hideElementsWithMatchingUrls(rootNode = document.body) {
    let hiddenCount = 0;

    // Find and process all links
    const links = rootNode.getElementsByTagName('a');
    for (let link of links) {
        if (link.href && urlContainsFilteredWord(link.href)) {
            if (link.style.visibility !== 'hidden') {
                link.setAttribute('data-original-visibility', link.style.visibility);
                link.style.visibility = 'hidden';
                hiddenCount++;
            }
        }
    }

    // Find and process all images
    const images = rootNode.getElementsByTagName('img');
    for (let img of images) {
        if ((img.src && urlContainsFilteredWord(img.src)) ||
            (img.alt && containsFilteredWord(img.alt))) {
            if (img.style.visibility !== 'hidden') {
                img.setAttribute('data-original-visibility', img.style.visibility);
                img.style.visibility = 'hidden';
                hiddenCount++;
            }
        }
    }

    return hiddenCount;
}

// Function to find and hide elements that directly contain any filtered text
function hideElementsWithText(rootNode = document.body) {
    let hiddenCount = 0;

    // First check for URLs in the subtree
    hiddenCount += hideElementsWithMatchingUrls(rootNode);

    // Walk through all text nodes in the document or subtree
    const walker = document.createTreeWalker(
        rootNode,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function(node) {
                // Skip if parent is script, style, or already hidden
                const parent = node.parentElement;
                if (!parent ||
                    parent.tagName === 'SCRIPT' ||
                    parent.tagName === 'STYLE' ||
                    parent.style.visibility === 'hidden') {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        },
        false
    );

    const nodesToHide = new Set();
    let node;

    while (node = walker.nextNode()) {
        // Check if this text node contains any filtered text
        if (containsFilteredWord(node.textContent)) {
            // Find the nearest block-level or positioned parent
            let targetElement = node.parentElement;
            while (targetElement &&
                   window.getComputedStyle(targetElement).display === 'inline' &&
                   window.getComputedStyle(targetElement).position === 'static') {
                targetElement = targetElement.parentElement;
            }

            if (targetElement && targetElement.style.visibility !== 'hidden') {
                nodesToHide.add(targetElement);
            }
        }
    }

    // Hide the identified elements
    nodesToHide.forEach(element => {
        element.setAttribute('data-original-visibility', element.style.visibility);
        element.style.visibility = 'hidden';
        hiddenCount++;
    });

    return hiddenCount;
}

// Function to restore hidden elements
function restoreHiddenElements() {
    const elements = document.querySelectorAll('[data-original-visibility]');
    elements.forEach(element => {
        element.style.visibility = element.getAttribute('data-original-visibility') || 'visible';
        element.removeAttribute('data-original-visibility');
    });
    return elements.length;
}

// Initialize MutationObserver to watch for DOM changes
function initializeObserver() {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
            // Handle added nodes
            mutation.addedNodes.forEach(node => {
                // Only process element nodes
                if (node.nodeType === Node.ELEMENT_NODE) {
                    hideElementsWithText(node);
                }
            });

            // Handle attribute changes (for URLs)
            if (mutation.type === 'attributes' &&
                (mutation.attributeName === 'href' || mutation.attributeName === 'src')) {
                hideElementsWithMatchingUrls(mutation.target);
            }

            // Handle character data changes
            if (mutation.type === 'characterData' &&
                mutation.target.parentElement?.style.visibility !== 'hidden') {
                hideElementsWithText(mutation.target.parentElement);
            }
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['href', 'src', 'alt'] // Only watch relevant attributes
    });

    return observer;
}

// Function to update the filter keywords
function updateFilterKeywords(keywords) {
    // Clear existing keywords
    filterKeywords.clear();

    // Add new keywords
    keywords.forEach(keyword => {
        if (keyword && typeof keyword === 'string') {
            filterKeywords.add(keyword);
        }
    });

    // Rehide elements with new keywords
    restoreHiddenElements();
    if (filterKeywords.size > 0) {
        hideElementsWithText();
    }
}

// Initialize with keywords and start observer
const observer = initializeObserver();
window._contentFilter = {
    observer: observer,
    updateKeywords: updateFilterKeywords,
    restore: restoreHiddenElements
};

// Listen for messages from popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
        case 'updateKeywords':
            updateFilterKeywords(message.keywords);
            break;
        case 'enable':
            // Re-enable filtering with current keywords
            browser.storage.local.get('keywords').then(({ keywords = [] }) => {
                updateFilterKeywords(keywords);
            });
            break;
        case 'disable':
            // Disable filtering and restore elements
            window._contentFilter.restore();
            window._contentFilter.observer.disconnect();
            break;
    }
});

// Initialize on page load
browser.storage.local.get(['keywords', 'disabledSites']).then(({ keywords = [], disabledSites = [] }) => {
    // Check if the site is disabled
    const hostname = window.location.hostname;
    if (!disabledSites.includes(hostname)) {
        updateFilterKeywords(keywords);
    }
});
