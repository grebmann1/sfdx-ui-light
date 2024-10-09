const generateItems = (variableName,content,role) => {
    return `aiplatform.ModelsAPI_ChatMessageRequest ${variableName} = new aiplatform.ModelsAPI_ChatMessageRequest();
        ${variableName}.content = '${role === 'user' ? instructionFormatted()+'\\n """'+escapeApexString(content)+'"""':escapeApexString(content)}';
        ${variableName}.role = '${role}';
        messagesList.add(${variableName});
    `;
}

const instructionFormatted = () => {
    const instructions = [
        'Follow these instructions:',
        'Process the user request taking the following points into consideration:',
        '- Try to be precise,technical and provide details in your answer.',
        '- Whenever it make sense to provide multiple solution, include multiple solution.',
        '- If the user is asking for a Diagram, return a valid Mermaid Diagram. Avoid using characters that might break the mermaid renderer. Always use the best type of mermaid diagram based on the context.',
        '- If you need more information from the user, ask the user to provide you more specific informations.',
        'This is the User Request:'
    ];
    return instructions.join('\\n');
    /*return `aiplatform.ModelsAPI_ChatMessageRequest initial = new aiplatform.ModelsAPI_ChatMessageRequest();
        initial.content = '${instructions.join('\\n')}';
        initial.role = 'user';
        messagesList.add(initial);
    `;*/
}

const escapeApexString = (input) => {
    if(!input) return '';
    return input.replace(/'/g, "\\'").replace(/\\\//g, "//").replace(/\n/g, "\\n");
}

export const separator_token = '###5ZCAyq262PAg5hI###';

export const chat_template = (model,messages) => {
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
            system.debug('START_EINSTEIN_TOOLKIT'+message.id+'${separator_token}'+message.role+'${separator_token}'+message.content+'END_EINSTEIN_TOOLKIT');
        }
    `;
}