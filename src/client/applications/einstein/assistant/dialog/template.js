const generateItems = (variableName,content,role) => {
    return `aiplatform.ModelsAPI_ChatMessageRequest ${variableName} = new aiplatform.ModelsAPI_ChatMessageRequest();
        ${variableName}.content = '${escapeApexString(content)}';
        ${variableName}.role = '${role}';
        messagesList.add(${variableName});
    `;
}

const escapeApexString = (input) => {
    return input.replace(/'/g, "\\'").replace(/\n/g, "\\n");
}

export const chat_template = modelmessages) => {
    return `aiplatform.ModelsAPI.createChatGenerations_Request request = new aiplatform.ModelsAPI.createChatGenerations_Request();
        // Specify model
        request.modelName = '${model}';
        // Create request body
        aiplatform.ModelsAPI_ChatGenerationsRequest body = new aiplatform.ModelsAPI_ChatGenerationsRequest();
        request.body = body;
        // Add chat messages to body
        List <aiplatform.ModelsAPI_ChatMessageRequest> messagesList = new List <aiplatform.ModelsAPI_ChatMessageRequest> ();
        ${messages.map((x,index) => generateItems(`item_${index}`,x.content,x.role)).join('')}
        body.messages = messagesList;
        aiplatform.ModelsAPI modelsAPI = new aiplatform.ModelsAPI();
        aiplatform.ModelsAPI.createChatGenerations_Response response = modelsAPI.createChatGenerations(request);
        for(aiplatform.ModelsAPI_ChatMessage message : response.Code200.generationDetails.generations) {
            system.debug('START_EINSTEIN_TOOLKIT'+message.id+'###'+message.role+'###'+message.content+'END_EINSTEIN_TOOLKIT');
        }
    `;
}