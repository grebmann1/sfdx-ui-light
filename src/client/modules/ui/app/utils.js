import { navigate } from 'lwr/navigation';
import {APP_LIST} from './modules';


export const handleRedirect = (navContext,redirectUrl) => {
    const paths = APP_LIST.map(x => x.path);
    const stringUrl = decodeURI(redirectUrl) || '';
    if(paths.includes(stringUrl.toLowerCase())){
        navigate(navContext,{
            type:'application',
            attributes:{
                applicationName:stringUrl
            }
        });
    }else{
        window.location = `/app/${stringUrl}`;
    }


    

}