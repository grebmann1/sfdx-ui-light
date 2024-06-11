export class Header{
    alias;
    company;
    name;
    // oauth
    loginUrl;
    accessToken;
    instanceUrl;
    refreshToken;
    version;
    // redirect type
    redirectUrl;
    // user info
    userInfo;
    orgId;
    username;

}
export class Connector {

    constructor(header,conn) {
        this.header = header;
        this.conn = conn;
    }

    get redirectUrl(){
        return this.header?.redirectUrl;
    }

    get isRedirect(){
        return this.redirectUrl && !this.conn;
    }

    get frontDoorUrl(){
        return this.isRedirect?this.redirectUrl:this.conn.instanceUrl+'/secur/frontdoor.jsp?sid='+this.conn.accessToken;
    }
}