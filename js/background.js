// chrome.webNavigation.onCompleted.addListener((details) => {
//     console.log("Nav detected...")
//     if (details.frameId === 0) { // Only inject into the main frame
//         console.log("background.js: Reinjecting content script into:", details.tabId);
//         chrome.scripting.executeScript({
//             target: { tabId: details.tabId },
//             files: ["js/maps-data-miner.js"]
//         });
//     }
// });
