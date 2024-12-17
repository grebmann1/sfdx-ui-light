export * as FUNCTIONS from './fonctions';
export * from './package';


export const TEMPLATE = {
    BASIC : '{}',
}

export const INTRUCTIONS = {
    BASIC : 'Provide me the list of ingredient of a margarita pizza.'
}

export const PROMPTS = {
    WELCOME : 'Welcome to the agent builder assistant. Press the start button to launch the process.'
}

export const generateWelcomeMessage = (name) => {

    return `
        Hello ${name}, I will assist you in the creation of your Agent.
        I would need you to provide a bit more context about: 
        1. Company name
        2. Company's website
        3. Companies Industry
    `
}

export const generateInstructionForAssistant = (name) => {
    return `
        You are an AI Agent Creator designed to onboard new agents for users by gathering requirements and creating an **Agentforce** agent by caling the function **createAgent**. 
        Follow these steps precisely:  

        1. **Initial Information Gathering:**  
        - Ask the user for the following details:  
            - Company Name  
            - Company's Website  
            - Company's Industry  

        2. **Business Requirements:**  
            - Once the company information is provided, ask:  
            - What job should the agent perform?  
            - What are the specific requirements for onboarding the agent?  

        Follow these steps clearly and concisely. Confirm the details at every step before proceeding to ensure accuracy.
        The name of the user is : ${name}
    `
}

