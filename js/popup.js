let tab = false;
let scrapeButton;
let downloadCsvButton;
let resultsTable;
let filenameInput;
let downloadResultsSection;
let flashElement;
let searchTerm = '';
// Define and add headers to the table
const headers = [
    { name: 'Count', id: 'keywordRanking' },
    { name: 'Title', id: 'title' },
    { name: 'Website', id: 'companyUrl' },
    { name: 'Phone', id: 'phone' },
    { name: 'Industry', id: 'industry' },
    { name: 'Address', id: 'address' },
    { name: 'Rating', id: 'rating' },
    { name: 'Reviews', id: 'reviewCount' },
    { name: 'Latitude', id: 'latitude' },
    { name: 'Longitude', id: 'longitude' },
    { name: 'Google Maps Link', id: 'resultLink' },
    { name: 'Keyword', id: 'keyword' },
    { name: 'Google Place ID', id: 'placeId' },
    { name: 'Rank', id: 'keywordRanking' },
    { name: 'Testimonial', id: 'testimonial' },
    { name: 'Tags', id: 'tags' }
];
let mdm = {
    "filename": 'map-results.csv'
}
let bodyElement

const domLoadHandler = async () => {
    scrapeButton = document.getElementById('scrapeButton');
    downloadCsvButton = document.getElementById('downloadCsvButton');
    resultsTable = document.getElementById('resultsTable');
    filenameInput = document.getElementById('filenameInput');
    downloadResultsSection = document.getElementById('downloadResultsSection');
    flashElement = document.getElementById('flash');
    bodyElement = document.getElementsByTagName('body')[0];
   
    // Sanity check for needed elements.
    const popupIsMissingElements = !scrapeButton || !downloadCsvButton || !resultsTable || !filenameInput || !downloadResultsSection || !flashElement;    
    if ( popupIsMissingElements ) {
        console.error("Couldn't find one of our elements.");
    }

    // Check for scrapable page.
    chrome.tabs.query({ active: true, currentWindow: true }, isTabScrapable);
}

const isTabScrapable = (tabs) => {
    tab = tabs[0];
    const isScrapable = tab && tab.url && tab.url.includes("google") && tab.url.includes("maps/search");
    if ( ! isScrapable ) {
        disableScraperUI();
        return false;
    }
    
    if ( isScrapable ) {
        initPopup(tab);
    }
}

const disableScraperUI = () => {
    // Disable UI via CSS.
    bodyElement.classList.add( 'disabled' )

    // Empty flash Element.
    flashElement.innerHTML = '';
}

const enableScraperUI = () => {
    console.log("enableScraperUI(): Enabling UI.")
    // Disable UI via CSS.
    bodyElement.classList.remove( 'disabled' )

    scrapeButton.disabled = false;
    scrapeButton.classList.add('enabled');
    scrapeButton.addEventListener('click', scrapeButtonHandler);

    // Enable CSV Download button.
    downloadCsvButton.addEventListener('click', downloadCsvButtonHandler);

    // Empty flash Element.
    flashElement.innerHTML = '';
}

const initPopup = async () => {
    console.log("initPopup(): Initiating Popup.");

    // Ensure frontend is ready.
    pingFrontend()

    // Enable scrape button.
    enableScraperUI();
}

const scrapeButtonHandler = async () => {
    start();
    return false;
};

const saveResults = (results) => {
    chrome.storage.local.set({ scrapedResults: results });
};

const downloadCsvButtonHandler = () => {
    // Retrieve the results from storage to generate CSV
    chrome.storage.local.get('scrapedResults', (data) => {
        if (data.scrapedResults) {
            let csv = convertResultsToCsv(data.scrapedResults);
            const filename = getFilename()

            downloadCsv(csv, filename);
        } else {
            console.error('No results found to download.');
        }
    });
};

const getFilename = () => {
    let filename
    
    if ( filenameInput && filenameInput.value && filenameInput.value.length > 0 ) {
        filename = filenameInput.value.trim();
    }

    if (!filename && mdm.filename) {
        filename = mdm.filename
    }

    if (! filename) {
        filename = getDefaultFilename()
    }

    filename = filename.replace(/[^a-z\-\_\.0-9]/gi, '_');
    return filename
}

