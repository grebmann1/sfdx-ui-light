//import JSZip from 'jszip';
// Helper function to escape XML special characters
function escapeXml(unsafe) {
    return unsafe.replace(/[<>&'"]/g, function (c) {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
        }
    });
}

// Function to generate the package.xml file
function generatePackageXml(zip) {
    const content = `<?xml version="1.0" encoding="UTF-8"?>
        <Package xmlns="http://soap.sforce.com/2006/04/metadata">
            <types>
                <members>*</members>
                <name>ApexClass</name>
            </types>
            <types>
                <members>*</members>
                <name>Bot</name>
            </types>
            <types>
                <members>*</members>
                <name>BotVersion</name>
            </types>
            <types>
                <members>*</members>
                <name>GenAiFunction</name>
            </types>
            <types>
                <members>*</members>
                <name>GenAiPlanner</name>
            </types>
            <types>
                <members>*</members>
                <name>GenAiPlugin</name>
            </types>
            <types>
                <members>*</members>
                <name>RemoteSiteSetting</name>
            </types>
            <types>
                <members>*</members>
                <name>DigitalExperienceBundle</name>
            </types>
            <version>61.0</version>
        </Package>
    `;
    zip.file("package.xml", content);
}

// Function to generate an Apex class
function generateApexClass(zip, apexClassName, apexClassContent) {
    const classesFolder = zip.folder("classes");
    classesFolder.file(`${apexClassName}.cls`, apexClassContent);
    classesFolder.file(`${apexClassName}.cls-meta.xml`, `<?xml version="1.0" encoding="UTF-8"?>
        <ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">
            <apiVersion>61.0</apiVersion>
            <status>Active</status>
        </ApexClass>
    `);
}

// Function to generate AI plugins
function generateAiPlugins(zip, topics, botname = 'dreamforce24', botlabel = 'dreamforce24', botdescription = 'Dreamforce 24', botversion = 'v1') {
    const plannerFolder = zip.folder("genAiPlanners");
    let genAiPlugins = '';
    topics.forEach(topic => {
        genAiPlugins += `    
            <genAiPlugins>
                <genAiPluginName>${escapeXml(topic)}</genAiPluginName>
            </genAiPlugins>
        `;
    });

    const content = `
        <?xml version="1.0" encoding="UTF-8"?>
        <GenAiPlanner xmlns="http://soap.sforce.com/2006/04/metadata">
            <description>${escapeXml(botdescription)}</description>
        ${genAiPlugins}
            <masterLabel>${escapeXml(botlabel)}</masterLabel>
            <plannerType>AiCopilot__ReAct</plannerType>
        </GenAiPlanner>
    `;
    plannerFolder.file(`${botname}_${botversion}.genAiPlanner`, content);
}

// Function to generate the bot definition
function generateBotsDefinition(zip, templateData, botname, companyName, siteUrl, botUsername, botDescription, sampleUtterances, locale = 'en') {
    let botDefinition = templateData['bots/dreamforce24.bot'];

    let botUserXml = '';
    if (botUsername) {
        botUserXml = `<botUser>${escapeXml(botUsername)}</botUser>`;
    }

    botDefinition = botDefinition.replace("AGENTFORCE_USER_NAME", botUserXml);
    botDefinition = botDefinition.replace("AGENTFORCE_BOT_NAME", escapeXml(botname));
    botDefinition = botDefinition.replace("AGENTFORCE_DESCRIPTION", escapeXml(botDescription));

    let welcomeMessage = `Hello! I'm your AGENTFORCE_COMPANY_NAME Agentforce Service Agent. What you're about to experience is a prototype designed to showcase the immense potential of Agentforce. While most of the actions use mock data for demonstration purposes, this prototype can also answer questions directly from AGENTFORCE_COMPANY_WEBSITE .
        Feel free to ask questions such as:
        - AGENTFORCE_SAMPLE_UTTERANCES
        - "What are you able to help me with?"
        `;

    if (locale === "ja-JP" || locale === "ja") {
        welcomeMessage = `こんにちは！私はAGENTFORCE_COMPANY_NAMEのAgentforceサービスエージェントです。このプロトタイプは、Agentforceの可能性を体感していただくために作られたもので、一部デモ用のデータを使用していますが、AGENTFORCE_COMPANY_WEBSITE からの質問には直接お答えすることもできます。
            以下のような質問をお気軽にお尋ねください：
            - AGENTFORCE_SAMPLE_UTTERANCES
            - "あなたは私にどのようなことを手伝ってくれますか？"
            `;
    }

    welcomeMessage = welcomeMessage.replace("AGENTFORCE_COMPANY_NAME", companyName);
    welcomeMessage = welcomeMessage.replace("AGENTFORCE_COMPANY_WEBSITE", siteUrl);
    welcomeMessage = welcomeMessage.replace("AGENTFORCE_SAMPLE_UTTERANCES", sampleUtterances);

    botDefinition = botDefinition.replace("AGENTFORCE_WELCOME_MESSAGE", escapeXml(welcomeMessage));

    const botsFolder = zip.folder("bots");
    botsFolder.file(`${botname}.bot`, botDefinition);
}