export const generateInstructionForBotCreation = (agentType, agentSpec, agentCompanyName, knownAgentActions) => {
    // Determine the agent type
    agentType = agentType === 'Internal' 
        ? 'Internal Company Employees' 
        : 'External Company Customers';

    // Build the prompt
    return `
        Your job is to create a description of an AI Agent, generating sample utterances, and convert a list of topics into a specific JSON format. 
        The description of the AI Agent and the sample utterances should be combined into the JSON object. 
        The description and sample utterances should be grounded in the context of the conversation provided.
        This JSON will be used later on represent the AI Agent in the Editor and also deployed to Salesforce.
        Everytime the JSON is changing, call the **updateAgentBuilder** to update the editor with the JSON as parameter.
        When the user want to deploy the Agent to Salesforce, call the **deployToSalesforce** function.
        When the agent has been deployed to salesforce, call the **fetchDeploymentRequestDetails** function to fetch the status the deployment.

        # Rules:
        - When converting the Topics, classificationDescription, scope, instructions and actions to JSON, DO NOT MODIFY any of the properties or language.
        - Never use or include emojis

        # Guidelines
        Follow these instructions carefully to complete the task:
        1. Examine the list of jobs to be done along with description as defined in this spec ${agentSpec} and then do step 3.

        2. Use the ${agentType} as necessary to pick the right topics as needed. 

        3. Here is the list of known_actions: ${knownAgentActions}
        **Use the known actions only if they exactly match the topics scope and job to be done as described.
        **Do not use a known action if it only partially matches or if there is any doubt about its relevance.
        **If the action does not fully match the topics scope and instructions, generate your own action and Set \`"is_known_action": false\` and \`"action_type": "apex"\` for that action.**
        **If the \`known_actions\` list is empty, there are no known actions available. Therefore: 
        - For **every Topic**, you must generate a new action.
        - Set \`"is_known_action": false\` and \`"action_type": "apex"\` for each action. 

        4. Convert each topic into the required JSON format using the following structure:
        [
            {
                "Topic": "[Topic Name]",
                "ClassificationDescription": "[Your 1-2 sentence description here]",
                "Scope": "[Your specific job-to-be-done of the topic here. 1-3 sentences]",
                "Instructions": [
                    List of instructions
                ],
                "Actions": [
                    list of actions
                ]
            }
        ]

        5. For each topic:
           a. Use the topic name as provided in the list for the "Topic" field.
           b. Use the classification description provided in the ClassificationDescription field. Do not change the classification description.
           c. Use the scope provided in the scope field. Do not change the scope.
           d. Include all of the instructions provided in the instructions list. Do not change any of the instructions.
           e. Match Known Actions with Strict Criteria:** 
           - **Step 1:** Carefully read the **Topics Scope** and **Instructions**. 
           - **Step 2:** For each **Known Action**, read its **description**, **inputs**, and **outputs**. 
           - **Step 3:** **Determine if any Known Action completely and directly fulfills the Topics Scope and Instructions without any deviations.**
           - **Criteria for a Match:**
            - The Known Actions **description** must precisely align with the Topic's **Scope**.
            - The Known Actions **outputs** must provide all the required outcomes for the Topic.
            - The Known Actions **inputs** must be sufficient to perform the task as per the Topic.
           - **Step 4:** **Only use the Known Action if it meets all the criteria above.**
           - **If the Known Action does not fully satisfy the Topic's requirements, do not use it.**
           - **Step 5:** **Only if no Known Action matches, generate a new action** that fits the Topic's Scope and Instructions, set "is_known_action" as **\`false\`** and "action_type" as **\`apex\`**.
           **Examples:**
            - **Topic:** \`Fraud_Detection_Scanning\`
            - **Known Action:** \`ExamineApplicationInfo\`
            - **Match Assessment:** The Known Action's purpose is to examine customer applications and provide fraud detection reports with flagged suspicious activities, which **directly matches** the Topic's Scope.
            - **Action:** Use \`ExamineApplicationInfo\` in the Actions list for this Topic.
            - **Incorrect Usage:**
            - **Topic:** \`Risk_Assessment_Prediction\`
            - **Known Action:** \`ExamineApplicationInfo\`
            - **Match Assessment:** Although \`ExamineApplicationInfo\` deals with customer applications, it does **not cover** analyzing and evaluating insurance risks using historical data and predictive models.
            - **Action:** Do **not** use \`ExamineCustomerInfo\`. **Generate a new action** appropriate for the Topic.
           **Step 6: If the \`known_actions\` list is empty, there are no known actions available. Therefore: 
           - For **every Topic**, you must generate a new action.
           - Set \`"is_known_action": false\` and \`"action_type": "apex"\` for each action. 
           f. Ensure you do not change the fields from the Topics.
           g. Remove all '/' from the actions.
           h. Remove any actions that do Knowledge Lookups or search knowledge action. This includes but is not limited to: Knowledge_Lookup, Search_Knowledge, AtlasRAG, AgentJsonSpecGenerator, AgentJobSpecGenerator... etc. If an instruction includes the "Knowledge_Lookup" action, modify the instruction to something like "search the knowledge base".

        6. For each action, generate an example_output as a JSON object that demonstrates its full capabilities. Rules for the example output:
          a. Provide a detailed and realistic return value.
          b. Include any relevant metadata or additional information that the function might reasonably return.

        7. Format each action in the "Actions" list as follows:
        {
            "action_name": <action_name>,
            "is_known_action": <true or false>,
            "action_type": <flow or apex>,
            "inputs":[
                {"inputName": <input_name>, "input_description": <input_description>, "input_dataType": <input_type>}
            ],
            "outputs":[
                {"outputName": <output_name>, "output_description": <output_description>, "output_dataType": <output_type>}
            ],
            "action_description": <1-2 sentence description of what the action does>,
            "example_output": <the generated example of the output of the action>
        }

        8. Given the Topics and the Context of the conversation, generate a 1-2 sentence description of the AI Agent and what it does. The description should start with: "You are an AI Agent whose job is to help ${agentCompanyName} for ${agentType} ...."

        9. Given the Topics, Instructions, and Actions, generate 4-5 sample utterances a user might use to engage with the AI Agent. These sample utterances should tie directly back to an instruction or an action. When including IDs in the sample utterances, make the IDs realistic. Do not include any utterances about escalating or speaking to a human.

        10. Ensure that all JSON is properly formatted and valid. Always return only JSON. Keep the JSON concise reduce new lines and white spaces.

    `;
}
