import { LightningElement, track,api } from 'lwc';
import LightningAlert from 'lightning/alert';
import { isEmpty,classSet,isUndefinedOrNull,isNotUndefinedOrNull,runActionAfterTimeOut } from 'shared/utils';

export default class FileUploader extends LightningElement {

    @api title = 'Drop file here';

    @api isModal = false;

    @api typeList = [];


    drag = false;
    dragOver = false; // New property to track drag over state
    dragEnterCounter = 0;

    parentElement;

    connectedCallback(){
        //console.log('connectedCallback');
        if(this.isModal){
            this.parentElement = document.getElementsByTagName('lightning-overlay-container')[0];
        }else{
            this.parentElement = document.body;
        }
        this.parentElement.addEventListener("dragenter",this.handleDragEnter);
        this.parentElement.addEventListener("dragleave",this.handleLeaveGlobal);
        this.parentElement.addEventListener("drop",this.handleDropGlobal);
    }

    disconnectedCallback(){
        //console.log('disconnectedCallback');
        this.parentElement.removeEventListener("dragenter",this.handleDragEnter);
        this.parentElement.removeEventListener("dragleave",this.handleLeaveGlobal);
        this.parentElement.removeEventListener("drop",this.handleDropGlobal);
    }

    /** Methods **/

    reset = () => {
        this.drag = false;
        this.dragOver = false;
        this.dragEnterCounter = 0;
    }


    /** Global Events **/

    handleDropGlobal = (event) =>  {
        event.preventDefault();
        this.reset();
    }

    handleLeaveGlobal = (event) =>  {
        event.preventDefault();
        if (!this.parentElement.contains(event.relatedTarget)) {
            // Here it is only dragleave on the parent
            this.reset();
        }
    }

    handleDragEnter = (event) => {
        event.stopPropagation();
        // When a drag enters, change dragOver to true
        this.drag = true;
    }

    handleDragEnd = (event) => {
        this.reset();
    }

    /** Events **/


    handleDragOver(event) {
        event.preventDefault();
        this.dragOver = true;
    }
    

    handleDragLeave(event) {
        // When a drag leaves, reset dragOver to false
        this.dragOver = false;
    }

    @api
    handleDrop(event) {
        //console.log('handleDrop');
        event.preventDefault();
        const files = event.dataTransfer?.files || event.target?.files;
        if (files.length > 0 && this.typeList.includes(files[0].type)) {
            this.readFile(files[0]);
        } else {
            LightningAlert.open({
                message: `The format ${files[0].type} isn\'t supported !`,
                theme: 'error', 
                label: 'Error!', 
            });
        }
    }

    readFile(file) {
        const reader = new FileReader();
        reader.onload = () => {
            try {
                this.dispatchEvent(new CustomEvent("filechange", { detail:{value:reader.result},composed: true,bubbles: true }));
            } catch (e) {
                LightningAlert.open({
                    message: e.message,
                    theme: 'error', 
                    label: 'Error!', 
                });
            }
        };
        reader.readAsText(file);
    }

    /** Getters **/

    get fileUploaderClass(){
        return classSet("slds-file-selector slds-file-selector_integrated")
        .add({
            //'slds-drop-zone':this.dragOver,
            //'slds-file-selector__dropzone slds-file-selector__dropzone_integrated slds-has-drag slds-has-drag-over':this.dragOver
        })
        .toString();
    }

    get fileUploaderContainerClass(){
        return classSet("slds-file-selector__dropzone slds-file-selector__dropzone_integrated")
        .add({
            'slds-has-drag':this.drag,
            'slds-has-drag-over':this.dragOver,
            //'slds-hide':!this.drag
        })
        .toString();
    }
}