// Function to generate knowledge topics
function generateKnowledgeTopics(zip, templateData, companyName, botDescription, knowledgeMode = 'search', locale = 'en') {
    let knowledgeTopic = templateData['genAiPlugins/General_FAQs.genAiPlugin'];
    knowledgeTopic = knowledgeTopic.replace("AGENTFORCE_COMPANY_NAME", escapeXml(companyName));

    if (knowledgeMode === 'DC') {
        knowledgeTopic = knowledgeTopic.replace("AGENTFORCE_KNOWLEDGE_ACTION_NAME", 'QueryDataCloud');
    } else {
        knowledgeTopic = knowledgeTopic.replace("AGENTFORCE_KNOWLEDGE_ACTION_NAME", 'AnswerQuestionsWithKnowledge');
    }

    const topicsFolder = zip.folder("genAiPlugins");
    topicsFolder.file("General_FAQs.genAiPlugin", knowledgeTopic);

    const functionName = knowledgeMode === 'DC' ? 'QueryDataCloud' : 'AnswerQuestionsWithKnowledge';
    const functionFolder = zip.folder(`genAiFunctions/${functionName}`);
    functionFolder.file(`${functionName}.genAiFunction-meta.xml`, templateData[`genAiFunctions/${functionName}.genAiFunction-meta.xml`]);
    functionFolder.file(`input/schema.json`, templateData[`genAiFunctions/${functionName}/input/schema.json`]);
    functionFolder.file(`output/schema.json`, templateData[`genAiFunctions/${functionName}/output/schema.json`]);

    let globalInstructionTopic = templateData['genAiPlugins/Global_Instructions.genAiPlugin'];
    globalInstructionTopic = globalInstructionTopic.replace("AGENTFORCE_DESCRIPTION", escapeXml(botDescription));

    let languageInstruction = "";
    if (locale === "ja-JP" || locale === "ja") {
        languageInstruction = `<genAiPluginInstructions>
                <description>Always return all responses in Japanese</description>
                <developerName>Instruction4</developerName>
                <language xsi:nil="true"/>
                <masterLabel>Instruction 4</masterLabel>
            </genAiPluginInstructions>
        `;
    } else if (locale === "fr-FR" || locale === "fr") {
        languageInstruction = `<genAiPluginInstructions>
                <description>Always return all responses in French. Never respond in English.</description>
                <developerName>Instruction4</developerName>
                <language xsi:nil="true"/>
                <masterLabel>Instruction 4</masterLabel>
            </genAiPluginInstructions>
        `;
    }

    globalInstructionTopic = globalInstructionTopic.replace("AGENTFORCE_LANGUAGE_SETTINGS", languageInstruction);
    topicsFolder.file("Global_Instructions.genAiPlugin", globalInstructionTopic);
}

// Helper function to convert label to developer name
function labelToDeveloperName(label) {
    let developerName = label.replace(/[\s-]/g, '_').replace(/&/g, 'and');
    developerName = developerName.replace(/[^A-Za-z0-9_]/g, '');
    if (!developerName || !/^[A-Za-z]/.test(developerName)) {
        developerName = 'A' + developerName;
    }
    developerName = developerName.replace(/_+$/, '');
    const maxLength = 250;
    if (developerName.length > maxLength) {
        developerName = developerName.substring(0, maxLength);
    }
    return developerName;
}

