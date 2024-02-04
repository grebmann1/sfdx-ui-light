import LightningDatatable from 'lightning/datatable';
import customSelectionCellTemplate from "./customSelectionCellTemplate.html";

export default class SldsListBuilderCustomDatatable extends LightningDatatable {
    static customTypes = {
        customSelectionCell: {
            template: customSelectionCellTemplate,
            standardCellLayout: true,
            typeAttributes: ['recordId','checked','label','excluded'],
        }
    };
}