const convertResultsToCsv = (results) => {
    let csv = [];

    // Add header row
    const headerRows = []
    const ignoredColumns = [
        'Count'
    ]
    headers.forEach(header => {
        if ( ignoredColumns.includes( header.name ) ) {
            return;
        }
        headerRows.push(header.name);
    });
    csv.push(headerRows.join(','));

    // Add rows for each result
    results.forEach((result, index) => {
        console.log("---")
        console.log("result", result)
        const row = [];
        headers.forEach(header => {
            let value = ''
            
            if (header.id === 'tags') {
                console.log("header:", header.name, header)
                console.log("rhid", result[header.id], typeof result[header.id])
            }
            // Ignored column.
            if ( ignoredColumns.includes( header.name ) ) {
                return;
            }

            // Set value.
            if ( result && header && result[header.id] ) {

                if ( typeof result[header.id] === 'object' && result[header.id].length) {
                    console.log('thats a bingo!')
                    value = result[header.id].join(",")
                }

                if ( typeof result[header.id] === 'string' ) {
                    value = result[header.id];
                }
            }

            // Add value to row.
            row.push(escapeCsvValue(value)); // Escape each value before adding it
        });

        csv.push(row.join(','));
    });

    return csv.join('\n');
};

// Function to escape CSV values
const escapeCsvValue = (value) => {
    if (typeof value === 'array') {
        value = value.join(",")
    }
    if (typeof value === 'string') {
        // Replace double quotes with two double quotes
        value = value.replace(/"/g, '""');
        // If value contains a comma, newline, or double quote, surround with double quotes
        if (value.includes(',') || value.includes('\n') || value.includes('"')) {
            value = `"${value}"`;
        }
    }
    return value;
};

const fillTable = (results) => {
    // Clear the existing table content
    while (resultsTable.firstChild) {
        resultsTable.removeChild(resultsTable.firstChild);
    }

    const headerRow = document.createElement('tr');
    headers.forEach(header => {
        const headerElement = document.createElement('th');
        headerElement.textContent = header.name;
        if (header.name === 'Count') {
            headerElement.innerHTML = '&nbsp;';
        }
        headerRow.appendChild(headerElement);
    });
    resultsTable.appendChild(headerRow);

    if (!results || !results.length) {
        console.error("No results found to display.");
        return;
    }

    // Add new results to the table
    results.forEach((result, index) => {
        let row = document.createElement('tr');

        // Empty result.
        if ( ! result || ! result.title ) {
            return;
        }

        headers.forEach((header) => {
            let cell = document.createElement('td');

            // Default to empty.
            cell.textContent = '';

            // Data is missing so we append an empty cell.
            if ( ! result || ! header || ! header.id || ! result[header.id] ) {
                row.appendChild(cell);
                return
            }

            // Set the cell to our data.
            cell.textContent = result[header.id];
            
            // Custom data for Count.
            if (header.name === 'Count') {
                cell.classList.add('count');
                cell.textContent = index + 1; // Display count based on index
            }

            // Handle URL columns.
            let urlColumns = [
                'resultLink',
                'companyUrl'
            ]
            if ( urlColumns.includes(header.id) ) {
                cell.innerHTML = wrapUrlInAnchorTag(result[header.id]);
            }
            row.appendChild(cell);
        });
        resultsTable.appendChild(row);
    });

    if (results.length > 0) {
        downloadCsvButton.disabled = false; // Enable download button if results exist
    }
};

const pingFrontend = async () => {
    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(currentTab.id, { action: "ping" }, (response) => {
        // Some sort of error was thrown.
        if (chrome.runtime.lastError) {
            console.error("pingFrontend(): Ping failed: ", chrome.runtime.lastError.message);
        }

        if (response && response.status === "ready") {
            console.log("pingFrontend(): Listener ready.");
            return true
        } else {
            console.error("pingFrontend(): Listener not ready, retrying...");
            setTimeout(pingFrontend, 1000); // Retry after 1 second
            return false
        }
    });
};

const showScrapeResultsSection = () => {
    downloadResultsSection.classList.remove('hidden');
}

const start = () => {
    console.log('start(): Starting a scrape.')

    // Scrape the Global values.
    mdm = scrapeGlobals()

    // Show Results Section.
    populateScrapeResultsSection();
    showScrapeResultsSection();

    chrome.tabs.sendMessage(tab.id, { action: "scrapeResults" }, (response) => {
        // Some sort of error was thrown.
        if (chrome.runtime.lastError) {
            console.error("Message delivery failed: ", chrome.runtime.lastError.message);
        }

        // We got data back.
        if (response && response.data) {
            saveResults(response.data);
            fillTable(response.data);
        }
        
        // No data received.
        if ( ! response || ! response.data) {
            console.error("No data received or response is undefined");
        }
    });
}

const populateScrapeResultsSection = () => {
    // Set filename based on search term and datestamp in the input field
    let filenameTmp = filenameInput.value.trim();
    if (!filenameTmp) {
        filenameTmp = getDefaultFilename()
        mdm.filename = filenameTmp
        filenameInput.value = filenameTmp; // Set the value of the input field
    }
}

const getDatestamp = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const day = String(now.getDate()).padStart(2, '0');

    return `${year}${month}${day}`;
};