// Main function to generate Salesforce metadata
function generateSalesforceMetadata(jsonData, zip, templateData, atlasApiKey, siteUrl, companyName, botname = 'dreamforce24', botUsername = null, mockMode = 'llm_and_planner', knowledgeMode = 'search', addKnowledgeAction = true, locale = 'en') {
    // Common setup
    generatePackageXml(zip);

    // Generate Apex classes
    // QueryEchoAction
    generateApexClass(zip, 'QueryEchoAction', templateData['classes/QueryEchoAction.cls']);

    // AtlasRAG
    let atlasRagContent = templateData['classes/AtlasRAG.cls']
        .replace("<atlas_api_key>", atlasApiKey)
        .replace("<brave_api_key>", '')
        .replace("<site_url>", siteUrl);
    generateApexClass(zip, 'AtlasRAG', atlasRagContent);

    // LLMMockedAction
    let llmMockedActionContent = templateData['classes/LLMMockedAction.cls']
        .replace("AGENTFORCE_COMPANY_NAME", companyName);
    generateApexClass(zip, 'LLMMockedAction', llmMockedActionContent);

    // EmailSender
    let emailSenderContent = templateData['classes/EmailSender.cls'];
    const emailTemplateFile = locale === 'ja-JP' || locale === 'ja' ? 'classes/Email-Japanese.html' : 'classes/Email-English.html';
    const emailTemplate = templateData[emailTemplateFile];
    emailSenderContent = emailSenderContent.replace("<email_template>", emailTemplate);
    generateApexClass(zip, 'EmailSender', emailSenderContent);

    // QueryDataCloud
    let queryDataCloudContent = templateData['classes/QueryDataCloud.cls']
        .replace("Company_Site", siteUrl);
    generateApexClass(zip, 'QueryDataCloud', queryDataCloudContent);

    // Process topics
    const topics = [];
    const botDescription = jsonData['AI_Agent_Description'] || jsonData['description'] || jsonData['AgentDescription'] || 'Dreamforce 24';
    const sampleUtterancesArray = jsonData['Sample_Utterances'] || jsonData['sample_utterances'] || jsonData['SampleUtterances'] || ['What is Salesforce Agentforce?'];
    const sampleUtterances = '"' + sampleUtterancesArray.join('"\n- "') + '"';

    let inputTopics = jsonData['items'] || jsonData['topics'] || jsonData['Topics'];
    if (!Array.isArray(inputTopics) && (inputTopics['Topics'] || inputTopics['topics'])) {
        inputTopics = inputTopics['Topics'] || inputTopics['topics'];
    }

    inputTopics.forEach(topicData => {
        const randomNumber = Math.floor(1000 + Math.random() * 9000);
        let topicName = topicData['Topic'] || topicData['topic'];
        topicName = labelToDeveloperName(topicName) + '_' + randomNumber;
        topics.push(topicName);

        // Create GenAiPlugin
        let genAiPluginXml = `
            <?xml version="1.0" encoding="UTF-8"?>
            <GenAiPlugin xmlns="http://soap.sforce.com/2006/04/metadata" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
                <description>${escapeXml(topicData['ClassificationDescription'])}</description>
                <developerName>${escapeXml(topicName)}</developerName>
                <language>en_US</language>
                <masterLabel>${escapeXml(topicData['Topic'] || topicData['topic'])}</masterLabel>
                <pluginType>Topic</pluginType>
                <scope>${escapeXml(topicData['Scope'] || topicData['scope'])}</scope>
        `;
        topicData['Actions'].forEach(action => {
            let functionName = labelToDeveloperName(action['action_name']) + '_' + randomNumber;
            genAiPluginXml += `<genAiFunctions><functionName>${escapeXml(functionName)}</functionName></genAiFunctions>`;
        });

        // Add knowledge action if required
        if (addKnowledgeAction && !topicName.toLowerCase().includes('escalation')) {
            const knowledgeActionName = knowledgeMode === 'DC' ? 'QueryDataCloud' : 'AnswerQuestionsWithKnowledge';
            genAiPluginXml += `<genAiFunctions><functionName>${knowledgeActionName}</functionName></genAiFunctions>`;
        }

        topicData['Instructions'].forEach((instruction, index) => {
            genAiPluginXml += `
                <genAiPluginInstructions>
                    <description>${escapeXml(instruction)}</description>
                    <developerName>Instruction${index + 1}</developerName>
                    <language xsi:nil="true"/>
                    <masterLabel>Instruction ${index + 1}</masterLabel>
                </genAiPluginInstructions>
            `;
        });

        genAiPluginXml += '</GenAiPlugin>';

        // Add to ZIP
        const pluginFolder = zip.folder("genAiPlugins");
        pluginFolder.file(`${topicName}.genAiPlugin`, genAiPluginXml);

        // Create GenAiFunctions
        topicData['Actions'].forEach(action => {
            let functionName = labelToDeveloperName(action['action_name']) + '_' + randomNumber;
            const functionDesc = action['action_description'] || functionName;
            const functionInputParams = action['inputs'];
            const functionOutputParams = action['example_output'];

            const functionDir = `genAiFunctions/${functionName}`;
            const functionFolder = zip.folder(functionDir);
            const mockedActionName = mockMode === 'echo' ? 'QueryEchoAction' : 'LLMMockedAction';

            const genAiFunctionXml = `
            <?xml version="1.0" encoding="UTF-8"?>
            <GenAiFunction xmlns="http://soap.sforce.com/2006/04/metadata">
                <description>${escapeXml(functionDesc)}</description>
                <invocationTarget>${escapeXml(mockedActionName)}</invocationTarget>
                <invocationTargetType>apex</invocationTargetType>
                <isConfirmationRequired>false</isConfirmationRequired>
                <masterLabel>${escapeXml(functionName)}</masterLabel>
            </GenAiFunction>
            `;
            functionFolder.file(`${functionName}.genAiFunction-meta.xml`, genAiFunctionXml);

            const sampleResponseDescription = `Return the sample_output based on the query to this parameter. sample_output: \n${functionOutputParams}\n\nIMPORTANT: generate a string as input.`;

            // Create input schema
            const inputSchema = {
                "$schema": "https://cms.salesforce.com/types/lightning__copilotActionInput",
                "$ref": "sfdc:propertyType/lightning__objectType",
                "required": ["query", "sample_response"],
                "unevaluatedProperties": false,
                "properties": {
                    "query": {
                        "title": "query",
                        "description": `JSON string containing the following attributes: \n${functionInputParams}\n\nIMPORTANT: generate a string as input.`,
                        "lightning:type": "lightning__textType",
                        "$ref": "sfdc:propertyType/lightning__textType",
                        "lightning:isPII": false,
                        "copilotAction:isUserInput": false
                    },
                    "sample_response": {
                        "title": "sample response",
                        "description": sampleResponseDescription,
                        "lightning:type": "lightning__textType",
                        "$ref": "sfdc:propertyType/lightning__textType",
                        "lightning:isPII": false,
                        "copilotAction:isUserInput": false
                    }
                },
                "lightning:type": "lightning__objectType"
            };
            functionFolder.folder("input").file("schema.json", JSON.stringify(inputSchema, null, 4));

            // Create output schema
            const outputSchema = {
                "$schema": "https://cms.salesforce.com/types/lightning__copilotActionOutput",
                "$ref": "sfdc:propertyType/lightning__objectType",
                "unevaluatedProperties": false,
                "properties": {
                    "generatedOutput": {
                        "title": "generatedOutput",
                        "description": `Output of ${functionName}.`,
                        "lightning:type": "lightning__textType",
                        "$ref": "sfdc:propertyType/lightning__textType",
                        "lightning:isPII": false,
                        "copilotAction:isDisplayable": true,
                        "copilotAction:isUsedByPlanner": true
                    }
                },
                "lightning:type": "lightning__objectType"
            };
            functionFolder.folder("output").file("schema.json", JSON.stringify(outputSchema, null, 4));
        });
    });

    // Generate AI plugins
    if (addKnowledgeAction) {
        topics.push('General_FAQs');
        topics.push('Global_Instructions');
    }
    generateAiPlugins(zip, topics, botname, botname);

    // Generate knowledge topics
    if (addKnowledgeAction) {
        generateKnowledgeTopics(zip, templateData, companyName, botDescription, knowledgeMode, locale);
    }

    // Generate bot definition
    generateBotsDefinition(zip, templateData, botname, companyName, siteUrl, botUsername, botDescription, sampleUtterances, locale);

    // Copy RemoteSiteSettings
    const remoteSiteSettingsFolder = zip.folder("remoteSiteSettings");
    Object.keys(templateData).forEach(filePath => {
        if (filePath.startsWith('remoteSiteSettings/')) {
            remoteSiteSettingsFolder.file(filePath.replace('remoteSiteSettings/', ''), templateData[filePath]);
        }
    });
}

// Function to initiate the process
export async function createSalesforceZip({jsonData, atlasApiKey, siteUrl, companyName, templateData}) {
    const zip = new JSZip();
    generateSalesforceMetadata(jsonData, zip, templateData, atlasApiKey, siteUrl, companyName);

    // Generate the ZIP file and trigger download
    const content = await zip.generateAsync({ type: "blob" });
    return content;
}


