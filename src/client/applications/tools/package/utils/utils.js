import { guid, isUndefinedOrNull } from 'shared/utils';

export const TEMPLATE = {
    BASIC: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Package xmlns="http://soap.sforce.com/2006/04/metadata"><types><members>*</members><name>ApexClass</name></types><version>{0}</version></Package>',
};
