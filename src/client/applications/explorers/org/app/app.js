import { api,wire } from "lwc";
import { isEmpty,isElectronApp } from 'shared/utils';
import ToolkitElement from 'core/toolkitElement';
import { store,store_application } from 'shared/store';
import { NavigationContext, generateUrl, navigate } from 'lwr/navigation';
import { CONFIG } from 'ui/app';


export default class App extends ToolkitElement {
    @wire(NavigationContext)
    navContext;

    userInformations = {}
    limits = [];

    // Filtering
    isFilterting_limits = false;

    connectedCallback(){
        //this.isFilterting_limits = true;
        this.init();
    }

    init = async () => {
        this.limits = await this.load_limits();
        this.userInformations = await this.load_userInformations();
    }

    /** Methods */
    
    goToTarget = (target) => {
        navigate(this.navContext,{type:'application',attributes:{
            applicationName:CONFIG.APP_LIST.find(x => x.name === target).path
        }});
    }
    
    openMetadataExplorer = () => {
        this.goToTarget('metadata/app');
    }

    openSobjectExplorer = () => {
        this.goToTarget('object/app');
    }

    openSOQLExplorer = () => {
        this.goToTarget('soql/app');
    }

    openInBrowser = () => {
        if(isElectronApp()){
            // Electron version
            window.electron.ipcRenderer.invoke('org-openOrgUrl',this.connector.configuration);
        }else{
            // Browser version
            let url = this.connector.frontDoorUrl;
            window.open(url,'_blank');
        }    //https://rieckermanngmbh--qa.sandbox.lightning.force.com/lightning/setup/SetupOneHome/home?setupApp=all
    }

    goToUrl = (e) => {
        const redirectUrl = e.currentTarget.dataset.url;
        store.dispatch(store_application.navigate(redirectUrl));
    }

    generateLabel = (key) => {
        let label = [];
        let temp = '';
        key.split(/(?=[A-Z])/).forEach(x => {
            if([...x].length == 1){
                temp += x;
            }else{
                if(!isEmpty(temp)){
                    label.push(temp);
                    temp = '';
                }
                label.push(x);
            }
        })

        if(!isEmpty(temp)){
            label.push(temp);
            temp = '';
        }

        return label.join(' ');
    }
    

    load_limits = async () => {
        let response = await this.connector.conn.request(
            `/services/data/v${this.connector.conn.version}/limits/`
        )
        return Object.keys(response).map(key => {
            
            return {
                ...response[key],
                name:key,
                label:this.generateLabel(key)
            }
        })
    }

    load_eventsLogs = async () => {
        //let response = await this.connector.conn.query("SELECT Id , EventType , LogFile , LogDate , LogFileLength FROM EventLogFile WHERE EventType = 'API'");
    }

    load_userInformations = async () => {
        let responses = await Promise.all([
            this.connector.conn.query("SELECT Count(Id) total,IsActive FROM User GROUP BY IsActive"),
        ]);


        return {
            total_users:responses[0].records.reduce((total,x) => x.total+total,0),
            total_active:responses[0].records.find(x => x.IsActive)?.total || 0,
            total_inactive:responses[0].records.find(x => !x.IsActive)?.total || 0,
        };
    }


    /** Getters */
    

    get formattedLimits(){
        return this.limits.filter( x =>  !this.isFilterting_limits || x.Remaining == 0 || x.Max/x.Remaining <= 0.10) || [];
    }

    get filtering_limits_variants(){
        return this.isFilterting_limits?'brand':'neutral';
    }

    /** Events */

    filtering_limits_handleClick = (e) => {
        this.isFilterting_limits = !this.isFilterting_limits;
    }
    

}