const fs = require('node:fs');
const path = require('node:path');
const fetch = require("node-fetch");
/*const OpenAI = require('openai');
const openai = new OpenAI({
    apiKey: '##############################',
});*/

const CHUNK_SIZE = 50;

const CONFIGURATION = {
    'atlas.en-us.automotive_cloud.meta': {
        label: 'Automotive Cloud'
    },
    'atlas.en-us.retail_api.meta': {
        label: 'Consumer Goods Cloud'
    },
    'atlas.en-us.object_reference.meta': {
        label: 'Core Salesforce'
    },
    'atlas.en-us.c360a_api.meta': {
        label: 'Data Cloud'
    },
    'atlas.en-us.edu_cloud_dev_guide.meta': {
        label: 'Education Cloud'
    },
    'atlas.en-us.eu_developer_guide.meta': {
        label: 'Energy and Utilities Cloud'
    },
    'atlas.en-us.salesforce_feedback_management_dev_guide.meta': {
        label: 'Feedback Management'
    },
    'atlas.en-us.field_service_dev.meta': {
        label: 'Field Service Lightning'
    },
    'atlas.en-us.financial_services_cloud_object_reference.meta': {
        label: 'Financial Service Cloud'
    },
    'atlas.en-us.health_cloud_object_reference.meta': {
        label: 'Health Cloud'
    },
    'atlas.en-us.loyalty.meta': {
        label: 'Loyalty'
    },
    'atlas.en-us.mfg_api_devguide.meta': {
        label: 'Manufacturing Cloud'
    },
    'atlas.en-us.netzero_cloud_dev_guide.meta': {
        label: 'Net Zero Cloud'
    },
    'atlas.en-us.nonprofit_cloud.meta': {
        label: 'Non profit Cloud'
    },
    'atlas.en-us.psc_api.meta': {
        label: 'Public Sector Cloud'
    },
    'atlas.en-us.salesforce_scheduler_developer_guide.meta': {
        label: 'Scheduler'
    }
}

const version = '252.0'
const documentMapping = {};

function removeDuplicates(arr, prop) {
    const unique = new Set();
    const result = arr.filter((item) => {
        const val = item[prop];
        const isPresent = unique.has(val);
        unique.add(val);//always add
        return !isPresent;
    });
    return result;
}

fetchDocuments = async () => {

    //console.log('fetchDocuments',this.cloud_value);
    for (const item of Object.keys(CONFIGURATION)) {
        await fetchDocuments_single(item);
    }
    // group items
    var items = Object.keys(documentMapping)
    .reduce((acc,documentationId) => acc.concat(documentMapping[documentationId].items.map(x => ({...x,documentationId}))),[]);
    
    loadAllDocuments(items);
    // Separate files (openai)
    //loadAllDocumentAsSeparateFile(items);
}

fetchDocuments_single = async (documentationId) => {
    //console.log('fetchDocuments_single',documentationId);
    
    let result = await (await fetch(`https://developer.salesforce.com/docs/get_document/${documentationId}`)).json();
    //console.log(documentationId,result);
    var items = removeDuplicates(extraDataFromJson(documentationId,result.toc,[]),'id')
    .sort((a, b) => (a.text || '').localeCompare(b.text));
    documentMapping[documentationId] = {
        items:items,
        header:result
    }
}

extraDataFromJson = (documentationId,items,result) => {
    for(var x of (items || [])){
        const itemId = x.id || '';
        if(x.children){
            result = result.concat(extraDataFromJson(documentationId,x.children,[]));
        }else{
            if((itemId).startsWith('sforce_api_objects_') || (itemId).startsWith('c360dm_')){
                result.push(x)
            }
        }
    }
    return result;
}

fetchContentDocument = async (documentationId,url) => {
    try{
        const header = documentMapping[documentationId].header;
        const res = await (await fetch(`https://developer.salesforce.com/docs/get_document_content/${header.deliverable}/${url}/en-us/${header.version.doc_version}`)).json();
        return {...res,documentationId};
    }catch(e){
        return {};
    }
    
}

 // Helper function to chunk the URL list
 const chunkList = (list, size) => {
    const chunks = [];
    for (let i = 0; i < list.length; i += size) {
        chunks.push(list.slice(i, i + size));
    }
    return chunks;
};

loadAllDocuments = async (items) => {

    // Chunk the URLs
    const itemChunks = chunkList(items.map(x => ({url:x.a_attr.href,...x})), CHUNK_SIZE);
    let finalResult = [];
    // Process each chunk
    for (const chunk of itemChunks) {
        const promises = chunk.map(x => fetchContentDocument(x.documentationId,x.url));
        const results = await Promise.all(promises);
        finalResult = [].concat(finalResult,results);
        //console.log(items.length +' / '+finalResult.length);
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

loadAllDocumentAsSeparateFile = async (items) => {

    // Chunk the URLs
    //const itemChunks = chunkList(items.map(x => ({url:x.a_attr.href,...x})), CHUNK_SIZE);
    /*const vectorStore = await openai.beta.vectorStores.create({
        name: "Salesforce Toolkit - Store"
    });*/
    // Process each items
    const results = [];
    for await (const x of items.map(x => ({url:x.a_attr.href,...x}))) {
        const fileName = `./src/documentation/${version}/${x.url}.json`;
        const fileExist = fs.existsSync(fileName);
        if(!fileExist){
            const data = await fetchContentDocument(x.documentationId,x.url);
            if(data.content){
                data.content = data.content.replaceAll('\n','').replaceAll('\"','').replaceAll('\t','');
                fs.writeFileSync(fileName,JSON.stringify(data), 'utf-8');
            }
        }
        //console.log('fileExist',fileExist)
        if(!fs.existsSync(fileName)) return; // Double check as the content can be empty

        /*const file = await openai.files.create({
            file: fs.createReadStream(fileName),
            purpose: "assistants",
        });
        //console.log('file',file);
        results.push(file);*/
    }
    //console.log('results',results);
    /*const fileChunks = chunkList(results, 500);
    for await (const chunk of fileChunks) {
        const myVectorStoreFileBatch = await openai.beta.vectorStores.fileBatches.create(vectorStore.id,{file_ids: chunk.map(x => x.id)});
        
        //console.log('myVectorStoreFileBatch',myVectorStoreFileBatch);
    }*/
    
    /*const myUpdatedAssistant = await openai.beta.assistants.update(
        "asst_RpwCiurQtkfHYcO8IVeFBuIE",
        {
          tools: [{ type: "file_search" }],
          tool_resources:{

          }
        }
    );*/
}

fetchFilesAndAttachToVector = async () => {
    const list = await openai.files.list();
    //console.log('Files to delete',list.data.length)
    const fileChunks = chunkList(list.data, 5);

    //let finalResult = [];
    let counter = 0;
    for await (const chunk of fileChunks) {
        const promises = chunk.map(file => openai.files.del(file.id));
        const results = await Promise.all(promises);
        //finalResult = [].concat(finalResult,results);
        counter += results.length;
        //console.log(`Proccessed : ${counter}/${list.data.length}`);
    }
}
//fetchFilesAndAttachToVector();
fetchDocuments();