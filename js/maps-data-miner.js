(function() {

    // Global config & data.
    let mdm = {
        searchTerm: '',
        filename: ''
    }
    let observer

    console.log("Hi")

    // Initialize.
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        try {
            if (message.action === "scrapeResults") {
                const results = scrapeData() // Call your scraping function
                setTimeout(() => sendResponse({ data: results }), 0)
                // sendResponse({ data: results })
                // return true
            }
        
            if (message.action === "ping") {
                sendResponse({ status: "ready" })
                // return true
            }
        
            // Scrape Global variables.
            if (message.action === "scrapeGlobals") {
                const globalData = scrapeGlobals()
                setTimeout(() => sendResponse({ data: globalData }), 0)
                // sendResponse({ data: globalData })
                // return true
            }
        } catch (error) {
            console.error("Error handling message:", error);
        }
        return true // Keep the message channel open for asynchronous response
    })

    /**
     * Scrapes data by ignoring specified domains and extracting links on the page.
     *
     * This function logs the scraping process and defines a list of domains to ignore.
     * It constructs a selector for these domains, queries the document for links that
     * match the selector, and uses the `scrapeResults` function to process the links.
     *
     * @returns {Array<Object>} An array of objects containing the scraped data.
     */
    const scrapeData = () => {
        console.log("scrapeData(): Scraping.")
        let domainsToIgnore = [
            "https://www.google.com",
            "https://www.google.ca",
            "https://www.google.com/maps/place",
            "https://www.google.ca/maps/place",
            "https://www.googleadservices.com",
        ]

        let ignoredArray = domainsToIgnore.map((domain) => {
            return 'a[href^="' + domain + '"]'
        })
        let ignoredDomains = ignoredArray.join(", ")
        let links = Array.from(document.querySelectorAll(ignoredDomains))
        let results = scrapeResults(links)

        return results
    }

    /**
     * Given an element, removes all elements with aria-hidden="true" and then
     * attempts to extract tags from the remaining elements.
     *
     * @param {Element} element
     * @return {Array<string>} tags
     */
    const extractTags = (element) => {
        // Remove all elements with aria-hidden="true"
        let tag
        let tags = []

        // Remove hidden and spacer elements.
        const hiddenElements = element.querySelectorAll('[aria-hidden="true"]')
        hiddenElements.forEach(elem => elem.remove())

        // With the remaining, grab the tags.
        const potentialTags = element.querySelectorAll('span')
        potentialTags.forEach((elem) => {
            tag = elem.textContent.trim()

            if (tag && tag.length > 0) {
                tags.push(tag)
            }
        })

        // Return scraped tags.
        return tags
    }

    /**
     * Given an array of links, scrapes the relevant data and returns an array of objects.
     *
     * @param {Array<Element>} links - Array of links to scrape.
     * @return {Array<Object>} scrapedResults - Objects with scraped data.
     */
    const scrapeResults = (links) => {
        console.log("scrapeResults(): Scraping %d results.", links.length)
        // Initialize index to keep track of keyword ranking.
        let index = 0
        // Initialize results array.
        let results = []

        // Use map to iterate over the links and scrape each one.
        results = links.map(link => {
            index++
            // Scrape a single result.
            return scrapeResult(link, index)
        })

        // If we got some results, return them.
        if ( results.length ) {
            return results
        }

        // No results, return an empty array.
        return []
    }

    /**
     * Scrapes a single result from Google Maps.
     *
     * @param {Element} link - The link to scrape.
     * @param {number} index - The index of the link (used for keyword ranking).
     *
     * @returns {Object} scrapeResult - An object with scraped data.
     */
    const scrapeResult = (link, index) => {
        // console.log("scrapeResult(): Scraping result #%d...", index)
        let container = link.closest('[jsaction*="mouseover:pane"]')

        if (!container) {
            return {}
        }

        let defaultScrapeResult = {
            title: '',
            companyUrl: '',
            phone: '',
            industry: '',
            address: '',
            rating: '0',
            reviewCount: '0',
            latitude: '',
            longitude: '',
            resultLink: '',
            placeId: '',
            keyword: '',
            keywordRanking: 0,
            testimonial: '',
            tags: '',
        }
        let scrapeResult = defaultScrapeResult
        let rating = '0'
        let reviewCount = '0'
        let phone = ''
        let industry = ''
        let address = ''
        let companyUrl = ''
        let tmpData = ''
        let resultLink = ''
        let containerText = container.textContent || ''
        let latitude = ''
        let longitude = ''
        let placeId = ''
        let tags = ''
        let testimonial = ''
        let isTestimonialRegex = /^".*"$/g
        let wheelchairAccess = '' // @TODO: grab '.google-symbols' items then iterate and grab 'aria-label' attributes.

        // Scrape index.
        if (index) {
            scrapeResult.keywordRanking = index
        }

        // Scrape keyword.
        if (mdm.searchTerm) {
            scrapeResult.keyword = mdm.searchTerm
        }

        // Google Place URL
        resultLink = container.getElementsByTagName('a') || []
        resultLink = (resultLink && resultLink.length > 0) ? resultLink[0].href : ''
        if (resultLink) {
            scrapeResult.resultLink = resultLink

            // Place ID.
            tmpData = resultLink.split('!19s')[1].split('?')[0] || ''
            if (tmpData) {
                scrapeResult.placeId = tmpData
            }

            // Latitude.
            latitude = resultLink.split('!3d')[1].split('!4d')[0] || ''
            if (latitude) {
                scrapeResult.latitude = latitude
            }

            // Longitude.
            longitude = resultLink.split('!4d')[1].split('!')[0] || ''
            if (longitude) {
                scrapeResult.longitude = longitude
            }
        }

        // Testimonials
        tmpData = container.querySelector('.fontBodySmall .fontBodyMedium')
        if (tmpData) {
            tmpData = tmpData.textContent.trim()
            let isTestimonial = tmpData.match(isTestimonialRegex)
            if (isTestimonial) {
                tmpData = tmpData.replaceAll('"', "")
                testimonial = tmpData
            }
        }

        // Tags
        tmpData = container.querySelector('.fontBodySmall .fontBodyMedium')
        if (tmpData) {
            let splitChar = '·'
            let tmpDataToMatch = tmpData.textContent.trim()
            let isTags = !tmpDataToMatch.match(isTestimonialRegex)
            if (isTags) {
                tags = extractTags(tmpData)
            }
        }

        // Title.
        tmpData = container.querySelector('.fontHeadlineSmall') || ''
        if (tmpData) {
            scrapeResult.title = tmpData.textContent || ''
        }

        // Rating and Reviews
        let roleImgContainer = container.querySelector('[role="img"]')
        if (roleImgContainer) {
            let ariaLabel = roleImgContainer.getAttribute('aria-label')

            if (ariaLabel && ariaLabel.includes("stars")) {
                let parts = ariaLabel.split(' ')
                rating = parts[0]
                reviewCount = parts[2]
            }
        }

        // Address.
        let addressRegex = /\d+ [\w\s]+(?:#\s*\d+|Suite\s*\d+|Apt\s*\d+)?/
        let filterRegex = /\b(Closed|Open 24 hours|24 hours)|Open|Closes soon\b/g
        let addressMatch = containerText.match(addressRegex)
        if (addressMatch) {
            address = addressMatch[0]

            // Clean up Address.
            address = address.replace(filterRegex, '').trim()
            address = address.replace(/(\d+)(Open)/g, '$1').trim()
            address = address.replace(/(\w)(Open)/g, '$1').trim()
            address = address.replace(/(\w)(Closed)/g, '$1').trim()
            address = address.replace(/(\w)(Closes soon)/g, '$1').trim()
        }

        // Industry.
        tmpData = container.querySelector('.fontBodyMedium')
        if (tmpData) {
            tmpData = tmpData.querySelectorAll(':scope > div')

            if (tmpData.length > 3) {
                tmpData = tmpData[3].querySelectorAll(':scope > div')

                if (tmpData.length > 0) {
                    tmpData = tmpData[0].querySelectorAll(':scope > span')

                    if (tmpData.length > 0) {
                        industry = tmpData[0].textContent.trim()
                    }
                }
            }
        }
        // tmpData = tmpData.querySelectorAll(':scope > div')
        // tmpData = tmpData[3].querySelectorAll(':scope > div')
        // tmpData = tmpData[0].querySelectorAll(':scope > span')
        // industry = tmpData[0].textContent.trim()

        // Company URL
        let filteredLinks = []
        let resultLinkElements = Array.from(container.querySelectorAll('a[href]'))
        filteredLinks = resultLinkElements.filter(a => !a.href.startsWith("https://www.google.com/maps/place"))
        filteredLinks = filteredLinks.filter(a => !a.href.startsWith("https://www.google.ca/maps/place"))
        if (filteredLinks.length > 0) {
            companyUrl = filteredLinks[0].href
            scrapeResult.companyUrl = companyUrl
        }

        // Phone Numbers
        containerText = container.textContent || ''
        let phoneRegex = /(\+\d{1,2}\s)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/
        let phoneMatch = containerText.match(phoneRegex)
        phone = phoneMatch ? phoneMatch[0] : ''

        // If we have an address, scrape it.
        if (address) {
            scrapeResult.address = address
        }
        scrapeResult.phone = phone
        scrapeResult.reviewCount = reviewCount
        scrapeResult.rating = rating
        scrapeResult.industry = industry
        scrapeResult.testimonial = testimonial
        scrapeResult.tags = tags

        return scrapeResult
    }

    /**
     * Scrapes the search term from the page and updates `mdm.searchTerm`.
     *
     * @return {Object} The updated `mdm` object.
     */
    const scrapeGlobals = () => {
        let tmpData

        console.log("scrapeGlobals(): Scraping globals")
        tmpData = document.getElementsByClassName('searchboxinput')
        if (tmpData && tmpData.length > 0) {
            mdm.searchTerm = tmpData[0].value.trim() || ''
        }

        return mdm
    }

    /**
     * Adds a MutationObserver to the body to detect when the "You've reached the end of the list." element is added
     * to the page. This is used to detect when all the results have been loaded.
     */
    const addEventListeners = () => {
        observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType !== 1) {
                        return
                    }

                    // Check the node itself
                    if (node.classList.contains("fontBodyMedium")) {
                        checkForExhaustedResults(node)
                    }

                    // Check any matching descendants
                    node.querySelectorAll?.(".fontBodyMedium").forEach(child => {
                        checkForExhaustedResults(child)
                    })
                })
            })
        })
        console.log("addEventListeners(): Adding body observer.")
        observer.observe(document.body, { childList: true, subtree: true })
    }

    const checkForExhaustedResults = (el) => {
        const text = el.textContent.trim()
        if (text.includes("You've reached the end of the list.")) {
            console.log("Encountered end of page.")
            let scrapeTmp = scrapeData()
            syncPopupData( scrapeTmp )
            observer.disconnect()
        }
    }

    const syncPopupData = async ( data ) => {
        console.log( "syncPopupData(): Syncing data with popup.")
        const args = {
            action: 'syncScrapeData',
            results: data
        }
        chrome.runtime.sendMessage(args, (response) => {
            console.dir("syncPopupData():", response);
        });
        return true
    }

    const domLoadHandler = () => {
        addEventListeners()
    }
    /**
     * Initializes the scraper by adding a MutationObserver to the body and
     * displaying the Maps Data Miner banner.
     */
    const init = () => {
        // Banner.
        console.log("==[ 🗺️ Maps Data Miner by Client Coffee ]==")
        console.log("@clientcoffee | https://clientcoffee.com")

        // Add Event Listeners.
        document.addEventListener("DOMContentLoaded", () => {
            domLoadHandler()
        });
    }

    init()
})();
