//// Listen for messages from content script or popup
//browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
//    console.log('Background script received message:', message);
//
//    switch (message.action) {
//        case 'getSettings':
//            return browser.storage.local.get(['keywords', 'disabledSites', 'filterStyle']);
//
//        case 'updateSettings':
//            return browser.storage.local.set(message.settings);
//
//        default:
//            console.log('Unknown message action:', message.action);
//    }
//});
