jsforce.browser.Client.prototype._getTokens = function() {
    //console.log('_getTokens');
    var regexp = new RegExp("(^|;\\s*)"+this._prefix+"_loggedin=true(;|$)");
    if (document.cookie.match(regexp)) {
      var issuedAt = Number(localStorage.getItem(this._prefix+'_issued_at'));
      if (Date.now() < issuedAt + 2 * 60 * 60 * 1000) { // 2 hours
        var userInfo;
        var idUrl = localStorage.getItem(this._prefix + '_id');
        if (idUrl) {
          var ids = idUrl.split('/');
          userInfo = { id: ids.pop(), organizationId: ids.pop(), url: idUrl };
        }
        let res = {
            accessToken: localStorage.getItem(this._prefix + '_access_token'),
            refreshToken: localStorage.getItem(this._prefix + '_refresh_token'),
            instanceUrl: localStorage.getItem(this._prefix + '_instance_url'),
            userInfo: userInfo
          };
          console.log('res',res);
        return res;
      }
    }
    return null;
};

jsforce.browser.Client.prototype._storeTokens = function(params) {
    //console.log('_storeTokens',params);
    localStorage.setItem(this._prefix + '_access_token', params.access_token);
    localStorage.setItem(this._prefix + '_refresh_token', params.refresh_token);
    localStorage.setItem(this._prefix + '_instance_url', params.instance_url);
    localStorage.setItem(this._prefix + '_issued_at', params.issued_at);
    localStorage.setItem(this._prefix + '_id', params.id);
    document.cookie = this._prefix + '_loggedin=true;';
};
jsforce.browser.Client.prototype._removeTokens = function() {
    localStorage.removeItem(this._prefix + '_access_token');
    localStorage.removeItem(this._prefix + '_refresh_token');
    localStorage.removeItem(this._prefix + '_instance_url');
    localStorage.removeItem(this._prefix + '_issued_at');
    localStorage.removeItem(this._prefix + '_id');
    document.cookie = this._prefix + '_loggedin=';
};