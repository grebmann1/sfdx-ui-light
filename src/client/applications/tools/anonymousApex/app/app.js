import { api,track } from "lwc";
import { decodeError,isNotUndefinedOrNull,isUndefinedOrNull,guid } from 'shared/utils';
import FeatureElement from 'element/featureElement';
import loader from '@monaco-editor/loader';




export default class App extends FeatureElement {

    isLoading = false;
    isMonacoLoaded = false;

    // Apex
    apexScript; // ='CCR_TaskNotification__e event = new CCR_TaskNotification__e();\n// Publish the event\nDatabase.SaveResult result = EventBus.publish(event);';
    isApexRunning = false;



    connectedCallback(){
       
    }

    disconnectedCallback() {
       
    }


    /** Events **/

    handleMonacoLoaded = (e) => {
        console.log('Monaco Loaded');
        if(!this.isMonacoLoaded){
            this.initEditor();
        }
    }

    executeApex = (e) => {
        this.isApexRunning = true;
        console.log('executeApex');
        this.connector.conn.tooling.executeAnonymous(this.apexScript, (err, res) => {
            console.log('err, res',err, res);
            if (err) { 
                return console.error(err);
            }else if(!res.success){
                const input = this.template.querySelector('.input-apex');
                input.setCustomValidity(`Error: ${res.compileProblem}`);
                input.reportValidity();
            }

            this.isApexRunning = false;
            // ...
        });
    }

    /** Methods  **/

    initEditor = () => {
        this.isMonacoLoaded = true;
        this.refs.editor.displayFiles(
            'ApexClass',[
                {   
                    id:'abc',
                    path:'abc',
                    name:'Script',
                    apiVersion:60,
                    body:'Hello the world',
                    language:'java',
                }
            ]
        );
    }


    /** Getters */

  
}