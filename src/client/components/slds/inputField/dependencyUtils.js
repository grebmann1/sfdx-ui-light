import { FieldTypes as Fields } from './fieldUtils';

export function isInDependencyChain(uiField, fields, picklistValues) {
    return (
        hasDependents(uiField, fields, picklistValues) ||
        hasController(uiField, fields, picklistValues)
    );
}

export function hasDependents(uiField, fields, picklistValues) {
    for (const fieldName in fields) {
        if (fields.hasOwnProperty(fieldName)) {
            const field = fields[fieldName];
            if (field.controllerName === uiField.apiName) {
                // make sure the dependent field exists in the form
                if (picklistFieldInForm(fieldName, picklistValues)) {
                    return true;
                }
            }
        }
    }

    return false;
}

function hasController(uiField, fields, picklistValues) {
    const controllerName = uiField.controllerName;
    const hasControllingField = fields[controllerName] !== undefined;

    return (
        hasControllingField &&
        (picklistFieldInForm(controllerName, picklistValues) ||
            checkboxFieldInForm(controllerName, fields))
    );
}

export function isControllerMissing(uiField, fields, picklistValues) {
    const controllerName = uiField.controllerName;
    const hasControllingField = fields[controllerName] !== undefined;

    return (
        hasControllingField &&
        !picklistFieldInForm(controllerName, picklistValues) &&
        !checkboxFieldInForm(controllerName, fields)
    );
}

function picklistFieldInForm(fieldName, picklistValues) {
    return picklistValues[fieldName] !== undefined;
}

function checkboxFieldInForm(fieldName, fields) {
    return fields[fieldName] !== undefined && Fields.BOOLEAN === fields[fieldName].dataType;
}
