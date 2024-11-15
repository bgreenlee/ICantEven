// Store filter style preference
var currentFilterStyle = 'hide';

// Function to setup redaction styles
function setupRedactionStyles() {
    if (!document.getElementById('redaction-style')) {
        const style = document.createElement('style');
        style.id = 'redaction-style';
        style.textContent = `
            .redacted {
                background-color: #000 !important;
                color: transparent !important;
                border-radius: 2px;
                user-select: none;
                text-decoration: none !important;
                text-shadow: none !important;
            }
            .redacted img {
                filter: brightness(0%) opacity(0.8);
            }
            .redacted * {
                background-color: #000 !important;
                color: transparent !important;
            }
        `;
        document.head.appendChild(style);
    }
}

// Function to apply the filter based on current style
function applyFilter(element, shouldRestore = false) {
    if (shouldRestore) {
        // Always remove both hiding and redaction when restoring
        element.style.visibility = element.getAttribute('data-original-visibility') || 'visible';
        element.removeAttribute('data-original-visibility');
        element.classList.remove('redacted');
        return;
    }

    if (currentFilterStyle === 'hide') {
        element.setAttribute('data-original-visibility', element.style.visibility);
        element.style.visibility = 'hidden';
        element.classList.remove('redacted'); // Remove redaction if it was previously redacted
    } else {
        // Remove any hiding if it was previously hidden
        element.style.visibility = element.getAttribute('data-original-visibility') || 'visible';
        element.removeAttribute('data-original-visibility');
        element.classList.add('redacted');
    }
}

// Function to find and hide elements that contain the filtered text
function hideElementsWithText(searchText, rootNode = document.body) {
    if (currentFilterStyle === 'redact') {
        setupRedactionStyles();
    }

    let hiddenCount = 0;
    searchText = searchText.toLowerCase();

    // Process links containing the searchText
    const links = rootNode.getElementsByTagName('a');
    for (let link of links) {
        if (link.href && link.href.toLowerCase().includes(searchText)) {
            if ((currentFilterStyle === 'hide' && link.style.visibility !== 'hidden') ||
                (currentFilterStyle === 'redact' && !link.classList.contains('redacted'))) {
                applyFilter(link);
                hiddenCount++;
            }
        }
    }

    // Process images containing the searchText
    const images = rootNode.getElementsByTagName('img');
    for (let img of images) {
        if ((img.src && img.src.toLowerCase().includes(searchText)) ||
            (img.alt && img.alt.toLowerCase().includes(searchText))) {
            if ((currentFilterStyle === 'hide' && img.style.visibility !== 'hidden') ||
                (currentFilterStyle === 'redact' && !img.classList.contains('redacted'))) {
                applyFilter(img);
                hiddenCount++;
            }
        }
    }

    // Walk through all text nodes
    const walker = document.createTreeWalker(
        rootNode,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function(node) {
                const parent = node.parentElement;
                if (!parent ||
                    parent.tagName === 'SCRIPT' ||
                    parent.tagName === 'STYLE' ||
                    (currentFilterStyle === 'hide' && parent.style.visibility === 'hidden') ||
                    (currentFilterStyle === 'redact' && parent.classList.contains('redacted'))) {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        },
        false
    );

    const nodesToFilter = new Set();
    let node;

    while (node = walker.nextNode()) {
        if (node.textContent.toLowerCase().includes(searchText)) {
            let targetElement = node.parentElement;
            while (targetElement &&
                   window.getComputedStyle(targetElement).display === 'inline' &&
                   window.getComputedStyle(targetElement).position === 'static') {
                targetElement = targetElement.parentElement;
            }

            if (targetElement) {
                nodesToFilter.add(targetElement);
            }
        }
    }

    nodesToFilter.forEach(element => {
        applyFilter(element);
        hiddenCount++;
    });

    return hiddenCount;
}

// Function to restore hidden elements
function restoreHiddenElements() {
    const hiddenElements = document.querySelectorAll('[data-original-visibility]');
    const redactedElements = document.querySelectorAll('.redacted');

    hiddenElements.forEach(element => {
        applyFilter(element, true);
    });

    redactedElements.forEach(element => {
        applyFilter(element, true);
    });

    return hiddenElements.length + redactedElements.length;
}

// Function to update keywords
function updateFilterKeywords(keywords) {
    restoreHiddenElements();
    keywords.forEach(keyword => {
        hideElementsWithText(keyword);
    });
}

// Function to handle style updates
function updateFilterStyle(newStyle) {
    // Setup redaction styles if switching to redact
    if (newStyle === 'redact') {
        setupRedactionStyles();
    }

    // Store the new style
    currentFilterStyle = newStyle;

    // Reapply all filters with new style
    browser.storage.local.get('keywords').then(({ keywords = [] }) => {
        // First restore all elements
        restoreHiddenElements();
        // Then reapply with new style
        if (keywords.length > 0) {
            updateFilterKeywords(keywords);
        }
    }).catch(error => {
        console.error('Error updating filter style:', error);
    });
}

// Initialize MutationObserver to watch for DOM changes
function initializeObserver(keywords) {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
            // Handle added nodes
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    keywords.forEach(keyword => {
                        hideElementsWithText(keyword, node);
                    });
                }
            });

            // Handle attribute changes
            if (mutation.type === 'attributes' &&
                (mutation.attributeName === 'href' || mutation.attributeName === 'src')) {
                keywords.forEach(keyword => {
                    hideElementsWithText(keyword, mutation.target);
                });
            }

            // Handle text changes
            if (mutation.type === 'characterData') {
                const parent = mutation.target.parentElement;
                if (parent &&
                    ((currentFilterStyle === 'hide' && parent.style.visibility !== 'hidden') ||
                     (currentFilterStyle === 'redact' && !parent.classList.contains('redacted')))) {
                    keywords.forEach(keyword => {
                        hideElementsWithText(keyword, parent);
                    });
                }
            }
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['href', 'src', 'alt']
    });

    return observer;
}

// Listen for messages from popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
        case 'updateKeywords':
            updateFilterKeywords(message.keywords);
            break;
        case 'updateFilterStyle':
            updateFilterStyle(message.style);
            break;
        case 'enable':
            browser.storage.local.get('keywords').then(({ keywords = [] }) => {
                updateFilterKeywords(keywords);
            });
            break;
        case 'disable':
            restoreHiddenElements();
            if (window._contentFilter && window._contentFilter.observer) {
                window._contentFilter.observer.disconnect();
            }
            break;

        default:
            console.error('Unknown message action', message.action);
    }
});

// update page when tab becomes active
document.addEventListener("visibilitychange", function() {
    if (document.visibilityState == 'visible') {
        browser.storage.local.get(['disabledSites', 'filterStyle']).then(({
            disabledSites = [],
            filterStyle = 'hide'
        }) => {
            const hostname = window.location.hostname;
            if (!disabledSites.includes(hostname)) {
                updateFilterStyle(filterStyle);
            }
        });
    }
});

// Initialize on page load
browser.storage.local.get(['keywords', 'disabledSites', 'filterStyle']).then(({
    keywords = [],
    disabledSites = [],
    filterStyle = 'hide'
}) => {
    const hostname = window.location.hostname;
    if (!disabledSites.includes(hostname)) {
        updateFilterStyle(filterStyle);
        const observer = initializeObserver(keywords);
        window._contentFilter = {
            observer: observer,
            restore: restoreHiddenElements
        };
    }
}).catch(error => {
    console.error('Error initializing content script', error);
});
