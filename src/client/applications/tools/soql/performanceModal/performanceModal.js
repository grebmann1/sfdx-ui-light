import { api,track } from 'lwc';
import LightningModal from 'lightning/modal';


export default class PerformanceModal extends LightningModal {

    @api isLoading = false;
    @api plans = [];


    connectedCallback(){}

    /** Method */

    

    get formattedPlans(){
        return this.plans.map((x,index) => {
            return {
                ...x,
                _fields:x.fields.join(','),
                _index:index,
                notes:x.notes.map((y,index2) => {
                    return {
                        ...y,
                        _index:`${index}-${index2}`,
                        _fields:y.fields.join(',')
                    }
                })
            }
        })
    }
}