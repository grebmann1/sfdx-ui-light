import { LightningElement,api} from "lwc";
import { classSet } from 'shared/utils';


export default class HorizontalRank extends LightningElement {

    @api title = "Category Score";
    @api subTitle;
    @api description;
    @api mark;
    @api markExtra;

    @api currentStep;
    @api lowLabel = "Poor";
    @api highLabel = "Excellent";

    get step1Class(){
        return classSet('flex grow justify-center text-neutral-80 dark:text-neutral-20')
             .add({
                'invisible':this.currentStep != 1
             })
             .toString();
    }

    get step2Class(){
        return classSet('flex grow justify-center text-neutral-80 dark:text-neutral-20')
             .add({
                'invisible':this.currentStep != 2
             })
             .toString();
    }

    get step3Class(){
        return classSet('flex grow justify-center text-neutral-80 dark:text-neutral-20')
             .add({
                'invisible':this.currentStep != 3
             })
             .toString();
    }

    get step4Class(){
        return classSet('flex grow justify-center text-neutral-80 dark:text-neutral-20')
             .add({
                'invisible':this.currentStep != 4
             })
             .toString();
    }

    get step5Class(){
        return classSet('flex grow justify-center text-neutral-80 dark:text-neutral-20')
             .add({
                'invisible':this.currentStep != 5
             })
             .toString();
    }
}