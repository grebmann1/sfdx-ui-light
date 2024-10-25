import { navigate } from 'lwr/navigation';
import {APP_LIST} from './modules';


export const handleRedirect = (navContext,redirectUrl) => {
    console.log('handleRedirect');
    const paths = APP_LIST.map(x => x.path);
    const stringUrl = decodeURI(redirectUrl) || '';
    if(paths.includes(stringUrl.toLowerCase())){
        navigate(navContext,{
            type:'application',
            state:{
                applicationName:stringUrl
            }
        });
    }else{
        window.location = `/app/${stringUrl}`;
    }


    

}