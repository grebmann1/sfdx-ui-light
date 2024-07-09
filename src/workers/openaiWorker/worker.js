
import OpenAI from 'openai';

// Bot methods

const OPENAI_RUN = class {
    openai;
    assistantId;

    constructor(openai_key,openai_assistant_id){
        this.openai = new OpenAI({
            apiKey: openai_key,
        });
        this.assistantId = openai_assistant_id;
    }

    formatContent = (content) => {
        const texts = [
            'Search in the files first to find a possible answer.',
            'If it\'s not there, use your own knwoledge or search on internet.',
            //'Display it and then return in JSON format the redirection to the correct dialog.',
            `This is the request of the user : "${content}". If the user request a diagram, always return a valid mermaid diagram.`,
            //'Provide the response in HTML and add it to the JSON.',
            //'Only return a JSON formatted response following this format : {"response":"your response"}',
            //'Return the response in JSON following this format : {"answer":"your answer in html format"}'
        ];

        return texts.join(' ');
    }

    executeRequest_includingContext = (body) => {
        //console.log('executeRequest_includingContext');
        const { content,extraInformation,threadId } = body; 
    
        return new Promise(async (resolve,reject) => {
            const messageToProcess = {
                role: "user",
                content:this.formatContent(content)
            };
            const run = await this.generateRun(messageToProcess,extraInformation,threadId)
            const res = {
                //messages:messages.data.map(x => ({role:x.role,content:x.content[0].text.value})),
                threadId:run.thread_id,
                extraInformation:extraInformation
            }
            
            const response = await this.waitUntilComplete(run);
            if(response.status === 'failed'){
                console.error(response.last_error?.message);
                res.answer = `[${response.last_error?.code}] ${response.last_error?.message}`;
                resolve(res);
            }else{
                const messages = await this.openai.beta.threads.messages.list(run.thread_id);
                const lastResponse = messages.data[0].content[0].text.value;
                
                try{
                    const formattedValue = JSON.parse(lastResponse);
                    Object.keys(formattedValue).forEach(key => {
                        res[key] = formattedValue[key];
                    })
                }catch(e){
                    //reject(e)
                    //console.log('Issue in the format, sending the default format !');
                    res.answer = lastResponse;
                }
                resolve(res);
            }
            
        })
    }

    generateRun = async (messageToProcess,extraInformation,threadId) => {
        if(!threadId){
            const newThread = await this.openai.beta.threads.create();
            threadId = newThread.id;
        }
        return await this.openai.beta.threads.runs.create(
            threadId,
            { 
                assistant_id: this.assistantId,
                additional_messages:[messageToProcess],
                additional_instructions:extraInformation
            }
        );
    }

    waitUntilComplete = async (run) => {
        const response = await this.openai.beta.threads.runs.retrieve(run.thread_id,run.id);
        //console.log('response.status',response.status,response);
        if(response.status === "completed" || response.status === "failed"){
            return response;
        }else{
            await new Promise(resolve => setTimeout(resolve, 500));
            //console.log('Wait 500ms');
            return this.waitUntilComplete(run);
        }
    }

}

// Listen for messages from the main thread

addEventListener('message', async event => {
    //console.log('WORKER ----- event',event,event.data);
    const { openai_key,openai_assistant_id,body,type } = event.data;
    try {
        if (type === 'executeRequest_includingContext') {
            const instance = new OPENAI_RUN(openai_key,openai_assistant_id)
            const result = await instance.executeRequest_includingContext(body);
            postMessage({ type: 'success', data: result });
        } else {
            postMessage({ type: 'error', data: 'Unknown request type' });
        }
    } catch (error) {
        postMessage({ type: 'error', data: error.message });
    }
});