const request = require('request');

/**
 * Allowed request headers 
 */
const ALLOWED_HEADERS = [
	'Authorization',
	'Content-Type',
	'Salesforceproxy-Endpoint',
	'X-Authorization',
	'X-SFDC-Session',
	'SOAPAction',
	'Sforce-Auto-Assign',
	'Sforce-Call-Options',
	'Sforce-Query-Options',
	'x-sfdc-packageversion-clientPackage',
	'If-Modified-Since',
	'X-User-Agent',
	'Cookie'
];

/**
 * Endpoint URL validation
 */
const SF_ENDPOINT_REGEXP = /^https:\/\/[a-zA-Z0-9.-]+\.(force|salesforce|cloudforce|database)\.com\//;

/**
 * Create middleware to proxy request to Salesforce server
 */
module.exports = function (options = {}) {

	return (req, res) => {
		if (options.enableCORS) {
			res.set({
				'Access-Control-Allow-Origin': options.allowedOrigin || '*',
				'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE',
				'Access-Control-Allow-Headers': ALLOWED_HEADERS.join(','),
				'Access-Control-Expose-Headers': 'SForce-Limit-Info',
			});
			if (req.method === 'OPTIONS') {
				return res.sendStatus(200);
			}
		}

		const sfEndpoint = req.headers['salesforceproxy-endpoint'];
		if (!SF_ENDPOINT_REGEXP.test(sfEndpoint)) {
			return res.status(400).send(`Proxying endpoint is not allowed. 'salesforceproxy-endpoint' header must be a valid Salesforce domain: ${sfEndpoint}`);
		}

		// Extract allowed headers from request
		const headers = ALLOWED_HEADERS.reduce((acc, header) => {
			const headerLower = header.toLowerCase();
			const value = req.headers[headerLower];
			if (value) {
				const name = headerLower === 'x-authorization' ? 'authorization' : headerLower;
				acc[name] = value;
			}
			return acc;
		}, {});

		const requestOptions = {
			url: sfEndpoint || 'https://login.salesforce.com/services/oauth2/token',
			method: req.method,
			headers,
		};

		req.pipe(request(requestOptions))
		.on('error', (error) => {
			res.status(500).send('An error occurred while proxying the request.');
		})
		.pipe(res);
	};
};
