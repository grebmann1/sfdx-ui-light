import { LightningElement,api} from "lwc";
import { classSet } from 'shared/utils';


export default class BasicStats extends LightningElement {

    @api title = "Category Score";
    @api value;
    @api subValue;

}