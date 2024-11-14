// Store references to DOM elements
const enableFilter = document.getElementById('enableFilter');
const keywordsList = document.getElementById('keywordsList');
const newKeyword = document.getElementById('newKeyword');
const addKeywordBtn = document.getElementById('addKeyword');
const status = document.getElementById('status');

let currentTab = null;

// Helper function to show status message
function showStatus(message, isError = false) {
    status.textContent = message;
    status.style.color = isError ? '#ff4444' : '#4CAF50';
    setTimeout(() => {
        status.textContent = '';
    }, 2000);
}

// Function to render keywords list
function renderKeywords(keywords) {
    keywordsList.innerHTML = '';
    keywords.forEach(keyword => {
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
    // Save to storage
    await browser.storage.local.set({ keywords });

    // Update on current tab if filter is enabled
    if (currentTab && enableFilter.checked) {
        await browser.tabs.sendMessage(currentTab.id, {
            action: 'updateKeywords',
            keywords: keywords
        });
    }

    renderKeywords(keywords);
}

// Function to add new keyword
async function addKeyword(keyword) {
    keyword = keyword.trim().toLowerCase();
    if (!keyword) return;

    try {
        // Get current keywords
        const result = await browser.storage.local.get('keywords');
        const keywords = result.keywords || [];

        // Check if keyword already exists
        if (keywords.includes(keyword)) {
            showStatus('Keyword already exists', true);
            return;
        }

        // Add new keyword
        const newKeywords = [...keywords, keyword];
        await updateKeywords(newKeywords);

        // Clear input
        newKeyword.value = '';
//        showStatus('Keyword added');
    } catch (error) {
        console.error('Error adding keyword:', error);
        showStatus('Error adding keyword', true);
    }
}

// Function to remove keyword
async function removeKeyword(keyword) {
    try {
        const result = await browser.storage.local.get('keywords');
        const keywords = result.keywords || [];
        const newKeywords = keywords.filter(k => k !== keyword);
        await updateKeywords(newKeywords);
//        showStatus('Keyword removed');
    } catch (error) {
        console.error('Error removing keyword:', error);
        showStatus('Error removing keyword', true);
    }
}

// Initialize popup
async function initializePopup() {
    try {
        // Get current tab
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        currentTab = tabs[0];

        // Get current settings
        const results = await browser.storage.local.get(['keywords', 'disabledSites']);
        const keywords = results.keywords || [];
        const disabledSites = results.disabledSites || [];

        // Set initial state
        renderKeywords(keywords);
        enableFilter.checked = !disabledSites.includes(new URL(currentTab.url).hostname);
    } catch (error) {
        console.error('Error initializing popup:', error);
        showStatus('Error loading settings', true);
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
        showStatus('Error updating settings', true);
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
