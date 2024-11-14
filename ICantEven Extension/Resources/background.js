// Store data in Safari extension settings
let settings = {
    keywords: [],
    disabledSites: []
};

// Load settings from Safari extension storage on startup
function loadSettings() {
    const savedSettings = safari.extension.settings.getItem('filterSettings');
    if (savedSettings) {
        settings = JSON.parse(savedSettings);
    }
}

// Save settings to Safari extension storage
function saveSettings() {
    safari.extension.settings.setItem('filterSettings', JSON.stringify(settings));
}

// Handle messages from popup and content script
safari.application.addEventListener('message', function(event) {
    switch (event.message.type) {
        case 'getKeywords':
            return { keywords: settings.keywords };

        case 'setKeywords':
            settings.keywords = event.message.keywords;
            saveSettings();
            return { success: true };

        case 'getSettings':
            return {
                keywords: settings.keywords,
                disabledSites: settings.disabledSites
            };

        case 'setDisabledState':
            const hostname = event.message.hostname;
            if (event.message.disabled) {
                if (!settings.disabledSites.includes(hostname)) {
                    settings.disabledSites.push(hostname);
                }
            } else {
                settings.disabledSites = settings.disabledSites.filter(site => site !== hostname);
            }
            saveSettings();
            return { success: true };
    }
});

// Load settings when background script starts
loadSettings();
