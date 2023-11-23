const path = require('path');
const express =  require("express");
const serveStatic = require('serve-static');
const handler = require('serve-handler');

const app = express();
const serveJson = require('../../site/serve.json')


const jsforceAjaxProxy = require("jsforce-ajax-proxy");

const PORT = parseInt(process.env.PORT || "3000", 10);

app.all("/proxy/?*", jsforceAjaxProxy({ enableCORS: true }));
app.get("*", (req, res) => handler(req, res, {public: "site",...serveJson}));
app.listen(PORT, () => {
    
    console.log(`✅ App running in PROD mode ${PORT}`);
})
/*
const handler = require('serve-handler');
const http = require('http');

const server = http.createServer((request, response) => {
  // You pass two more arguments for config and middleware
  // More details here: https://github.com/vercel/serve-handler#options
  return handler(request, response,{
    "public": "site",
    ...serveJson
  });
});

server.listen(3000, () => {
  console.log('Running at http://localhost:3000');
});*/