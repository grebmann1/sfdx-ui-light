const fs = require('fs');
const path = require('path');

const RELEASE_MD_PATH = path.resolve(__dirname, '../release.md');
const OUTPUT_JSON_PATH = path.resolve(__dirname, '../src/client/assets/releaseNotes.json');

const md = fs.readFileSync(RELEASE_MD_PATH, 'utf-8');

const versionBlockRegex = /## Version ([\d.]+) - ([^\n]+)\n([\s\S]*?)(?=^## Version|\n#|\n*$)/gm;
const sectionRegex = /^### ([^\n]+)\n([\s\S]*?)(?=^### |^## Version|\n#|\n*$)/gm;
const bulletRegex = /^- (.*)$/gm;

let releases = [];
let match;

while ((match = versionBlockRegex.exec(md)) !== null) {
  const [_, version, date, content] = match;
  let sections = [];
  let sectionMatch;
  while ((sectionMatch = sectionRegex.exec(content)) !== null) {
    const [__, sectionTitle, sectionContent] = sectionMatch;
    let items = [];
    let bulletMatch;
    while ((bulletMatch = bulletRegex.exec(sectionContent)) !== null) {
      items.push(bulletMatch[1].trim());
    }
    // If no bullets, treat as paragraph
    if (items.length === 0 && sectionContent.trim()) {
      items.push(sectionContent.trim());
    }
    sections.push({ title: sectionTitle.trim(), items });
  }
  releases.push({ version, date: date.trim(), sections });
}

fs.mkdirSync(path.dirname(OUTPUT_JSON_PATH), { recursive: true });
fs.writeFileSync(OUTPUT_JSON_PATH, JSON.stringify(releases, null, 2));

console.log(`Release notes JSON generated at ${OUTPUT_JSON_PATH}`); 