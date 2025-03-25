'use strict'

let bodyElement
let downloadCsvButton
let downloadResultsSection
let filenameInput
let flashElement
let resultsTable
let refreshDataButton
let searchTerm = ''
let tab = false
let mdm = {
    "filename": '',
    "searchTerm": '',
}

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
]


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'syncScrapeData') {
        console.log("Syncing updated scrape data.", message)
        saveResults( message.results )
        fillTable( message.results )
        sendResponse({ status: "OK" })
    }
    return true;
})


/**
 * Initializes DOM elements and performs a sanity check to ensure all required
 * elements are present. Queries the current active tab to determine if the page
 * is scrapable and sets up the necessary UI elements for interaction.
 * If any essential elements are missing, an error is logged.
 */

const domLoadHandler = async () => {
    refreshDataButton = document.getElementById('refreshDataButton')
    downloadCsvButton = document.getElementById('downloadCsvButton')
    resultsTable = document.getElementById('resultsTable')
    filenameInput = document.getElementById('filenameInput')
    downloadResultsSection = document.getElementById('downloadResultsSection')
    flashElement = document.getElementById('flash')
    bodyElement = document.getElementsByTagName('body')[0]

    // Sanity check for needed elements.
    const popupIsMissingElements = !refreshDataButton || !downloadCsvButton || !resultsTable || !filenameInput || !downloadResultsSection || !flashElement
    if (popupIsMissingElements) {
        console.error("Couldn't find one of our elements.")
    }

    // Check for scrapable page.
    chrome.tabs.query({ active: true, currentWindow: true }, isTabScrapable)
}

/**
 * Checks if the active tab is scrapable.
 * @param {Array<Object>} tabs - An array of tab objects.
 * @returns {boolean} True if the tab is scrapable, false if it isn't.
 */
const isTabScrapable = (tabs) => {
    tab = tabs[0]
    const isScrapable = tab && tab.url && tab.url.includes("google") && tab.url.includes("maps/search")
    if (!isScrapable) {
        disableScraperUI()
        return false
    }

    if (isScrapable) {
        initPopup(tab)
    }
}

/**
 * Disables the popup UI for the scraper by adding the 'disabled' CSS class to the body and
 * emptying the flash element.
 *
 * @returns {void}
 */
const disableScraperUI = () => {
    // Disable UI via CSS.
    bodyElement.classList.add('disabled')

    // Empty flash Element.
    flashElement.innerHTML = ''
}

/**
 * Enables the popup UI for the scraper by removing the 'disabled' CSS class on the body,
 * enabling the scrape button, adding a click event listener to the scrape button, and
 * adding a click event listener to the download CSV button.
 * 
 * @returns {void}
 */
const enableScraperUI = () => {
    console.log("enableScraperUI(): Enabling UI.")

    // Disable UI via CSS.
    bodyElement.classList.remove('disabled')

    // Enable CSV Download button.
    downloadCsvButton.addEventListener('click', downloadCsvButtonHandler)

    // Empty flash Element.
    flashElement.innerHTML = ''
}

/**
 * Initializes the popup by ensuring the frontend is ready and enabling the scraper UI.
 *
 * @returns {void}
 */
const initPopup = async () => {
    console.log("initPopup(): Initiating Popup.")

    // Ensure frontend is ready.
    pingFrontend()

    // Enable scrape button.
    enableScraperUI()
}

/**
 * Handles the click event for the "Scrape" button.
 *
 * @return {boolean} Prevents default link behavior.
 */
const refreshDataButtonHandler = async () => {
    start()
    return false
}

/**
 * Saves scraped results to local storage.
 *
 * @param {Array<Object>} results - Scrape results to save.
 */
const saveResults = (results) => {
    chrome.storage.local.set({ scrapedResults: results })
}

/**
 * Handles the click event for the download CSV button.
 *
 * Retrieves the scraped results from local storage, converts them into CSV format,
 * and triggers the download of the CSV file using a generated filename.
 * If no results are found in storage, logs an error message.
 */

const downloadCsvButtonHandler = () => {
    // Retrieve the results from storage to generate CSV
    chrome.storage.local.get('scrapedResults', (data) => {
        if (data.scrapedResults) {
            let csv = convertResultsToCsv(data.scrapedResults)
            const filename = getFilename()

            downloadCsv(csv, filename)
        } else {
            console.error('No results found to download.')
        }
    })
}

