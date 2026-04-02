const jsforce = require('jsforce');
const fs = require('fs');

// Connection configuration
const conn = new jsforce.Connection({
    instanceUrl: 'https://storm-454b5500dfa9a9.my.salesforce.com',
    sessionId: '00DHr0000074EN7!ARYAQE6k3Q8dJ2DU0xO6mwbFB62bpP7Gdb8gPwr_S7LRCF9q6Yu3LV8YoWADHUQa4ItaFdXYdDT0UYSaLKKULrR8w6TBy6zB'
});

async function fetchObjectsAndFields() {
    try {        
        const globalDescribe = await conn.describeGlobal();
        const results = [];
        // Filter out unwanted objects
        const sobjectNames = globalDescribe.sobjects
            .filter(sobject => sobject.queryable)
            .filter(sobject => !sobject.name.endsWith('__Share') && 
                              !sobject.name.endsWith('__History') && 
                              !sobject.name.endsWith('__Feed'))
            .map(sobject => sobject.name);
        
        // Fetch object descriptions in batches of 5
        for (let i = 0; i < sobjectNames.length; i += 5) {
            const batch = sobjectNames.slice(i, i + 5);
            const objectDescribeResults = await conn.metadata.read('CustomObject', batch);

            objectDescribeResults
            .filter(objectDescribe => objectDescribe.fields.length > 0)
            .forEach(objectDescribe => {
                results.push({
                    name: objectDescribe.label || objectDescribe.fullName,
                    apiName: objectDescribe.fullName,
                    description: objectDescribe.description || '',
                    fields: objectDescribe.fields.map(field => ({
                        name: field.fullName,
                        apiName: field.fullName,
                        description: field.description || field.inlineHelpText || '',
                        type: field.type
                    }))
                });
            });
        }

        // Write results to file
        fs.writeFileSync('salesforce-metadata.json', JSON.stringify(results, null, 2));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await conn.logout();
    }
}

// Execute the function
fetchObjectsAndFields();