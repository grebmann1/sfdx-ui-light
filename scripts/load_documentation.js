const fs = require('node:fs');
const path = require('node:path');
const fetch = require("node-fetch");

const documentationId = 'atlas.en-us.object_reference.meta';
const version = '246.0'

fetchDocument = async () => {
    let items;
    let result = await (await fetch(`https://developer.salesforce.com/docs/get_document/${documentationId}`)).json();
        result.toc.forEach(x => {
            x.children.forEach(y => {
                if( y.id === "sforce_api_objects_list"){
                    items = y.children
                }
            })
        });

    loadAllDocuments(items);
}

fetchContentDocument = async (contentDocumentId) => {
    try{
        return await (await fetch(`https://developer.salesforce.com/docs/get_document_content/object_reference/${contentDocumentId}/en-us/${version}`)).json();
    }catch(e){
        return {};
    }
}

loadAllDocuments = async (items) => {
    // Helper function to chunk the URL list
    const chunkList = (list, size) => {
        const chunks = [];
        for (let i = 0; i < list.length; i += size) {
            chunks.push(list.slice(i, i + size));
        }
        return chunks;
    };

    // Chunk the URLs
    const itemChunks = chunkList(items.map(x => x.a_attr.href), 15);
    let finalResult = [];
    // Process each chunk
    for (const chunk of itemChunks) {
        const promises = chunk.map(name => fetchContentDocument(name));
        const results = await Promise.all(promises);
        finalResult = [].concat(finalResult,results);
        console.log(items.length +' / '+finalResult.length);
    }

    //const actual = fs.readFileSync(filePath, 'utf-8');
    const pathFile = `./src/documentation/${version}.json`;
    const formattedData = {
        contents : finalResult,
        version,
        type:'sobject'
    }
    fs.writeFileSync(pathFile,JSON.stringify(formattedData), 'utf-8');
}

fetchDocument();