const getDefaultFilename = () => {
    let globalSearchTermSet = mdm.searchTerm && mdm.searchTerm.length > 0;
    if ( ! globalSearchTermSet ) {
        return ''
    }
    // If we don't have a global filename set, we set it.
    let ds = getDatestamp();
    let searchTermSlug = mdm.searchTerm.toLowerCase().replace(/ /g, "-")
    filename = `${searchTermSlug}-${ds}.csv`;

    return filename
}

const scrapeGlobals = async () => {
    await chrome.tabs.sendMessage(tab.id, { action: "scrapeGlobals" }, (response) => {
        // Encountered error.
        if (chrome.runtime.lastError) {
            console.error("Message delivery failed: ", chrome.runtime.lastError.message);
            // return false;
        }
    
        // Got nothing back.
        if ( ! response || ! response.data ) {
            console.error("No data received or response is undefined");
            return false;
        }
    
        // Got globals back.
        console.log( "scrapeGlobalsHandler(): Setting globals", response.data)
        mdm = response.data
        populateScrapeResultsSection()
        return true;
    });
}

const downloadCsv = (csv, filename) => {
    let csvFile;
    let downloadElement;

    // No CSV data provided.
    if (!csv) {
        console.error("downloadCsv(): No CSV data provided.");
        return false;
    }

    csvFile = new Blob([csv], { type: 'text/csv' });

    // Create element.
    downloadElement = document.createElement('a');

    // Hide it.
    downloadElement.style.display = 'none';

    // Set filename.
    downloadElement.download = filename;

    // Set CSV data.
    downloadElement.href = window.URL.createObjectURL(csvFile);

    // Append to the DOM.
    document.body.appendChild(downloadElement);

    // Force-click to start download.
    downloadElement.click();

    // Clean up
    document.body.removeChild(downloadElement);
};

const wrapUrlInAnchorTag = (inputString) => {
    // Regular expression to check for a valid URL
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    const truncateLength = 20
    const moreString = '...'
    const moreStringLength = moreString.length
    const netAllowedLength = truncateLength - moreStringLength;
    
    // Check if the input string matches the URL pattern
    if ( urlPattern.test( inputString ) ) {
        // Extract the URL
        const url = inputString.match(urlPattern)[0];
        let label = url
        
        // Truncate the URL to `truncateLength` characters for the label
        if (url.length > truncateLength) {
            label = url.substring(0, netAllowedLength) + moreString;
        }

        // Create an anchor tag wrapping the URL
        const anchorTag = `<a href="${url}" target="_blank">${label}</a>`;

        // Return the anchor tag
        return anchorTag;
    } else {
        return inputString; // Return the original string if no URL found
    }
}

// Other functions remain unchanged...
document.addEventListener('DOMContentLoaded', domLoadHandler);