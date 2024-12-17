export const tools = [
    {
        type: "function",
        function: {
            name: "createAgent",
            description: `
                Create an Agent (AgentForce) for a customer based on specific information. 
                Call this when you have enough information to proceed or when the user confirm the creation of the Agent. 
                The response will be a prompt that you need to execute. The output of that prompt should be a valid JSON.
            `,
            parameters: {
                type: "object",
                properties: {
                    companyName: {
                        type: "string",
                        description: "The company name",
                    },
                    companyWebsite: {
                        type: "string",
                        description: "The company website",
                    },
                    companyIndustry: {
                        type: "string",
                        description: "The company industry",
                    },
                    agentJob: {
                        type: "string",
                        description: "Job that the agent should perform",
                    },
                    agentSpecificRequirement: {
                        type: "string",
                        description: "The specific requirements for onboarding the agent",
                    },
                },
                required: [
                    "companyName",
                    "companyWebsite",
                    "companyIndustry",
                    "agentJob",
                    "agentSpecificRequirement"
                ],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "updateAgentBuilder",
            description: `
                This function is updating the body of the Agent Builder. Whenever you need to update the Agent Editor, call this method.
            `,
            parameters: {
                type: "object",
                properties: {
                    body: {
                        type: "object",
                        description: "Represent the structure of the AI Agent in JSON.",
                    }
                },
                required: [
                    "body"
                ],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "deployToSalesforce",
            description: `
                This function is deploying the agent to salesforce.
            `,
            parameters: {
                type: "object",
                properties: {
                    company_website: {
                        type: "string",
                        description: "Company website",
                    },
                    company_name:{
                        type: "string",
                        description: "Company Name",
                    },
                    bot_api_name:{
                        type: "string",
                        description: "Agent ApiName in formats like hello_the_world, hellotheworld, or hello_the_world_1.",
                    }
                },
                required: [
                    "company_website",
                    "company_name",
                    "bot_api_name"
                ],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "fetchDeploymentDetails",
            description: `
                This function should be used to fetch the deployment details once the deployToSalesforce method has been called. 
                From the deployment information, only return the deploymentId to the user with a message mentioning that the deployment is pending but the status will be automatically updated.
            `,
        },
    }
];