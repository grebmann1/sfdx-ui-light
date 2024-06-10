import { createElement,api,track} from "lwc";
import FeatureElement from 'element/featureElement';
import { connectStore,store,store_application } from 'shared/store';

import {runActionAfterTimeOut,isEmpty,isNotUndefinedOrNull,isUndefinedOrNull,classSet} from 'shared/utils';
import { getCurrentTab,getCurrentObjectType,fetch_data,fetch_metadata,
    getObjectSetupLink,getObjectFieldsSetupLink,getRecordTypesLink,getObjectListLink,getObjectDocLink
} from "extension/utils";

const PAGE_LIST_SIZE = 70;
const BASE_QUERY = 'SELECT Id, Username, Name,Email,IsActive,ProfileId,Profile.Name FROM User ';

export default class UserExplorer extends FeatureElement {

    
    isLoading = false;
    currentTab;
    currentOrigin;

    // for table
    data = [];
    filter = '';

    // Scrolling
    pageNumber = 1;

    // Filter panel
    displayQuickLinkPanel = false;
    


    connectedCallback(){
        // Load metadata
        //this.getObjects(this.connector.conn,'standard');
        //this.getObjects(this.connector.conn.tooling,'tooling');
        this.initDefault();
    }
    

    /** Methods **/

    searchUsers = async () => {
        this.isLoading = true;
        let query = this.connector.conn.query(`${BASE_QUERY} WHERE Username  LIKE '%${this.filter}%' OR Name LIKE '%${this.filter}%' OR Email LIKE '%${this.filter}%' OR Profile.Name LIKE '%${this.filter}%' ORDER BY Name limit 200`);
        try{
            let records = await query.run({ responseTarget:'Records',autoFetch : true, maxFetch : 100000 }) || [];
            this.data = records;
        }catch(e){
            console.error(e);
        }
        this.isLoading = false;
    }

    initDefault = async () => {
        this.currentTab = await getCurrentTab();
        this.currentOrigin = (new URL(this.currentTab.url)).origin;
        // Default when loading
        this.isLoading = true;
        let query = this.connector.conn.query(`${BASE_QUERY} ORDER BY Name limit 200`);

        try{
            let records = await query.run({ responseTarget:'Records',autoFetch : true, maxFetch : 100000 }) || [];
            this.data = records;    
        }catch(e){
            console.error(e);
        }
        this.isLoading = false;
    }

    @api
    updateFilter = (value) => {
        this.filter = value;
        this.searchUsers();
        this.pageNumber = 1; // reset
    }

    filtering = (arr) => {
    
        var items = [];
        var regex = new RegExp('('+this.filter+')','i');
        for(var key in arr){
            const item = arr[key];
            const { Name,Username,Email,Profile } = item;
              
            if(regex.test(Name) || regex.test(Username) || regex.test(Email) || regex.test(Profile?.Name)){
                items.push(item);
                continue;
            }
        }
    
       return items;
    }


    /** Events **/
    
    handleCloseVerticalPanel = () => {
        this.displayQuickLinkPanel = false;
    }

    quickLinkPanel_handleClick = () => {
        this.displayQuickLinkPanel = !this.displayQuickLinkPanel;
    }

    filterPanel_handleClick = () => {
        //this.displayFilterPanel = !this.displayFilterPanel;
    }

    adduser_handleClick = () => {
        const addressUrl = `/005/e`
        window.open(`${this.currentOrigin}/lightning/setup/ManageUsers/page?address=${encodeURIComponent(addressUrl)}`,'_blank');
    }

    refresh_handleClick = () => {
        if(isEmpty(this.filter)){
            this.initDefault();
        }else{
            this.searchUsers();
        }
    }

    handleScroll(event) {
        //console.log('handleScroll');
        const target = event.target;
        const scrollDiff = Math.abs(target.clientHeight - (target.scrollHeight - target.scrollTop));
        const isScrolledToBottom = scrollDiff < 5; //5px of buffer
        if (isScrolledToBottom) {
            // Fetch more data when user scrolls to the bottom
            this.pageNumber++;
        }
    }


    /** Getters */

    get userLinkList(){
        return '';
    }

    get virtualList(){
        // Best UX Improvement !!!!
        return this.formattedData.slice(0,this.pageNumber * PAGE_LIST_SIZE);
    }

    get formattedData(){
        return this.filtering(this.data);
    }

    get hasLoaded(){
        return !this.isLoading;
    }

    get articleContainerClass(){
        return classSet('full-page slds-card slds-col')
        .add({
            //'slds-m-top_small':!this.isResponsive,
            'slds-25-width':this.displayQuickLinkPanel,
            'slds-100-width':!this.displayFilter
            //'slds-scrollable_y':this.isResponsive
            //'slds-show_large':this.displayFilter || this.displayMenu
        }).toString();
    }


}