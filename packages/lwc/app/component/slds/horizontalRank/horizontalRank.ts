import { LightningElement, api } from 'lwc';
import { classSet } from 'shared/utils';

export default class HorizontalRank extends LightningElement {
    @api title = 'Category Score';
    @api subTitle;
    @api description;
    @api mark;
    @api markExtra;

    @api currentStep;
    @api lowLabel = 'Poor';
    @api highLabel = 'Excellent';

    @api isLight = false;
    @api isDarkTheme = false;

    get containerClass() {
        return classSet(
            'col-span-6 hidden rounded-xl bg-neutral-0 p-4 dark:bg-neutral-100 sm:col-span-3 sm:block'
        )
            .add({
                'sm:bg-gradient-104': this.isDarkTheme,
            })
            .toString();
    }

    get step1Class() {
        return classSet('flex grow justify-center text-neutral-80 dark:text-neutral-20')
            .add({
                invisible: this.currentStep != 1,
            })
            .toString();
    }

    get step2Class() {
        return classSet('flex grow justify-center text-neutral-80 dark:text-neutral-20')
            .add({
                invisible: this.currentStep != 2,
            })
            .toString();
    }

    get step3Class() {
        return classSet('flex grow justify-center text-neutral-80 dark:text-neutral-20')
            .add({
                invisible: this.currentStep != 3,
            })
            .toString();
    }

    get step4Class() {
        return classSet('flex grow justify-center text-neutral-80 dark:text-neutral-20')
            .add({
                invisible: this.currentStep != 4,
            })
            .toString();
    }

    get step5Class() {
        return classSet('flex grow justify-center text-neutral-80 dark:text-neutral-20')
            .add({
                invisible: this.currentStep != 5,
            })
            .toString();
    }
}
