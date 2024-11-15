// Store references to DOM elements
const enableFilter = document.getElementById('enableFilter');
const keywordsList = document.getElementById('keywordsList');
const newKeyword = document.getElementById('newKeyword');
const addKeywordBtn = document.getElementById('addKeyword');
const status = document.getElementById('status');

let currentTab = null;

// Function to render keywords list
function renderKeywords(keywords) {
    keywordsList.innerHTML = '';
    // hide the keywords container if there's no keywords
    keywordsList.parentElement.hidden = (keywords.length == 0);
    keywords.reverse().forEach(keyword => {
        const item = document.createElement('div');
        item.className = 'keyword-item';

        const text = document.createElement('span');
        text.className = 'keyword-text';
        text.textContent = keyword;

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-keyword';
        removeBtn.innerHTML = '×';
        removeBtn.onclick = () => removeKeyword(keyword);

        item.appendChild(text);
        item.appendChild(removeBtn);
        keywordsList.appendChild(item);
    });
}

// Function to update keywords
async function updateKeywords(keywords) {
    try {
        // Save to storage
        await browser.storage.local.set({ keywords });

        // Update on current tab if filter is enabled
        if (enableFilter.checked) {
            await browser.tabs.sendMessage(currentTab.id, {
                action: 'updateKeywords',
                keywords: keywords
            });
        }

        renderKeywords(keywords);
    } catch (error) {
        console.error('Error updating keywords', error);
    }
}

// Function to add new keyword
async function addKeyword(keyword) {
    keyword = keyword.trim().toLowerCase();
    if (!keyword) return;

    try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        const result = await browser.storage.local.get('keywords');
        const keywords = result.keywords || [];

        if (keywords.includes(keyword)) {
            return;
        }

        const newKeywords = [...keywords, keyword];

        // Save to storage
        await browser.storage.local.set({ keywords: newKeywords });

        // Update content script if filter is enabled
        if (enableFilter.checked) {
            await browser.tabs.sendMessage(currentTab.id, {
                action: 'updateKeywords',
                keywords: newKeywords
            });
        }

        // Update UI
        renderKeywords(newKeywords);
        newKeyword.value = '';
    } catch (error) {
        console.error('Error adding keyword', error);
    }
}

// Function to remove keyword
async function removeKeyword(keyword) {
    try {
        const result = await browser.storage.local.get('keywords');
        const keywords = result.keywords || [];
        const newKeywords = keywords.filter(k => k !== keyword);
        await updateKeywords(newKeywords);
    } catch (error) {
        console.error('Error removing keyword', error);
    }
}

// Initialize popup
async function initializePopup() {
    try {
        // Get current tab
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        currentTab = tabs[0];

        // Get current settings
        const results = await browser.storage.local.get(['keywords', 'disabledSites', 'filterStyle']);
        const keywords = results.keywords || [];
        const disabledSites = results.disabledSites || [];
        const filterStyle = results.filterStyle || 'hide';

        // Set initial state
        renderKeywords(keywords);
        enableFilter.checked = !disabledSites.includes(new URL(currentTab.url).hostname);
        document.getElementById('filterStyle').value = filterStyle;

        // Get and display version
        const manifest = browser.runtime.getManifest();
        const versionElement = document.getElementById('version');
        if (versionElement) {
            versionElement.textContent = `Version ${manifest.version}`;
        }
    } catch (error) {
        console.error('Error initializing popup', error);
    }
}

// Event Listeners
enableFilter.addEventListener('change', async () => {
    try {
        const hostname = new URL(currentTab.url).hostname;
        const result = await browser.storage.local.get('disabledSites');
        const disabledSites = result.disabledSites || [];

        let newDisabledSites;
        if (enableFilter.checked) {
            newDisabledSites = disabledSites.filter(site => site !== hostname);
            await browser.tabs.sendMessage(currentTab.id, { action: 'enable' });
        } else {
            newDisabledSites = [...disabledSites, hostname];
            await browser.tabs.sendMessage(currentTab.id, { action: 'disable' });
        }

        await browser.storage.local.set({ disabledSites: newDisabledSites });
    } catch (error) {
        console.error('Error toggling filter:', error);
    }
});

document.getElementById('filterStyle').addEventListener('change', async (e) => {
    const newStyle = e.target.value;

    try {
        // Save the setting
        await browser.storage.local.set({ filterStyle: newStyle });

        if (enableFilter.checked) {
            // Send message to content script
            await browser.tabs.sendMessage(currentTab.id, {
                action: 'updateFilterStyle',
                style: newStyle
            });
        }
    } catch (error) {
        console.error('Error updating filter style:', error);
    }
});

addKeywordBtn.addEventListener('click', () => {
    addKeyword(newKeyword.value);
});

newKeyword.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
        addKeyword(newKeyword.value);
    }
});

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', initializePopup);
