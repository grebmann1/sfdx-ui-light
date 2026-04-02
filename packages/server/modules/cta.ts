import fetch from 'node-fetch';
import schedule from 'node-schedule';

const baseUrl = 'https://raw.githubusercontent.com/grebmann1/cta-cheat-sheet/main';

type CtaFile = {
    link: string;
    title: string;
    content: string;
};

type FilesCallback = (files: CtaFile[]) => void;

const fetchContent = async (callback: FilesCallback) => {
    const url = `${baseUrl}/Documentation/Documentation.md`;
    const content = await (await fetch(url)).text();

    const files = await extractLinks(content);
    //console.log(`${files.length} files loaded in the cache`);
    callback(files);
};

const extractLinks = async (content: string): Promise<CtaFile[]> => {
    // Links
    const urlPattern = /\[(.*)\]\([\.\/|\.\.\/]+(.*?)\)/g;
    const links = new Set<string>();
    const matches = [...content.matchAll(urlPattern)];
    matches.forEach(x => {
        const [, _label, link] = x;
        links.add(link);
    });

    const result = await Promise.all(
        [...links].map(async link => ({
            link,
            title: link,
            content: await extractFiles(`${baseUrl}/Documentation/${link}`),
        }))
    );
    return result;
};

const extractFiles = async (url: string) => {
    return await (await fetch(url)).text();
};

export const launchScheduleFileDownloaded = (callback: FilesCallback) => {
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
