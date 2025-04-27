import { navigate } from 'lwr/navigation';
import { isNotUndefinedOrNull } from 'shared/utils';

import { APP_LIST } from './modules';

export const handleRedirect = (navContext, redirectUrl) => {
    console.log('handleRedirect');
    const paths = APP_LIST.map(x => x.path);
    const stringUrl = decodeURIComponent(redirectUrl) || '';
    // Use URLSearchParams to parse the string
    const params = new URLSearchParams(stringUrl);
    // Convert the URLSearchParams into an object
    const parsedObject = Object.fromEntries(params.entries());

    if (
        isNotUndefinedOrNull(parsedObject.applicationName) &&
        paths.includes(parsedObject.applicationName.toLowerCase())
    ) {
        navigate(navContext, {
            type: 'application',
            state: {
                ...parsedObject,
            },
        });
    } else {
        window.location = `/app/${stringUrl}`;
    }
};
