import jsforce from 'jsforce';

let conn;
let cache = {}; // Cache for storing metadata

const MAX_CONCURRENT_REQUESTS = 5; // Maximum parallel requests
let activeRequests = 0; // Count of currently active requests
let requestQueue = []; // Queue to hold pending requests

// Establish a jsforce connection
const initializeConnection = (params) => {
    console.log('Worker - initializeConnection');
    conn = new jsforce.Connection(params);
};

// Function to fetch metadata for a specific SObject
const fetchSObjectMetadata = async (sobject) => {
    try {
        const metadata = await conn.sobject(sobject.name).describe();
        cache[sobject.name] = {
            label: sobject.label,
            keyPrefix: sobject.keyPrefix,
            custom: sobject.custom,
            fields: metadata.fields,
            recordTypeInfos: metadata.recordTypeInfos,
            childRelationships: metadata.childRelationships,
        };
        console.log(sobject.name,cache[sobject.name]);
    } catch (error) {
        console.error(`Failed to fetch metadata for ${sobject.name}:`, error);
    }
};

// Function to process the next request in the queue
const processQueue = () => {
    if (requestQueue.length === 0 || activeRequests >= MAX_CONCURRENT_REQUESTS) {
        return;
    }

    // Dequeue the next request and execute it
    const sobject = requestQueue.shift();
    activeRequests++;
    
    fetchSObjectMetadata(sobject)
    .then(() => {
        activeRequests--;
        processQueue(); // Process the next request in the queue when done
    })
    .catch(() => {
        activeRequests--;
        processQueue(); // Continue processing even if an error occurs
    });
};

// Load a full set of metadata for all specified types and store it in the cache
const loadFullMetadataSet = async () => {
    try {
        // Fetch SObjects metadata overview
        const sobjectMetadata = await conn.describeGlobal();
        const sobjectToFetch = sobjectMetadata.sobjects
            .filter(sobj => sobj.associateEntityType === null)
            .map((sobj) => ({
                name: sobj.name,
                label: sobj.label,
                keyPrefix: sobj.keyPrefix,
                custom: sobj.custom,
            }));

        console.log('sobjectToFetch:', sobjectToFetch);

        // Enqueue all SObject fetch requests
        requestQueue = [...sobjectToFetch];
        
        // Start processing the queue with max concurrent requests
        for (let i = 0; i < MAX_CONCURRENT_REQUESTS; i++) {
            processQueue();
        }

        // Wait for all requests to complete before sending the result
        await Promise.all(requestQueue.map(() => new Promise((resolve) => {
            const interval = setInterval(() => {
                if (activeRequests === 0 && requestQueue.length === 0) {
                    clearInterval(interval);
                    resolve();
                }
            }, 100);
        })));

        // Send cached metadata back to main thread
        postMessage({ type: 'result', action: 'loadFullMetadataSet', result: cache });
    } catch (error) {
        postMessage({ type: 'error', message: error.message });
    }
};

// Handle incoming messages
onmessage = async (event) => {
    console.log('Worker received message');
    const { action, connectionParams } = event.data;

    if (action === 'init') {
        initializeConnection(connectionParams);
    } else if (action === 'loadFullMetadataSet') {
        await loadFullMetadataSet();
    } else {
        postMessage({ type: 'error', message: `Unknown action: ${action}` });
    }
};