/**
 * Returns a filename based on the following order of priority:
 * 1. The value of the `#filenameInput` field if it is not empty.
 * 2. The value of `mdm.filename` if it is set.
 * 3. The result of calling `generateDefaultFilename()`.
 * The filename is then sanitised by replacing any non-alphanumeric
 * characters with an underscore.
 * @returns {string} The filename to be used.
 */
const getFilename = () => {
    let filename = ''
    
    if (filenameInput && filenameInput.value && filenameInput.value.length > 0) {
        filename = filenameInput.value.trim()
    }
    
    if (!filename && mdm.filename && mdm.filename.length ) {
        filename = mdm.filename
    }
    
    if (!filename.length) {
        filename = generateDefaultFilename()
    }
    
    // Sanitize.
    filename = filename.replace(/[^a-z\-\_\.0-9]/gi, '_')
    
    // If we don't have it set in the config already, we set it.
    if ( filename && ( ! mdm.filename || mdm.filename.length <= 0) ) {
        console.log("getFilename(): Storing filename", filename)
        saveFilename( filename )
    }
    
    // Send it back.
    console.log("getFilename(): Got filename:", filename)
    return filename
}

/**
 * Saves a filename to the local storage.
 *
 * @param {string} filename - The filename to be saved.
 * @returns {undefined} Nothing.
 */
const saveFilename = ( filename ) => {
    mdm.filename = filename
}

/**
 * Converts an array of results to a CSV string.
 *
 * This function takes an array of objects, where each object represents a
 * result. The function will create a header row from the column names, and
 * then construct a row for each result, using the column names to determine
 * the order of the values in the row. The function will also escape any values
 * that contain special characters, such as commas or double quotes.
 *
 * @param {Array<Object>} results - The array of results to be converted to
 *    CSV.
 * @returns {string} The CSV string.
 */
const convertResultsToCsv = (results) => {
    let csv = []

    // Add header row
    const headerRows = []
    const ignoredColumns = [
        'Count'
    ]
    headers.forEach(header => {
        if (ignoredColumns.includes(header.name)) {
            return
        }
        headerRows.push(header.name)
    })
    csv.push(headerRows.join(','))

    // Add rows for each result
    results.forEach((result, index) => {
        // console.log("---")
        // console.log("result", result)
        const row = []
        headers.forEach(header => {
            let value = ''

            if (header.id === 'tags') {
                // console.log("header:", header.name, header)
                // console.log("rhid", result[header.id], typeof result[header.id])
            }
            // Ignored column.
            if (ignoredColumns.includes(header.name)) {
                return
            }

            // Set value.
            if (result && header && result[header.id]) {

                if (typeof result[header.id] === 'object' && result[header.id].length) {
                    // console.log('thats a bingo!')
                    value = result[header.id].join(",")
                }

                if (typeof result[header.id] === 'string') {
                    value = result[header.id]
                }
            }

            // Add value to row.
            row.push(escapeCsvValue(value)) // Escape each value before adding it
        })

        csv.push(row.join(','))
    })

    return csv.join('\n')
}

/**
 * Escapes a value for inclusion in a CSV file.
 *
 * If the value is an array, it is joined into a comma-separated string.
 * If the value is a string, double quotes within the string are replaced
 * with two double quotes to escape them. If the string contains a comma,
 * newline, or double quote, it is surrounded with double quotes to ensure
 * proper CSV formatting.
 *
 * @param {string|array} value - The value to be escaped for CSV.
 * @returns {string} - The escaped CSV-compatible string.
 */
