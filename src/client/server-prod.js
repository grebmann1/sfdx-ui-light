const path = require('path');
const express =  require("express");
const app = express();


const jsforceAjaxProxy = require("jsforce-ajax-proxy");

const PORT = parseInt(process.env.PORT || "3000", 10);


app.use(express.static(path.join(__dirname,'..','..','site')));
app.all("/proxy/?*", jsforceAjaxProxy({ enableCORS: true }));
app.listen(PORT, () => {
    
    console.log(`✅ App running in PROD mode`);
})

