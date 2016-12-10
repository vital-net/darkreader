chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!sender.tab) {
        return;
    }
    if (message.missingStyleSheetUrl) {
        var url = message.missingStyleSheetUrl;
        var request = new XMLHttpRequest();
        request.open('GET', url);
        request.onload = () => {
            sendResponse({
                url,
                styleSheet: request.responseText
            });
        };
        request.onerror = (e) => {
            sendResponse({
                error: e.error
            });
        };
        request.send(null);
    }
    return true;
});