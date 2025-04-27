export class Connector {
    conn;
    configuration;

    constructor(configuration, conn) {
        this.configuration = configuration;
        this.conn = conn;
    }

    get redirectUrl() {
        return this.header?.redirectUrl;
    }

    get isRedirect() {
        return this.redirectUrl && !this.conn;
    }

    get frontDoorUrl() {
        return this.isRedirect
            ? this.redirectUrl
            : this.conn.instanceUrl + '/secur/frontdoor.jsp?sid=' + this.conn.accessToken;
    }
}