const escapeCsvValue = (value) => {
    if (typeof value === 'array') {
        value = value.join(",")
    }
    if (typeof value === 'string') {
        // Replace double quotes with two double quotes
        value = value.replace(/"/g, '""')
        // If value contains a comma, newline, or double quote, surround with double quotes
        if (value.includes(',') || value.includes('\n') || value.includes('"')) {
            value = `"${value}"`
        }
    }
    return value
}

/**
 * fillTable()
 * @description Fills the scrape results table with the given results. If the results array is empty, the table is cleared.
 * @param {array} results - The results to fill the table with.
 */
const fillTable = (results) => {
    // Clear the existing table content
    while (resultsTable.firstChild) {
        resultsTable.removeChild(resultsTable.firstChild)
    }

    const headerRow = document.createElement('tr')
    headers.forEach(header => {
        const headerElement = document.createElement('th')
        headerElement.textContent = header.name
        if (header.name === 'Count') {
            headerElement.innerHTML = '&nbsp'
        }
        headerRow.appendChild(headerElement)
    })
    resultsTable.appendChild(headerRow)

    if (!results || !results.length) {
        console.error("No results found to display.")
        return
    }

    // Add new results to the table
    results.forEach((result, index) => {
        let row = document.createElement('tr')

        // Empty result.
        if (!result || !result.title) {
            return
        }

        headers.forEach((header) => {
            let cell = document.createElement('td')

            // Default to empty.
            cell.textContent = ''

            // Data is missing so we append an empty cell.
            if (!result || !header || !header.id || !result[header.id]) {
                row.appendChild(cell)
                return
            }

            // Set the cell to our data.
            cell.textContent = result[header.id]

            // Custom data for Count.
            if (header.name === 'Count') {
                cell.classList.add('count')
                cell.textContent = index + 1 // Display count based on index
            }

            // Handle URL columns.
            let urlColumns = [
                'resultLink',
                'companyUrl'
            ]
            if (urlColumns.includes(header.id)) {
                cell.innerHTML = wrapUrlInAnchorTag(result[header.id])
            }
            row.appendChild(cell)
        })
        resultsTable.appendChild(row)
    })

    if (results.length > 0) {
        downloadCsvButton.disabled = false // Enable download button if results exist
    }
}

/**
 * Pings the content script to check if it's ready to receive messages.
 * If the content script is not ready, it will retry every second.
 * @returns {Promise<Boolean>} `true` if the content script is ready, `false` otherwise.
 */
const pingFrontend = async () => {
    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true })
    chrome.tabs.sendMessage(currentTab.id, { action: "ping" }, (response) => {
        // Some sort of error was thrown.
        if (chrome.runtime.lastError) {
            console.error("pingFrontend(): Ping failed: ", chrome.runtime.lastError.message)
        }

        if (response && response.status === "ready") {
            console.log("pingFrontend(): Listener ready.")
            start()
            return true
        } else {
            console.error("pingFrontend(): Listener not ready, retrying...")
            setTimeout(pingFrontend, 1000) // Retry after 1 second
            return false
        }
    })
}

/**
 * Shows the download results section.
 *
 * Removes the 'hidden' class from the download results section element.
 */
const showScrapeResultsSection = () => {
    downloadResultsSection.classList.remove('hidden')
    refreshDataButton.disabled = false
    refreshDataButton.classList.add('enabled')
    refreshDataButton.classList.remove('hidden')
    refreshDataButton.addEventListener('click', refreshDataButtonHandler)
}

/**
 * Starts the scrape process.
 *
 * Scrapes the global variables and shows the scrape results section.
 * Then sends a message to the content script to scrape the results.
 *
 * @returns {undefined} Nothing.
 */
const start = () => {
    console.log('start(): Starting a scrape.')

    // Scrape the Global values.
    let globalsTmp = scrapeGlobals()
    if ( globalsTmp.searchTerm ) {
        mdm.searchTerm = globalsTmp.searchTerm
        mdm.filename = generateDefaultFilename()
    }
    
    chrome.tabs.sendMessage(tab.id, { action: "scrapeResults" }, (response) => {
        // Some sort of error was thrown.
        if (chrome.runtime.lastError) {
            console.error("start(): Call to 'scrapeResults' failed: ", chrome.runtime.lastError.message)
        }
        
        // We got data back.
        if (response && response.data) {
            saveResults(response.data)
            fillTable(response.data)
            showScrapeResultsSection()
            populateFilenameInput()
        }

        // No data received.
        if (!response || !response.data) {
            console.error("start(): Call to 'scrapeResults' failed: No data received")
        }
    })
}

/**
 * Refreshes the global variables (search term) by scraping the global
 * variables from the content script and updating the `mdm` object.
 *
 * @returns {undefined} Nothing.
 */
const refreshGlobalData = () => {

}
/**
 * Populates the scrape results input by setting the filename input field
 * based on the search term and datestamp if it is empty.
 */
const populateFilenameInput = () => {
    // Set filename based on search term and datestamp in the input field
    let filenameTmp = getFilename()
    console.log("populateFilenameInput(): Populating input with filename '%s'", filenameTmp, filenameInput)
    if (filenameTmp) {
        // Set the value of the input field
        // filenameInput.setAttribute('value', filenameTmp);
        filenameInput.value = filenameTmp
    }
}

