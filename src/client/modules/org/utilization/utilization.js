import { LightningElement,api} from "lwc";
import { isEmpty } from 'shared/utils';


export default class Utilization extends LightningElement {

    @api connector;

    userLicenses = [];


    async connectedCallback(){
        this.isFilterting_limits = true;
        
        this.userLicenses = await this.load_userLicenses();
    }

    /** Methods */

    getCurrentRank = (mapping,value) => {
        for (let i = 0; i < mapping.length; i++) {
            if(value < mapping[i]){
                return i+1;
            }
        }

        return mapping.length;
    }


    load_userLicenses = async () => {
        let response = await this.connector.conn.query("SELECT CreatedDate, Id, LastModifiedDate, LicenseDefinitionKey, MasterLabel, Name, Status, SystemModstamp, TotalLicenses, UsedLicenses, UsedLicensesLastUpdated FROM UserLicense WHERE Status = 'Active' ORDER BY UsedLicenses DESC");
        
        const ratioMapping = [10,20,40,60,75];

        return response.records.map(x => {
            const ratio = x.TotalLicenses > 0 ?x.UsedLicenses/x.TotalLicenses:0;

            return {
                UsedLicenses:x.UsedLicenses,
                TotalLicenses:x.TotalLicenses,
                Id:x.Id,
                currentRank:this.getCurrentRank(ratioMapping,ratio*100),
                value:`${(ratio*100).toFixed(0)} %`,
                label:x.MasterLabel,
                description:`${x.UsedLicenses} / ${x.TotalLicenses} licenses are currently used.`
            }
        }).sort((a, b) => b.UsedLicenses - a.UsedLicenses);

    }

   


    /** Getters */

 

    /** Events */

  
    

}