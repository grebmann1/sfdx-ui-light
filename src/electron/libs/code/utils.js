const fs    = require('fs');
const path  = require('path');
const exportMap = {};

exportMap._saveFilesZip = ({zip,files,sourcePath}) => {
    files.forEach(file => {
        file.path = file.path.replace(sourcePath,''); // We clean the path
        zip.file(file.path,file.body);
    })
    console.log('----> _saveFilesZip <-----');
    console.log(files);
}

module.exports = exportMap;