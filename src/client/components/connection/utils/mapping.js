
export class Connector {
    constructor(header,conn) {
        this.header = header;
        this.conn = conn;
    }

    get frontDoorUrl(){
        return this.conn.instanceUrl+'/secur/frontdoor.jsp?sid='+this.conn.accessToken;
    }
}