/**
 * Returns today's date in a string format of "YYYYMMDD", e.g. 20220115.
 *
 * @return {String} A date string in the format of "YYYYMMDD".
 */
const getDatestamp = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0') // Months are 0-indexed
    const day = String(now.getDate()).padStart(2, '0')

    return `${year}${month}${day}`
}

/**
 * Returns a default filename based on the global search term and today's date.
 *
 * @return {String} A filename string, or an empty string if no search term is set.
 */
const generateDefaultFilename = () => {
    console.log("generateDefaultFilename(): Generating default filename.")
    let filename = ''
    let globalSearchTermSet = mdm && mdm.searchTerm && mdm.searchTerm.length > 0
    // console.log( "generateDefaultFilename(): ", mdm.searchTerm)
    let searchTermSlug = globalSearchTermSet ? mdm.searchTerm : 'maps'
    let ds = getDatestamp()

    // If we don't have a global filename set, we set it.
    searchTermSlug = searchTermSlug.toLowerCase().replace(/ /g, "-")
    
    // Update filename.
    filename = `${searchTermSlug}-${ds}.csv`
    console.log("generateDefaultFilename(): Generated filename:", filename)

    return filename
}

/**
 * Scrapes global variables from the content script and updates the `mdm` object.
 *
 * @return {Promise<Boolean>} `true` if the globals were scraped successfully, `false` otherwise.
 */
const scrapeGlobals = async () => {
    console.log( "scrapeGlobals(): Scraping globals")
    await chrome.tabs.sendMessage(tab.id, { action: "scrapeGlobals" }, (response) => {
        // Encountered error.
        if (chrome.runtime.lastError) {
            console.error("scrapeGlobals(): Message failed:", chrome.runtime.lastError.message)
        }

        // Got nothing back.
        if (!response || !response.data) {
            console.error("scrapeGlobals(): No data received")
            return {}
        }

        // Got globals back.
        if ( response.data.searchTerm ) {
            console.log("scrapeGlobals(): Setting searchTerm to", response.data.searchTerm)
            mdm.searchTerm = response.data.searchTerm
            mdm.filename = generateDefaultFilename()
        }

        return mdm
    })
    console.log( "scrapeGlobals(): mdm... ", mdm )
    return mdm
}

/**
 * downloadCsv()
 * @description Downloads a CSV file using the blob api.
 * @param {string} csv - The CSV data to be downloaded.
 * @param {string} filename - The name of the file to be downloaded.
 * @returns {boolean} success - Whether the download was successful.
 */
const downloadCsv = (csv, filename) => {
    let csvFile
    let downloadElement

    // No CSV data provided.
    if (!csv) {
        console.error("downloadCsv(): No CSV data provided.")
        return false
    }

    csvFile = new Blob([csv], { type: 'text/csv' })

    // Create element.
    downloadElement = document.createElement('a')

    // Hide it.
    downloadElement.style.display = 'none'

    // Set filename.
    downloadElement.download = filename

    // Set CSV data.
    downloadElement.href = window.URL.createObjectURL(csvFile)

    // Append to the DOM.
    document.body.appendChild(downloadElement)

    // Force-click to start download.
    downloadElement.click()

    // Clean up
    document.body.removeChild(downloadElement)
}

/**
 * Wrap a URL in an anchor tag, truncating the label if it is too long.
 * @param {string} inputString - The string containing the URL to wrap.
 * @returns {string} The string with the URL wrapped in an anchor tag, or the original string if no URL was found.
 */
const wrapUrlInAnchorTag = (inputString) => {
    // Regular expression to check for a valid URL
    const urlPattern = /(https?:\/\/[^\s]+)/g
    const truncateLength = 20
    const moreString = '...'
    const moreStringLength = moreString.length
    const netAllowedLength = truncateLength - moreStringLength

    // Check if the input string matches the URL pattern
    if (urlPattern.test(inputString)) {
        // Extract the URL
        const url = inputString.match(urlPattern)[0]
        let label = url

        // Truncate the URL to `truncateLength` characters for the label
        if (url.length > truncateLength) {
            label = url.substring(0, netAllowedLength) + moreString
        }

        // Create an anchor tag wrapping the URL
        const anchorTag = `<a href="${url}" target="_blank">${label}</a>`

        // Return the anchor tag
        return anchorTag
    } else {
        return inputString // Return the original string if no URL found
    }
}

document.addEventListener('DOMContentLoaded', domLoadHandler)