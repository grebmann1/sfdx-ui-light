const { createServer } =  require("lwr");
const jsforceAjaxProxy = require("jsforce-ajax-proxy");

require('dotenv').config();


const PORT = parseInt(process.env.PORT || "3000", 10);
const SERVER_MODE = "development" === process.env.NODE_ENV ? "dev" : "prod";

const lwrServer = createServer({
    serverMode: SERVER_MODE,
    port: PORT,
});

const app = lwrServer.getInternalServer("express");
app.all("/proxy/?*", jsforceAjaxProxy({ enableCORS: true }));



lwrServer
.listen(( { port, serverMode }) => {
    console.log(`✅ App listening on port ${port} in ${serverMode} mode!`);
    console.log(`Url http://localhost:${port}`);
})
.catch((err) => {
    console.error(err);
    process.exit(1);
});