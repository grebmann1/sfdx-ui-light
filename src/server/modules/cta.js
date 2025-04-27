const schedule = require('node-schedule');
const fetch = require('node-fetch');
const baseUrl = 'https://raw.githubusercontent.com/grebmann1/cta-cheat-sheet/main';

const fetchContent = async callback => {
    const url = `${baseUrl}/Documentation/Documentation.md`;
    const content = await (await fetch(url)).text();

    const files = await extractLinks(content);
    //console.log(`${files.length} files loaded in the cache`);
    callback(files);
};

const extractLinks = async content => {
    // Links
    const urlPattern = /\[(.*)\]\([\.\/|\.\.\/]+(.*?)\)/g;
    const links = new Set();
    const matches = [...content.matchAll(urlPattern)];
    matches.forEach(x => {
        const [match, p1, p2, ...others] = x;
        links.add(p2);
    });

    const result = await Promise.all(
        [...links].map(async x => ({
            link: x,
            title: x,
            content: await extractFiles(`${baseUrl}/Documentation/${x}`),
        }))
    );
    return result;
};

const extractFiles = async url => {
    return await (await fetch(url)).text();
};
const launchScheduleFileDownloaded = callback => {
    try {
        fetchContent(callback);
        schedule.scheduleJob('0 23 * * *', () => {
            // run every every day at 11PM
            //console.log('Auto run of CTA - fetchContent');
            fetchContent(callback);
        });
    } catch (e) {
        console.error(e);
        callback([]);
    }
};

exports.launchScheduleFileDownloaded = launchScheduleFileDownloaded;
