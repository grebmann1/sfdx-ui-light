const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["chunks/indexeddb-fs-Bt_2jXuF.js","chunks/error-boundary-D9_ioP6a.js","chunks/permissions-D0zItE5S.js"])))=>i.map(i=>d[i]);
import{a as A,g as R,l as S}from"./error-boundary-D9_ioP6a.js";var L=A();const se=R(L),D="modulepreload",F=function(c){return"/"+c},x={},y=function(e,n,t){let a=Promise.resolve();if(n&&n.length>0){let r=function(i){return Promise.all(i.map(d=>Promise.resolve(d).then(p=>({status:"fulfilled",value:p}),p=>({status:"rejected",reason:p}))))};document.getElementsByTagName("link");const s=document.querySelector("meta[property=csp-nonce]"),l=s?.nonce||s?.getAttribute("nonce");a=r(n.map(i=>{if(i=F(i),i in x)return;x[i]=!0;const d=i.endsWith(".css"),p=d?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${i}"]${p}`))return;const u=document.createElement("link");if(u.rel=d?"stylesheet":D,d||(u.as="script"),u.crossOrigin="",u.href=i,l&&u.setAttribute("nonce",l),document.head.appendChild(u),d)return new Promise((C,P)=>{u.addEventListener("load",C),u.addEventListener("error",()=>P(new Error(`Unable to preload CSS for ${i}`)))})}))}function o(r){const s=new Event("vite:preloadError",{cancelable:!0});if(s.payload=r,window.dispatchEvent(s),!s.defaultPrevented)throw r}return a.then(r=>{for(const s of r||[])s.status==="rejected"&&o(s.reason);return e().catch(o)})},O=new TextEncoder,N=new TextDecoder;function v(c,e){if(c instanceof Uint8Array)return c;switch(e){case"base64":return Uint8Array.from(atob(c),n=>n.charCodeAt(0));case"hex":{const n=new Uint8Array(c.length/2);for(let t=0;t<c.length;t+=2)n[t/2]=parseInt(c.slice(t,t+2),16);return n}case"binary":case"latin1":return Uint8Array.from(c,n=>n.charCodeAt(0));default:return O.encode(c)}}function E(c,e){switch(e){case"base64":return btoa(String.fromCharCode(...c));case"hex":return Array.from(c).map(n=>n.toString(16).padStart(2,"0")).join("");case"binary":case"latin1":return String.fromCharCode(...c);default:return N.decode(c)}}function g(c){if(c!=null)return typeof c=="string"?c:c.encoding??void 0}const w=S.scoped("native-fs");class M{constructor(e,n="readwrite"){this.handle=e,this.mode=n}async readFile(e,n){const t=await this.readFileBuffer(e),a=g(n);return E(t,a)}async readFileBuffer(e){const t=await(await this.getFileHandle(e)).getFile();return new Uint8Array(await t.arrayBuffer())}async writeFile(e,n,t){if(this.mode==="read")throw new Error(`EROFS: read-only file system, write '${e}'`);const a=this.splitPath(e),o=a.pop();let r=this.handle;for(const u of a)r=await r.getDirectoryHandle(u,{create:!0});const l=await(await r.getFileHandle(o,{create:!0})).createWritable(),i=g(t),d=v(n,i),p=new ArrayBuffer(d.byteLength);new Uint8Array(p).set(d),await l.write(p),await l.close()}async appendFile(e,n,t){if(this.mode==="read")throw new Error(`EROFS: read-only file system, write '${e}'`);let a=null;try{a=await this.readFileBuffer(e)}catch{}const o=g(t),r=v(n,o);if(a){const s=new Uint8Array(a.length+r.length);s.set(a),s.set(r,a.length),await this.writeFile(e,s)}else await this.writeFile(e,r)}async readdir(e){w.log(`readdir("${e}")`);try{const n=await this.getDirectoryHandle(e),t=[];for await(const a of n.values())t.push(a.kind==="directory"?`${a.name}/`:a.name);return w.log(`readdir("${e}") found ${t.length} entries`),t.sort()}catch(n){throw w.error(`readdir("${e}") failed:`,n),n}}async exists(e){if(!e||e==="/"||e==="")return!0;try{return await this.getFileHandle(e),!0}catch{try{return await this.getDirectoryHandle(e),!0}catch{return!1}}}async stat(e){if(!e||e==="/"||e==="")return{isFile:!1,isDirectory:!0,isSymbolicLink:!1,mode:493,size:0,mtime:new Date};try{const t=await(await this.getFileHandle(e)).getFile();return{isFile:!0,isDirectory:!1,isSymbolicLink:!1,mode:420,size:t.size,mtime:new Date(t.lastModified)}}catch{return await this.getDirectoryHandle(e),{isFile:!1,isDirectory:!0,isSymbolicLink:!1,mode:493,size:0,mtime:new Date}}}async lstat(e){return this.stat(e)}async rm(e,n){if(this.mode==="read")throw new Error(`EROFS: read-only file system, rm '${e}'`);const t=this.splitPath(e),a=t.pop();if(!a)throw new Error("EPERM: cannot remove root directory");let o=this.handle;for(const r of t)try{o=await o.getDirectoryHandle(r)}catch{if(n?.force)return;throw new Error(`ENOENT: no such file or directory, rm '${e}'`)}try{await o.removeEntry(a,{recursive:n?.recursive})}catch(r){if(n?.force&&r.name==="NotFoundError")return;throw r.name==="InvalidModificationError"?new Error(`ENOTEMPTY: directory not empty, rm '${e}'`):r}}async mkdir(e,n){if(this.mode==="read")throw new Error(`EROFS: read-only file system, mkdir '${e}'`);const t=this.splitPath(e);let a=this.handle;for(let o=0;o<t.length;o++){const r=t[o],s=o===t.length-1;try{a=await a.getDirectoryHandle(r,{create:n?.recursive||s})}catch(l){throw s&&l.name==="TypeMismatchError"?new Error(`EEXIST: file already exists, mkdir '${e}'`):n?.recursive?l:new Error(`ENOENT: no such file or directory, mkdir '${e}'`)}}}async cp(e,n,t){if(this.mode==="read")throw new Error(`EROFS: read-only file system, cp '${n}'`);const a=await this.stat(e);if(a.isFile){const o=await this.readFileBuffer(e);await this.writeFile(n,o)}else if(a.isDirectory){if(!t?.recursive)throw new Error(`EISDIR: is a directory, cp '${e}'`);await this.mkdir(n,{recursive:!0});const o=await this.readdir(e);for(const r of o){const s=r.endsWith("/")?r.slice(0,-1):r,l=e?`${e}/${s}`:s,i=n?`${n}/${s}`:s;await this.cp(l,i,t)}}}async mv(e,n){await this.cp(e,n,{recursive:!0}),await this.rm(e,{recursive:!0})}async chmod(e,n){}async realpath(e){if(!await this.exists(e))throw new Error(`ENOENT: no such file or directory, realpath '${e}'`);return"/"+this.splitPath(e).join("/")||"/"}async utimes(e,n,t){}async getAllEntries(e=""){const n=[];return await this.collectEntries(this.handle,e,n),n}async collectEntries(e,n,t){for await(const a of e.values()){const o=n?`${n}/${a.name}`:a.name;if(a.kind==="file"){const s=await a.getFile();t.push({path:`/${o}`,type:"file",size:s.size,mtime:s.lastModified})}else t.push({path:`/${o}`,type:"directory",mtime:Date.now()}),await this.collectEntries(a,o,t)}}async getFileHandle(e){const n=this.splitPath(e),t=n.pop();if(!t)throw new Error(`EISDIR: illegal operation on a directory, read '${e}'`);let a=this.handle;for(const o of n)try{a=await a.getDirectoryHandle(o)}catch{throw new Error(`ENOENT: no such file or directory, open '${e}'`)}try{return await a.getFileHandle(t)}catch{throw new Error(`ENOENT: no such file or directory, open '${e}'`)}}async getDirectoryHandle(e){if(!e||e==="/"||e==="")return this.handle;let n=this.handle;for(const t of this.splitPath(e))try{n=await n.getDirectoryHandle(t)}catch{throw new Error(`ENOENT: no such file or directory, scandir '${e}'`)}return n}splitPath(e){return e.split("/").filter(Boolean)}}
const B='---\nname: figma-automation\ndescription: Automate Figma design tasks using the global \'figma\' Plugin API accessible in the browser. Use when a user needs to perform bulk edits, document audits, or complex layer manipulations in an open Figma tab. Triggers on requests like "list all pages", "change all colors", "audit fonts", or "find layers named X".\n---\n\n# Figma Automation\n\nThis skill leverages the fact that the Figma Plugin API is accessible via the global `figma` object when running inside a Figma tab in the browser.\n\n## Core Concepts\n\n### Accessing the API\n\nAll automation must be performed inside a `page.evaluate()` block after connecting to a Figma tab.\n\n```bash\njs -e <<\'EOF\'\nconst result = await page.evaluate(() => {\n  if (typeof figma === "undefined") return "Not a Figma page";\n  // Access Plugin API here\n  return figma.currentPage.name;\n});\nreturn result;\nEOF\n```\n\n### Document Hierarchy\n\n```\nDocumentNode (figma.root)\n└── PageNode (figma.currentPage)\n    ├── FrameNode\n    │   ├── TextNode\n    │   ├── RectangleNode\n    │   └── GroupNode\n    │       └── ...children\n    ├── ComponentNode\n    │   └── ...children\n    └── InstanceNode\n```\n\n### Node Types\n\n| Type                | Description             | Key Properties                               |\n| ------------------- | ----------------------- | -------------------------------------------- |\n| `DOCUMENT`          | Root node               | `children` (pages)                           |\n| `PAGE`              | A page in the file      | `children`, `backgrounds`                    |\n| `FRAME`             | Container/artboard      | `children`, `layoutMode`, `fills`, `strokes` |\n| `GROUP`             | Grouped layers          | `children`                                   |\n| `COMPONENT`         | Reusable component      | `children`, `variantProperties`              |\n| `COMPONENT_SET`     | Component with variants | `children` (components)                      |\n| `INSTANCE`          | Instance of component   | `mainComponent`, `componentProperties`       |\n| `TEXT`              | Text layer              | `characters`, `fontName`, `fontSize`         |\n| `RECTANGLE`         | Rectangle shape         | `fills`, `strokes`, `cornerRadius`           |\n| `ELLIPSE`           | Circle/ellipse          | `fills`, `strokes`, `arcData`                |\n| `POLYGON`           | Polygon shape           | `pointCount`, `fills`, `strokes`             |\n| `STAR`              | Star shape              | `pointCount`, `innerRadius`                  |\n| `LINE`              | Line                    | `strokes`, `strokeWeight`                    |\n| `VECTOR`            | Vector path             | `vectorPaths`, `fills`, `strokes`            |\n| `BOOLEAN_OPERATION` | Union/subtract/etc      | `booleanOperation`, `children`               |\n| `SLICE`             | Export slice            | `exportSettings`                             |\n| `SECTION`           | Section container       | `children`, `sectionContentsHidden`          |\n\n### Common Workflows\n\n- **Traversing the Document**: Use `figma.root` (entire file) or `figma.currentPage` (active page).\n- **Finding Nodes**: Use `node.findAll(callback)` to search for layers based on type, name, or properties.\n- **Color Manipulation**: Solid colors use RGB values from 0 to 1. Use the cheatsheet for conversions.\n- **Global Styles**: Use `figma.getLocalPaintStyles()`, `figma.getLocalTextStyles()`, etc., to update theme-level properties.\n- **Creating Nodes**: Use `figma.createFrame()`, `figma.createText()`, etc., then append to a parent.\n- **Loading Fonts**: Must call `figma.loadFontAsync()` before modifying text content.\n\n## Reference Materials\n\nFor specific code snippets and API patterns, see:\n\n- [references/figma-api-cheatsheet.md](references/figma-api-cheatsheet.md) - Quick reference for common operations\n\n## Safety Guidelines\n\n1. **Check for existence**: Always verify `typeof figma !== \'undefined\'` before running scripts.\n2. **Batch changes**: Figma is performant, but extremely large `findAll` operations on massive files can hang the tab. Use specific parent nodes as starting points when possible.\n3. **Undo support**: Modifications are part of the standard Figma undo history.\n4. **Font loading**: Always load fonts before modifying text content or you\'ll get errors.\n5. **Readonly properties**: Some properties are readonly (e.g., `id`, `type`, `parent`). Check docs before setting.\n6. **Clone before modify**: When working with arrays like `fills` or `strokes`, clone them before modifying.\n\n## Limitations\n\n- **No network access**: The Plugin API cannot make fetch requests directly.\n- **No file system**: Cannot read/write local files.\n- **Async operations**: Font loading and image operations are async - handle appropriately.\n- **Read-only in viewer mode**: When viewing a file you don\'t own, modifications may be restricted.\n',_=`# Figma Plugin API Cheatsheet

## Table of Contents

1. [Document & Pages](#document--pages)
2. [Finding Nodes](#finding-nodes)
3. [Creating Nodes](#creating-nodes)
4. [Geometry & Layout](#geometry--layout)
5. [Colors & Paints](#colors--paints)
6. [Styles](#styles)
7. [Text](#text)
8. [Effects](#effects)
9. [Strokes](#strokes)
10. [Components & Instances](#components--instances)
11. [Variables](#variables)
12. [Export](#export)
13. [Selection & Viewport](#selection--viewport)
14. [Plugin Data](#plugin-data)
15. [Utility Functions](#utility-functions)

---

## Document & Pages

### Basic Navigation

\`\`\`javascript
// Get document root
const doc = figma.root;

// List all pages
const pageNames = figma.root.children.map((p) => p.name);

// Get current page
const page = figma.currentPage;

// Change to a specific page
const targetPage = figma.root.children.find((p) => p.name === "Design");
if (targetPage) figma.currentPage = targetPage;

// Create a new page
const newPage = figma.createPage();
newPage.name = "New Page";

// Get file name (from document)
const fileName = figma.root.name;
\`\`\`

### Page Properties

\`\`\`javascript
// Get/set page background
const bg = figma.currentPage.backgrounds;
figma.currentPage.backgrounds = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];

// Page-level layout grids
figma.currentPage.guides; // Ruler guides
\`\`\`

---

## Finding Nodes

### Search Methods

\`\`\`javascript
// Find all matching nodes (returns array)
const allFrames = figma.currentPage.findAll((n) => n.type === "FRAME");

// Find first matching node (returns single node or null)
const header = figma.currentPage.findOne((n) => n.name === "Header");

// Find by ID
const node = figma.getNodeById("123:456");

// Find children (direct only, not recursive)
const directChildren = frame.children.filter((n) => n.type === "TEXT");

// Find all nodes of specific types
const shapes = figma.currentPage.findAll((n) =>
  ["RECTANGLE", "ELLIPSE", "POLYGON", "STAR", "LINE", "VECTOR"].includes(n.type)
);
\`\`\`

### Common Search Patterns

\`\`\`javascript
// Find by name (exact match)
const byName = figma.currentPage.findAll((n) => n.name === "Button");

// Find by name (contains)
const byNameContains = figma.currentPage.findAll((n) => n.name.includes("icon"));

// Find by name (regex)
const byRegex = figma.currentPage.findAll((n) => /^btn-/.test(n.name));

// Find visible nodes only
const visible = figma.currentPage.findAll((n) => n.visible === true);

// Find locked nodes
const locked = figma.currentPage.findAll((n) => n.locked === true);

// Find by plugin data
const tagged = figma.currentPage.findAll(
  (n) => n.getPluginData && n.getPluginData("myKey") === "myValue"
);
\`\`\`

### Type Guards

\`\`\`javascript
// Check node type safely
if (node.type === "TEXT") {
  // node is TextNode
  console.log(node.characters);
}

// Check for specific mixins
if ("fills" in node) {
  // node has fills property
}

if ("children" in node) {
  // node is a container (Frame, Group, Component, etc.)
}
\`\`\`

---

## Creating Nodes

### Basic Shapes

\`\`\`javascript
// Rectangle
const rect = figma.createRectangle();
rect.resize(100, 50);
rect.x = 0;
rect.y = 0;
rect.fills = [{ type: "SOLID", color: { r: 0.5, g: 0.5, b: 1 } }];
figma.currentPage.appendChild(rect);

// Ellipse
const ellipse = figma.createEllipse();
ellipse.resize(100, 100);
figma.currentPage.appendChild(ellipse);

// Polygon
const polygon = figma.createPolygon();
polygon.pointCount = 6; // Hexagon
polygon.resize(100, 100);
figma.currentPage.appendChild(polygon);

// Star
const star = figma.createStar();
star.pointCount = 5;
star.innerRadius = 0.4; // 0-1, ratio of inner to outer radius
star.resize(100, 100);
figma.currentPage.appendChild(star);

// Line
const line = figma.createLine();
line.resize(200, 0);
line.strokes = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
figma.currentPage.appendChild(line);
\`\`\`

### Containers

\`\`\`javascript
// Frame
const frame = figma.createFrame();
frame.name = "Container";
frame.resize(400, 300);
frame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
figma.currentPage.appendChild(frame);

// Section (FigJam-style container)
const section = figma.createSection();
section.name = "Section";
section.resizeWithoutConstraints(500, 400);
figma.currentPage.appendChild(section);

// Group existing nodes
const group = figma.group([node1, node2, node3], figma.currentPage);
group.name = "My Group";

// Ungroup
const parent = group.parent;
const children = [...group.children];
for (const child of children) {
  parent.appendChild(child);
}
group.remove();
\`\`\`

### Text

\`\`\`javascript
// Create text (async - requires font loading)
const text = figma.createText();
await figma.loadFontAsync({ family: "Inter", style: "Regular" });
text.characters = "Hello World";
text.fontSize = 24;
figma.currentPage.appendChild(text);
\`\`\`

### Vector Paths

\`\`\`javascript
// Create vector from SVG path data
const vector = figma.createVector();
vector.vectorPaths = [
  {
    windingRule: "EVENODD",
    data: "M 0 0 L 100 0 L 100 100 L 0 100 Z",
  },
];
figma.currentPage.appendChild(vector);
\`\`\`

### Boolean Operations

\`\`\`javascript
// Create boolean operation
const union = figma.union([rect1, rect2], figma.currentPage);
const subtract = figma.subtract([rect1, rect2], figma.currentPage);
const intersect = figma.intersect([rect1, rect2], figma.currentPage);
const exclude = figma.exclude([rect1, rect2], figma.currentPage);

// Flatten to vector (merge paths)
const flattened = figma.flatten([node1, node2]);
\`\`\`

---

## Geometry & Layout

### Position & Size

\`\`\`javascript
// Position (relative to parent)
node.x = 100;
node.y = 50;

// Size
node.resize(200, 100);

// Get absolute position (in page coordinates)
const absX = node.absoluteTransform[0][2];
const absY = node.absoluteTransform[1][2];

// Get bounding box
const bounds = node.absoluteBoundingBox;
// { x, y, width, height }

// Rotation (degrees)
node.rotation = 45;
\`\`\`

### Constraints

\`\`\`javascript
// Set constraints (how node behaves when parent resizes)
node.constraints = {
  horizontal: "MIN", // "MIN" | "CENTER" | "MAX" | "STRETCH" | "SCALE"
  vertical: "MIN", // "MIN" | "CENTER" | "MAX" | "STRETCH" | "SCALE"
};
\`\`\`

### Auto Layout (Frames)

\`\`\`javascript
// Enable auto layout
frame.layoutMode = "HORIZONTAL"; // "HORIZONTAL" | "VERTICAL" | "NONE"

// Spacing
frame.itemSpacing = 16; // Gap between children
frame.paddingTop = 20;
frame.paddingRight = 20;
frame.paddingBottom = 20;
frame.paddingLeft = 20;

// Or set all padding at once
frame.paddingTop = frame.paddingRight = frame.paddingBottom = frame.paddingLeft = 20;

// Alignment
frame.primaryAxisAlignItems = "MIN"; // "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN"
frame.counterAxisAlignItems = "MIN"; // "MIN" | "CENTER" | "MAX" | "BASELINE"

// Sizing behavior
frame.primaryAxisSizingMode = "AUTO"; // "AUTO" | "FIXED"
frame.counterAxisSizingMode = "AUTO"; // "AUTO" | "FIXED"

// Layout wrap
frame.layoutWrap = "WRAP"; // "NO_WRAP" | "WRAP"

// Child layout properties
child.layoutAlign = "STRETCH"; // "MIN" | "CENTER" | "MAX" | "STRETCH" | "INHERIT"
child.layoutGrow = 1; // 0 = fixed, 1 = fill
\`\`\`

### Corner Radius

\`\`\`javascript
// Uniform corners
rect.cornerRadius = 8;

// Individual corners (topLeft, topRight, bottomRight, bottomLeft)
rect.topLeftRadius = 8;
rect.topRightRadius = 8;
rect.bottomRightRadius = 0;
rect.bottomLeftRadius = 0;

// Check if mixed
if (rect.cornerRadius === figma.mixed) {
  // Corners have different values
}
\`\`\`

---

## Colors & Paints

### Color Conversions

\`\`\`javascript
// HEX to Figma RGB (0-1 range)
function hexToRgb(hex) {
  hex = hex.replace("#", "");
  return {
    r: parseInt(hex.substring(0, 2), 16) / 255,
    g: parseInt(hex.substring(2, 4), 16) / 255,
    b: parseInt(hex.substring(4, 6), 16) / 255,
  };
}

// Figma RGB to HEX
function rgbToHex(r, g, b) {
  const toHex = (n) =>
    Math.round(n * 255)
      .toString(16)
      .padStart(2, "0");
  return \`#\${toHex(r)}\${toHex(g)}\${toHex(b)}\`;
}

// RGBA with opacity
function hexToRgba(hex, opacity = 1) {
  const rgb = hexToRgb(hex);
  return { ...rgb, a: opacity };
}
\`\`\`

### Paint Types

\`\`\`javascript
// Solid color
const solidPaint = {
  type: "SOLID",
  color: { r: 0.5, g: 0.5, b: 1 },
  opacity: 0.8, // Optional, 0-1
};

// Linear gradient
const linearGradient = {
  type: "GRADIENT_LINEAR",
  gradientTransform: [
    [1, 0, 0],
    [0, 1, 0],
  ], // 2x3 matrix
  gradientStops: [
    { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
    { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } },
  ],
};

// Radial gradient
const radialGradient = {
  type: "GRADIENT_RADIAL",
  gradientTransform: [
    [1, 0, 0.5],
    [0, 1, 0.5],
  ],
  gradientStops: [
    { position: 0, color: { r: 1, g: 1, b: 1, a: 1 } },
    { position: 1, color: { r: 0, g: 0, b: 0, a: 1 } },
  ],
};

// Image fill
const imagePaint = {
  type: "IMAGE",
  scaleMode: "FILL", // "FILL" | "FIT" | "CROP" | "TILE"
  imageHash: "abc123", // Set via figma.createImage()
};
\`\`\`

### Working with Fills

\`\`\`javascript
// Get fills (always clone before modifying!)
const fills = [...node.fills];

// Set solid fill
node.fills = [{ type: "SOLID", color: hexToRgb("FF5733") }];

// Add fill (preserve existing)
node.fills = [...node.fills, { type: "SOLID", color: { r: 1, g: 0, b: 0 } }];

// Remove all fills
node.fills = [];

// Modify existing fill
const fills = [...node.fills];
if (fills[0]?.type === "SOLID") {
  fills[0] = { ...fills[0], color: { r: 0, g: 1, b: 0 } };
  node.fills = fills;
}

// Check fill visibility
const fills = [...node.fills];
fills[0].visible = false;
node.fills = fills;
\`\`\`

---

## Styles

### Paint Styles (Colors)

\`\`\`javascript
// Get all local paint styles
const paintStyles = figma.getLocalPaintStyles();

// Find specific style
const primaryStyle = paintStyles.find((s) => s.name === "Primary");

// Get style properties
console.log(primaryStyle.paints); // Array of paints
console.log(primaryStyle.description);

// Update style
primaryStyle.paints = [{ type: "SOLID", color: hexToRgb("007AFF") }];

// Create new style
const newStyle = figma.createPaintStyle();
newStyle.name = "Brand/Secondary";
newStyle.paints = [{ type: "SOLID", color: hexToRgb("5856D6") }];

// Apply style to node
node.fillStyleId = primaryStyle.id;

// Remove style binding (keep appearance)
node.fillStyleId = "";
\`\`\`

### Text Styles

\`\`\`javascript
// Get all text styles
const textStyles = figma.getLocalTextStyles();

// Get style properties
const headingStyle = textStyles.find((s) => s.name === "Heading/H1");
console.log(headingStyle.fontName); // { family, style }
console.log(headingStyle.fontSize);
console.log(headingStyle.lineHeight); // { value, unit } or { unit: "AUTO" }
console.log(headingStyle.letterSpacing);
console.log(headingStyle.textCase);
console.log(headingStyle.textDecoration);

// Create text style
const newTextStyle = figma.createTextStyle();
newTextStyle.name = "Body/Regular";
newTextStyle.fontName = { family: "Inter", style: "Regular" };
newTextStyle.fontSize = 16;
newTextStyle.lineHeight = { value: 150, unit: "PERCENT" };

// Apply to text node
textNode.textStyleId = headingStyle.id;
\`\`\`

### Effect Styles

\`\`\`javascript
// Get effect styles
const effectStyles = figma.getLocalEffectStyles();

// Create effect style
const shadowStyle = figma.createEffectStyle();
shadowStyle.name = "Shadow/Medium";
shadowStyle.effects = [
  {
    type: "DROP_SHADOW",
    color: { r: 0, g: 0, b: 0, a: 0.25 },
    offset: { x: 0, y: 4 },
    radius: 8,
    spread: 0,
    visible: true,
    blendMode: "NORMAL",
  },
];

// Apply effect style
node.effectStyleId = shadowStyle.id;
\`\`\`

### Grid Styles

\`\`\`javascript
// Get grid styles
const gridStyles = figma.getLocalGridStyles();

// Create grid style
const gridStyle = figma.createGridStyle();
gridStyle.name = "8pt Grid";
gridStyle.layoutGrids = [
  {
    pattern: "GRID",
    sectionSize: 8,
    color: { r: 1, g: 0, b: 0, a: 0.1 },
    visible: true,
  },
];
\`\`\`

---

## Text

### Font Loading (Required!)

\`\`\`javascript
// Load a single font
await figma.loadFontAsync({ family: "Inter", style: "Regular" });

// Load multiple fonts
await Promise.all([
  figma.loadFontAsync({ family: "Inter", style: "Regular" }),
  figma.loadFontAsync({ family: "Inter", style: "Bold" }),
  figma.loadFontAsync({ family: "Inter", style: "Italic" }),
]);

// Load font used by existing text node
const textNode = figma.currentPage.findOne((n) => n.type === "TEXT");
if (textNode.fontName !== figma.mixed) {
  await figma.loadFontAsync(textNode.fontName);
}

// Handle mixed fonts
if (textNode.fontName === figma.mixed) {
  // Get all fonts used in the text
  const len = textNode.characters.length;
  const fonts = new Set();
  for (let i = 0; i < len; i++) {
    const font = textNode.getRangeFontName(i, i + 1);
    fonts.add(JSON.stringify(font));
  }
  // Load all unique fonts
  await Promise.all([...fonts].map((f) => figma.loadFontAsync(JSON.parse(f))));
}
\`\`\`

### Text Content

\`\`\`javascript
// Set text content (font must be loaded first!)
textNode.characters = "New text content";

// Insert text at position
textNode.insertCharacters(5, " inserted ");

// Delete text range
textNode.deleteCharacters(0, 5);

// Get text content
const content = textNode.characters;
\`\`\`

### Text Formatting

\`\`\`javascript
// Whole node formatting
textNode.fontSize = 24;
textNode.fontName = { family: "Inter", style: "Bold" };
textNode.textAlignHorizontal = "CENTER"; // "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED"
textNode.textAlignVertical = "CENTER"; // "TOP" | "CENTER" | "BOTTOM"
textNode.lineHeight = { value: 150, unit: "PERCENT" }; // or { unit: "AUTO" }
textNode.letterSpacing = { value: 2, unit: "PERCENT" }; // or { unit: "PIXELS" }
textNode.textCase = "UPPER"; // "ORIGINAL" | "UPPER" | "LOWER" | "TITLE"
textNode.textDecoration = "UNDERLINE"; // "NONE" | "UNDERLINE" | "STRIKETHROUGH"

// Range formatting (style specific characters)
textNode.setRangeFontSize(0, 5, 32);
textNode.setRangeFontName(0, 5, { family: "Inter", style: "Bold" });
textNode.setRangeFills(0, 5, [{ type: "SOLID", color: { r: 1, g: 0, b: 0 } }]);
textNode.setRangeTextDecoration(0, 5, "UNDERLINE");
\`\`\`

### Text Auto-Resize

\`\`\`javascript
// Text resize behavior
textNode.textAutoResize = "WIDTH_AND_HEIGHT"; // Auto-size both
textNode.textAutoResize = "HEIGHT"; // Fixed width, auto height
textNode.textAutoResize = "NONE"; // Fixed size
textNode.textAutoResize = "TRUNCATE"; // Fixed size, truncate overflow
\`\`\`

### Hyperlinks

\`\`\`javascript
// Set hyperlink on range
textNode.setRangeHyperlink(0, 10, { type: "URL", value: "https://example.com" });

// Link to node
textNode.setRangeHyperlink(0, 10, { type: "NODE", value: someNode.id });

// Remove hyperlink
textNode.setRangeHyperlink(0, 10, null);
\`\`\`

---

## Effects

### Effect Types

\`\`\`javascript
// Drop shadow
const dropShadow = {
  type: "DROP_SHADOW",
  color: { r: 0, g: 0, b: 0, a: 0.25 },
  offset: { x: 0, y: 4 },
  radius: 8,
  spread: 0,
  visible: true,
  blendMode: "NORMAL",
};

// Inner shadow
const innerShadow = {
  type: "INNER_SHADOW",
  color: { r: 0, g: 0, b: 0, a: 0.1 },
  offset: { x: 0, y: 2 },
  radius: 4,
  spread: 0,
  visible: true,
  blendMode: "NORMAL",
};

// Layer blur
const layerBlur = {
  type: "LAYER_BLUR",
  radius: 10,
  visible: true,
};

// Background blur
const backgroundBlur = {
  type: "BACKGROUND_BLUR",
  radius: 20,
  visible: true,
};
\`\`\`

### Working with Effects

\`\`\`javascript
// Set effects
node.effects = [dropShadow, innerShadow];

// Add effect
node.effects = [...node.effects, layerBlur];

// Modify existing effect
const effects = [...node.effects];
effects[0] = { ...effects[0], radius: 16 };
node.effects = effects;

// Remove all effects
node.effects = [];
\`\`\`

---

## Strokes

### Stroke Properties

\`\`\`javascript
// Set stroke color
node.strokes = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];

// Stroke weight
node.strokeWeight = 2;

// Individual stroke weights (for rectangles)
node.strokeTopWeight = 1;
node.strokeRightWeight = 2;
node.strokeBottomWeight = 1;
node.strokeLeftWeight = 2;

// Stroke alignment
node.strokeAlign = "CENTER"; // "CENTER" | "INSIDE" | "OUTSIDE"

// Stroke cap (for open paths)
node.strokeCap = "ROUND"; // "NONE" | "ROUND" | "SQUARE" | "LINE_ARROW" | "TRIANGLE_ARROW"

// Stroke join
node.strokeJoin = "ROUND"; // "MITER" | "BEVEL" | "ROUND"

// Dashed stroke
node.dashPattern = [10, 5]; // [dash, gap, dash, gap, ...]

// Miter limit
node.strokeMiterLimit = 4;
\`\`\`

---

## Components & Instances

### Working with Components

\`\`\`javascript
// Create component
const component = figma.createComponent();
component.name = "Button";
component.resize(200, 48);

// Find all components
const components = figma.currentPage.findAll((n) => n.type === "COMPONENT");

// Get component set (variants parent)
const componentSet = component.parent;
if (componentSet?.type === "COMPONENT_SET") {
  console.log(componentSet.name);
}

// Get variant properties
if (component.parent?.type === "COMPONENT_SET") {
  console.log(component.variantProperties); // { State: "Default", Size: "Medium" }
}
\`\`\`

### Creating Instances

\`\`\`javascript
// Create instance from component
const instance = component.createInstance();
instance.x = 100;
instance.y = 100;

// Find all instances of a component
const instances = figma.currentPage.findAll(
  (n) => n.type === "INSTANCE" && n.mainComponent?.id === component.id
);
\`\`\`

### Instance Overrides

\`\`\`javascript
// Get main component
const mainComponent = instance.mainComponent;

// Swap instance to different component
instance.swapComponent(anotherComponent);

// Reset all overrides
instance.resetOverrides();

// Detach instance (convert to frame)
const detached = instance.detachInstance();

// Access nested instance
const nestedInstance = instance.findOne((n) => n.name === "Icon");
if (nestedInstance?.type === "INSTANCE") {
  nestedInstance.swapComponent(newIconComponent);
}
\`\`\`

### Component Properties

\`\`\`javascript
// Get component properties (on component)
const propDefs = component.componentPropertyDefinitions;

// Set component property values (on instance)
instance.setProperties({
  "Property Name": "new value",
  "Boolean Property": true,
});

// Read instance property values
const props = instance.componentProperties;
\`\`\`

---

## Variables

### Variable Collections

\`\`\`javascript
// Get all local variable collections
const collections = figma.variables.getLocalVariableCollections();

// Get variables in a collection
const collection = collections.find((c) => c.name === "Colors");
const variableIds = collection.variableIds;
const variables = variableIds.map((id) => figma.variables.getVariableById(id));

// Create new collection
const newCollection = figma.variables.createVariableCollection("Spacing");

// Add mode to collection
const modeId = newCollection.addMode("Dark");

// Rename mode
newCollection.renameMode(modeId, "Dark Theme");
\`\`\`

### Working with Variables

\`\`\`javascript
// Create variable
const colorVar = figma.variables.createVariable(
  "Primary", // name
  collection.id, // collection ID
  "COLOR" // type: "BOOLEAN" | "STRING" | "FLOAT" | "COLOR"
);

// Set variable value (per mode)
colorVar.setValueForMode(collection.defaultModeId, { r: 0, g: 0.5, b: 1 });

// Get variable value
const value = colorVar.valuesByMode[collection.defaultModeId];

// Bind variable to node property
node.setBoundVariable("fills", colorVar);

// Unbind variable
node.setBoundVariable("fills", null);

// Check variable binding
const boundVar = node.boundVariables?.fills;
\`\`\`

---

## Export

### Export Settings

\`\`\`javascript
// PNG export
const pngSettings = {
  format: "PNG",
  suffix: "",
  constraint: { type: "SCALE", value: 2 }, // 2x
};

// SVG export
const svgSettings = {
  format: "SVG",
  svgIdAttribute: true,
  svgOutlineText: true,
  svgSimplifyStroke: true,
};

// PDF export
const pdfSettings = {
  format: "PDF",
};

// JPG export
const jpgSettings = {
  format: "JPG",
  quality: 80, // 0-100
};
\`\`\`

### Exporting Nodes

\`\`\`javascript
// Export single node
const bytes = await node.exportAsync({
  format: "PNG",
  constraint: { type: "SCALE", value: 2 },
});

// Export as base64
const base64 = figma.base64Encode(bytes);

// Add export settings to node (visible in export panel)
node.exportSettings = [
  { format: "PNG", suffix: "@2x", constraint: { type: "SCALE", value: 2 } },
  { format: "SVG", suffix: "" },
];
\`\`\`

---

## Selection & Viewport

### Selection

\`\`\`javascript
// Get current selection
const selection = figma.currentPage.selection;

// Set selection
figma.currentPage.selection = [node1, node2];

// Clear selection
figma.currentPage.selection = [];

// Add to selection
figma.currentPage.selection = [...figma.currentPage.selection, newNode];
\`\`\`

### Viewport

\`\`\`javascript
// Zoom to selection
figma.viewport.scrollAndZoomIntoView(figma.currentPage.selection);

// Zoom to specific nodes
figma.viewport.scrollAndZoomIntoView([node1, node2]);

// Get viewport bounds
const bounds = figma.viewport.bounds; // { x, y, width, height }

// Set viewport position and zoom
figma.viewport.center = { x: 500, y: 300 };
figma.viewport.zoom = 0.5; // 50%
\`\`\`

### User Info

\`\`\`javascript
// Get current user
const user = figma.currentUser;
console.log(user.name);
console.log(user.id);
console.log(user.photoUrl);
console.log(user.color); // User's cursor color

// Get active users (multiplayer)
const activeUsers = figma.activeUsers;
\`\`\`

---

## Plugin Data

### Node-Level Data

\`\`\`javascript
// Store data on a node
node.setPluginData("myKey", "myValue");

// Get data from a node
const value = node.getPluginData("myKey");

// Get all keys
const keys = node.getPluginDataKeys();

// Delete data
node.setPluginData("myKey", ""); // Empty string removes
\`\`\`

### Shared Plugin Data

\`\`\`javascript
// Data readable by any plugin (with namespace)
node.setSharedPluginData("com.example.myplugin", "key", "value");
const value = node.getSharedPluginData("com.example.myplugin", "key");
\`\`\`

### Document-Level Data

\`\`\`javascript
// Store on document root
figma.root.setPluginData("fileSettings", JSON.stringify({ version: 1 }));

// Retrieve
const settings = JSON.parse(figma.root.getPluginData("fileSettings") || "{}");
\`\`\`

---

## Utility Functions

### Useful Helpers

\`\`\`javascript
// Clone a node
const clone = node.clone();

// Remove a node
node.remove();

// Check if node exists
const exists = figma.getNodeById(nodeId) !== null;

// Get all parents (ancestors)
function getAncestors(node) {
  const ancestors = [];
  let current = node.parent;
  while (current) {
    ancestors.push(current);
    current = current.parent;
  }
  return ancestors;
}

// Find common ancestor
function findCommonAncestor(nodes) {
  if (nodes.length === 0) return null;
  if (nodes.length === 1) return nodes[0].parent;

  const ancestorSets = nodes.map((n) => new Set(getAncestors(n).map((a) => a.id)));
  const firstAncestors = getAncestors(nodes[0]);

  return firstAncestors.find((a) => ancestorSets.every((set) => set.has(a.id)));
}

// Walk all nodes
function walkTree(node, callback) {
  callback(node);
  if ("children" in node) {
    for (const child of node.children) {
      walkTree(child, callback);
    }
  }
}

// Count nodes by type
function countByType(root) {
  const counts = {};
  walkTree(root, (node) => {
    counts[node.type] = (counts[node.type] || 0) + 1;
  });
  return counts;
}
\`\`\`

### Color Utilities

\`\`\`javascript
// HSL to RGB
function hslToRgb(h, s, l) {
  h /= 360;
  s /= 100;
  l /= 100;
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return { r, g, b };
}

// Lighten/darken color
function adjustBrightness(color, amount) {
  return {
    r: Math.max(0, Math.min(1, color.r + amount)),
    g: Math.max(0, Math.min(1, color.g + amount)),
    b: Math.max(0, Math.min(1, color.b + amount)),
  };
}
\`\`\`

### Batch Operations

\`\`\`javascript
// Batch rename layers
const layers = figma.currentPage.findAll((n) => n.name.startsWith("old-"));
for (const layer of layers) {
  layer.name = layer.name.replace("old-", "new-");
}

// Batch update colors
const nodes = figma.currentPage.findAll((n) => "fills" in n);
for (const node of nodes) {
  const fills = [...node.fills];
  for (let i = 0; i < fills.length; i++) {
    if (
      fills[i].type === "SOLID" &&
      fills[i].color.r === 1 &&
      fills[i].color.g === 0 &&
      fills[i].color.b === 0
    ) {
      fills[i] = { ...fills[i], color: { r: 0, g: 0, b: 1 } };
    }
  }
  node.fills = fills;
}

// Delete all hidden layers
const hidden = figma.currentPage.findAll((n) => n.visible === false);
for (const node of hidden) {
  node.remove();
}
\`\`\`

---

## Common Gotchas

1. **Always clone arrays before modifying**: \`node.fills = [...node.fills]\` not \`node.fills[0] = ...\`
2. **Load fonts before editing text**: \`await figma.loadFontAsync()\` is required
3. **Mixed values**: Properties like \`fontName\` can be \`figma.mixed\` when multiple values exist
4. **Async operations**: Font loading, image creation, and export are async
5. **Read-only properties**: \`id\`, \`type\`, \`parent\`, \`removed\` cannot be set
6. **Node removal**: Accessing a removed node throws an error
7. **Units**: Colors use 0-1 range, not 0-255
`,U=`---
name: gmail-automation
description: Automate Gmail tasks like sending emails, checking the sent folder, and managing drafts using browser automation. Use when the user asks to "send an email to X", "email Y about Z", "check if the email to A was sent", or any task involving interacting with the Gmail web interface.
---

# Gmail Automation

This skill provides a reliable workflow for automating Gmail through the browser. Gmail's interface is highly dynamic; do not rely on hardcoded element references (\`e1\`, \`e2\`, etc.).

## Core Workflow Loop

Gmail frequently re-renders. Always follow this loop for interaction:
1. **Snapshot**: Get a fresh \`getSnapshot(page)\`.
2. **Identify**: Find the element in the YAML by its **Role** and **Accessible Name**.
3. **Reference**: Note the current \`[ref=eN]\` for that specific snapshot.
4. **Interact**: Use \`getElementByRef(page, "eN")\` immediately.

## Common Interaction Points

When looking at the snapshot, look for these specific roles and names:

| Action | Target Role | Target Name |
| :--- | :--- | :--- |
| **Start Email** | \`button\` | "Compose" |
| **Recipient** | \`combobox\` | "To recipients" |
| **Subject** | \`textbox\` | "Subject" |
| **Email Body** | \`textbox\` | "Message Body" |
| **Send** | \`button\` | "Send *(Enter)," |
| **Sent Folder** | \`link\` | "Sent" |
| **Success Check** | \`alert\` | Look for text "Message sent" |

## Robust Handling Tips

- **Dynamic UI**: Gmail's "Compose" window is a dialog. If you can't find the fields, look for a \`dialog\` or \`region\` labeled "New Message" in the snapshot.
- **Recipient Entry**: After using \`type()\` on the "To" field, always send \`page.keyboard.press("Enter")\`. Gmail needs this to convert the text into a recipient "chip."
- **Detached Nodes**: If you get an error that a node is "detached from document," it means Gmail updated the UI. Simply take a new snapshot and find the new \`ref\` for the same element name.
- **Wait for Compose**: After clicking "Compose," use a short timeout or \`page.waitForSelector\` for the compose dialog before taking the next snapshot.

`,z=`---
name: google-flights
description: Search and extract flight information from Google Flights. Use when asked to "find flights", "search for flights", "check flight prices", "book flights on Google Flights", or any task involving flight search, price comparison, or travel planning via Google Flights.
---

# Google Flights

Google Flights is a dynamic SPA where element refs become stale after UI interactions. **Always refresh the snapshot after every major action.**

## Search Workflow

1. **Destination** - Click "Where to?", type city name, wait for suggestions, press \`Enter\` to select
2. **Dates** - Click date field and type directly (e.g., "Apr 16, 2026") + \`Enter\` — more reliable than calendar navigation
3. **Finalize** - Click "Done" in any open dialogs before clicking "Search"

## Extracting Results

- Results split into "Best" and "Cheapest" tabs
- Find flights via \`listitem\` roles in snapshot (each contains price, airline, duration, stops)
- Use "Date grid" / "Price graph" buttons for alternate date pricing

## Key Details

- **Async loading** - Prices load after page; use \`waitForSelector\` for flight list items
- **Modals trap focus** - Calendar, filters require "Done"/"OK" to close
- **Fallback when refs fail**:
  \`\`\`bash
  js -e <<'EOF'
  const btn = await page.evaluateHandle(() =>
    [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Search")
  );
  if (btn) await btn.asElement().click();
  EOF
  \`\`\`
`,G=`---
name: google-sheets
description: Work with Google Sheets through Do Browser workspace APIs. Use when the user asks to create spreadsheets, inspect sheet metadata, read or write ranges, clear or delete data, append rows, apply formatting, or run batch operations in Google Sheets. This skill covers workspace.status(), workspace.current(), workspace.sheets.requestAccess(), workspace.sheets.createSpreadsheet(), workspace.sheets.getSpreadsheet(), workspace.sheets.listSheets(), workspace.sheets.readRange(), workspace.sheets.batchRead(), workspace.sheets.writeRange(), workspace.sheets.batchWrite(), workspace.sheets.appendRows(), workspace.sheets.clearRange(), workspace.sheets.batchClear(), workspace.sheets.setFormat(), and workspace.sheets.batchUpdate().
---

# Google Sheets

Use this skill to operate on Google Sheets from JS eval in Do Browser.

## Scope

- Handle Google Sheets only.
- Do not use this skill for Docs or Slides tasks.

## Method Reference

### \`workspace.status()\`

Returns connection state:

\`\`\`ts
{
  sheetsConnected: boolean;
  scopes: string[];
  accountEmail: string | null;
}
\`\`\`
\`drive.file\` is file-scoped. Existing spreadsheets must be explicitly authorized via Picker before read/write calls succeed.

### \`workspace.current()\`

Returns the current Sheet context, inferred from the active tab (or currently attached tab):

\`\`\`ts
{
  kind: "sheet";
  spreadsheetId: string;
  tabId: number;
  url: string;
  title: string;
}
\`\`\`

Throws if the current tab is not a Google Sheet.

### \`workspace.sheets.requestAccess(input?)\`

Open the Google Picker flow in a new tab to authorize one or more spreadsheets:

\`\`\`ts
await workspace.sheets.requestAccess({
  spreadsheetId?: string; // optional preselection target
  source?: "agent" | "settings";
});
\`\`\`

### \`workspace.sheets.createSpreadsheet(input)\`

Create a new spreadsheet:

\`\`\`ts
await workspace.sheets.createSpreadsheet({
  title: "Q1 Planning",
  locale?: "en_US",
  timeZone?: "America/Los_Angeles",
  sheetTitle?: "Backlog",
  rowCount?: 2000,
  columnCount?: 26,
});
\`\`\`

Returns:

\`\`\`ts
{
  spreadsheetId: string;
  title: string;
  url: string | null;
  sheets: Array<{
    sheetId: number;
    title: string;
    index: number;
    hidden: boolean;
    rowCount: number | null;
    columnCount: number | null;
  }>;
}
\`\`\`

### \`workspace.sheets.getSpreadsheet(input)\`

Fetch spreadsheet metadata:

\`\`\`ts
await workspace.sheets.getSpreadsheet({
  spreadsheetId?: string; // optional, resolves from active sheet tab when omitted
});
\`\`\`

Returns:

\`\`\`ts
{
  spreadsheetId: string;
  title: string;
  url: string | null;
  sheets: Array<{
    sheetId: number; // numeric sheetId for structural batchUpdate operations
    title: string;
    index: number;
    hidden: boolean;
    rowCount: number | null;
    columnCount: number | null;
  }>;
  namedRanges: Array<{
    name: string;
    sheetId: number | null;
    startRowIndex: number | null;
    endRowIndex: number | null;
    startColumnIndex: number | null;
    endColumnIndex: number | null;
  }>;
}
\`\`\`

### \`workspace.sheets.listSheets(input)\`

Fetch tab metadata only (lighter than \`getSpreadsheet\`):

\`\`\`ts
await workspace.sheets.listSheets({
  spreadsheetId?: string;
});
\`\`\`

### \`workspace.sheets.readRange(input)\`

\`\`\`ts
await workspace.sheets.readRange({
  spreadsheetId?: string; // optional; auto-resolved from workspace.current() when omitted
  range: "Sheet1!A1:C20",
  majorDimension?: "ROWS" | "COLUMNS",
  valueRenderOption?: "FORMATTED_VALUE" | "UNFORMATTED_VALUE" | "FORMULA",
  dateTimeRenderOption?: "SERIAL_NUMBER" | "FORMATTED_STRING",
});
\`\`\`

Returns:

\`\`\`ts
{
  spreadsheetId: string;
  range: string;
  majorDimension?: "ROWS" | "COLUMNS";
  values: Array<Array<string | number | boolean | null>>;
}
\`\`\`

### \`workspace.sheets.batchRead(input)\`

Read multiple ranges in one call:

\`\`\`ts
await workspace.sheets.batchRead({
  spreadsheetId?: string;
  ranges: ["Sheet1!A1:B10", "Sheet1!D1:E10"],
  valueRenderOption: "UNFORMATTED_VALUE",
});
\`\`\`

### \`workspace.sheets.writeRange(input)\`

\`\`\`ts
await workspace.sheets.writeRange({
  spreadsheetId?: string;
  range: "Sheet1!A1:C3",
  values: [
    ["Name", "Score", "Passed"],
    ["Ava", 95, true],
  ],
  valueInputOption: "RAW" // or "USER_ENTERED"
});
\`\`\`

Returns update counts and updated range.

### \`workspace.sheets.batchWrite(input)\`

Write multiple ranges in one call:

\`\`\`ts
await workspace.sheets.batchWrite({
  spreadsheetId?: string,
  valueInputOption: "RAW",
  data: [
    { range: "Sheet1!A1:B2", values: [["a", "b"], [1, 2]] },
    { range: "Sheet1!D1:D2", values: [[true], [false]] },
  ],
});
\`\`\`

### \`workspace.sheets.appendRows(input)\`

\`\`\`ts
await workspace.sheets.appendRows({
  spreadsheetId?: string;
  range: "Sheet1!A:C",
  values: [
    ["2026-02-17", "north", 1200],
  ],
  valueInputOption: "RAW" // or "USER_ENTERED"
});
\`\`\`

Returns append metadata (\`tableRange\`, \`updatedRange\`, \`updatedRows\`, \`updatedCells\`).

### \`workspace.sheets.clearRange(input)\`

Clear values in a single range while keeping structure:

\`\`\`ts
await workspace.sheets.clearRange({
  spreadsheetId?: string;
  range: "Sheet1!B2:D6";
});
\`\`\`

### \`workspace.sheets.batchClear(input)\`

Clear values in multiple ranges:

\`\`\`ts
await workspace.sheets.batchClear({
  spreadsheetId?: string;
  ranges: ["Sheet1!B2:D6", "Sheet1!G2:G100"];
});
\`\`\`

### \`workspace.sheets.setFormat(input)\` (client-side helper)

High-level A1-first formatting helper. Internally this is converted to a \`batchUpdate\` call in the client.

\`\`\`ts
await workspace.sheets.setFormat({
  spreadsheetId?: string;
  range: "A1:G1"; // bounded A1 only
  sheet?: { sheetTitle: "Sheet1" } | { sheetId: 0 }; // optional if range already includes sheet
  format: {
    text?: {
      bold?: boolean;
      italic?: boolean;
      underline?: boolean;
      strikethrough?: boolean;
      fontSize?: number;
      fontFamily?: string;
      color?: "#RRGGBB";
    };
    fillColor?: "#RRGGBB";
    horizontalAlign?: "LEFT" | "CENTER" | "RIGHT";
    verticalAlign?: "TOP" | "MIDDLE" | "BOTTOM";
    wrapStrategy?: "OVERFLOW_CELL" | "CLIP" | "WRAP";
    numberFormat?: {
      type:
        | "TEXT"
        | "NUMBER"
        | "PERCENT"
        | "CURRENCY"
        | "DATE"
        | "TIME"
        | "DATE_TIME"
        | "SCIENTIFIC";
      pattern?: string;
    };
    borders?: {
      top?: { style: "NONE" | "SOLID" | "SOLID_MEDIUM" | "SOLID_THICK" | "DOTTED" | "DASHED" | "DOUBLE"; color?: "#RRGGBB" };
      right?: { style: "NONE" | "SOLID" | "SOLID_MEDIUM" | "SOLID_THICK" | "DOTTED" | "DASHED" | "DOUBLE"; color?: "#RRGGBB" };
      bottom?: { style: "NONE" | "SOLID" | "SOLID_MEDIUM" | "SOLID_THICK" | "DOTTED" | "DASHED" | "DOUBLE"; color?: "#RRGGBB" };
      left?: { style: "NONE" | "SOLID" | "SOLID_MEDIUM" | "SOLID_THICK" | "DOTTED" | "DASHED" | "DOUBLE"; color?: "#RRGGBB" };
    };
  };
});
\`\`\`

Example:

\`\`\`ts
await workspace.sheets.setFormat({
  spreadsheetId,
  sheet: { sheetTitle: "Top Albums" },
  range: "A1:G1",
  format: {
    text: { bold: true, color: "#FFFFFF" },
    fillColor: "#1E40AF",
    horizontalAlign: "CENTER",
  },
});
\`\`\`

### \`workspace.sheets.batchUpdate(input)\`

Passes raw Google Sheets \`batchUpdate\` requests:

\`\`\`ts
await workspace.sheets.batchUpdate({
  spreadsheetId?: string;
  requests: [
    { addSheet: { properties: { title: "Backup" } } }
  ]
});
\`\`\`

Use this for structural or advanced operations that are not covered by \`setFormat\`, \`readRange\`, \`writeRange\`, or \`appendRows\`.

### Deleting / clearing ranges

Interpret "delete range" first:

- Clear values only (keep sheet structure): use \`clearRange\` (or \`batchClear\`).
- Delete cells/rows/columns structurally: use \`batchUpdate\` (\`deleteRange\` / \`deleteDimension\`).

Clear values example:

\`\`\`ts
await workspace.sheets.clearRange({
  spreadsheetId,
  range: "Sheet1!B2:D6",
});
\`\`\`

Structural delete example (shift rows up):

\`\`\`ts
const meta = await workspace.sheets.listSheets({ spreadsheetId });
const sheetId = meta.sheets.find((s) => s.title === "Sheet1")?.sheetId;
if (sheetId == null) throw new Error("Sheet1 not found");

await workspace.sheets.batchUpdate({
  spreadsheetId,
  requests: [
    {
      deleteRange: {
        range: {
          sheetId, // numeric Google sheetId
          startRowIndex: 1,
          endRowIndex: 6,
          startColumnIndex: 1,
          endColumnIndex: 4,
        },
        shiftDimension: "ROWS",
      },
    },
  ],
});
\`\`\`

Important: structural delete requests need numeric \`sheetId\` (from \`listSheets\` / \`getSpreadsheet\`).

## Standard Workflow

1. Check access with \`workspace.status()\`.
2. If disconnected, ask the user to connect Sheets.
3. For existing spreadsheets under \`drive.file\`, run \`workspace.sheets.requestAccess({ spreadsheetId? })\` before read/write if access is missing.
4. If needed, create a new file with \`createSpreadsheet\`.
5. Resolve context with \`workspace.current()\` unless \`spreadsheetId\` is explicitly provided.
6. For common styling, prefer \`setFormat\` (A1-first).
7. If structural operations are needed, call \`listSheets\` first to get numeric \`sheetId\`.
8. Read data with \`readRange\` or \`batchRead\`.
9. Transform data in JS.
10. Write with \`writeRange\`, \`batchWrite\`, \`appendRows\`, \`clearRange\`, \`batchClear\`, \`setFormat\`, or \`batchUpdate\`.
11. Verify by reading back affected ranges.

## Rules for Reliable Execution

- Prefer explicit ranges with sheet names, like \`Sales!A1:F200\`.
- Keep writes narrow; avoid full-sheet writes unless requested.
- Use \`valueInputOption: "USER_ENTERED"\` for formulas/date parsing; otherwise default to \`"RAW"\`.
- For typed reads, set \`valueRenderOption: "UNFORMATTED_VALUE"\` to preserve numbers/booleans.
- Confirm whether "delete" means clear values or remove cells/rows/columns.
- Use \`batchRead\` / \`batchWrite\` for fewer network round trips.
- Use \`setFormat\` for common formatting (headers, colors, alignment, borders).
- Use \`batchUpdate\` for structural or advanced operations (dimensions, delete/insert/move/protect, unsupported formatting patterns).

## Common Error Meanings

- \`Google Sheets access is not connected. Connect Sheets in Settings.\`  
  The user has not granted Sheets scope yet.
- \`Active tab is not a Google Sheet. Open a Sheet tab or pass spreadsheetId.\`  
  Open the target spreadsheet tab or pass a valid \`spreadsheetId\`.
- \`spreadsheetId is required. Use workspace.current() to resolve the active sheet.\`  
  Supply \`spreadsheetId\` when no Sheet tab is active.
- \`Google Sheets API error (4xx/5xx): ...\`  
  The request shape, range, permissions, or API state is invalid. Surface the message and adjust input.
- \`SHEETS_FILE_NOT_AUTHORIZED: ...\`  
  The target file has not been authorized under \`drive.file\`. Call \`workspace.sheets.requestAccess({ spreadsheetId })\`, then retry.

## Minimal Starter Snippet

\`\`\`ts
const status = await workspace.status();
if (!status.sheetsConnected) {
  throw new Error("Sheets is not connected. Ask the user to connect it in Settings.");
}

const current = await workspace.current();
const meta = await workspace.sheets.listSheets({ spreadsheetId: current.spreadsheetId });
const read = await workspace.sheets.batchRead({
  spreadsheetId: current.spreadsheetId,
  ranges: ["Sheet1!A1:C20"],
  valueRenderOption: "UNFORMATTED_VALUE",
});

const values = read.valueRanges[0]?.values ?? [];
// ...transform values...

await workspace.sheets.writeRange({
  spreadsheetId: current.spreadsheetId,
  range: "Sheet1!E1:G20",
  values,
  valueInputOption: "RAW",
});
\`\`\`
`,$=`---
name: linkedin-messaging
description: Send messages to LinkedIn connections via browser automation. Use when asked to "message someone on LinkedIn", "send a LinkedIn message", "DM on LinkedIn", or any task involving composing and sending messages through LinkedIn's messaging system.
---

# LinkedIn Messaging

## Workflow

1. **Find the recipient** - Search by name, locate the "Message" button (1st-degree connections only; 2nd/3rd+ show "Connect" instead)
2. **Open conversation** - Click "Message" to open the messaging overlay (appears at bottom of page)
3. **Compose message**:
   - Wait for textbox (\`role="textbox"\`) to appear
   - Click to focus before typing with \`page.keyboard.type()\`
   - Send button is disabled until text is entered
4. **Send** - Click Send button once enabled, wait 1-2 seconds for network request

## Key Details

- **Use ARIA roles over CSS classes** - LinkedIn's classes are dynamic; prefer \`role="textbox"\` and \`name="Send"\` or snapshot refs
- **Multiple overlays** - If several message bubbles are open, target the correct one by checking the recipient name in the header
- **Slow UI** - Increase timeouts for \`waitForSelector\`; the messaging UI loads slowly
`,H=`---
name: quiz-creator
description: Generate interactive HTML quizzes from text, blog posts, or documents. Use when a user needs to create a quiz to test knowledge, summarize content, or create educational material. Triggers on requests like "make a quiz about X", "create a test for this article", or "turn this into an interactive quiz".
---

# Quiz Creator

Transform any content into an interactive, sleek HTML quiz.

## Workflow

### 1. Identify Content

Analyze the source text or page to extract 5-10 key concepts or facts.

### 2. Generate Questions

Create multiple-choice questions with the following structure:

- \`q\`: The question text.
- \`options\`: Array of 4 possible answers.
- \`correct\`: Index (0-3) of the correct answer.
- \`insight\`: A brief "why" or additional fact displayed after the answer is chosen.

### 3. Choose a Theme

- **midnight** (default): Dark mode, blue accents, tech-focused.
- **paper**: Light mode, sepia tones, editorial/academic feel.

### 4. Output the HTML

Use the template at \`assets/template.html\` and replace the placeholders:

- \`{{TITLE}}\`: A descriptive title for the quiz.
- \`{{THEME}}\`: The chosen theme name.
- \`{{QUESTIONS_JSON}}\`: A JSON string of the questions array.

## Quality Guidelines

- Focus on conceptual understanding, not just rote facts.
- Ensure only one answer is clearly correct.
- Keep the \`insight\` brief (1-2 sentences).
- Use \`writeFile\` to save the output as \`quiz.html\` and \`open\` to preview it.
- **IMPORTANT**: Do NOT load quiz questions from the filesystem at runtime. Encode all questions directly in the HTML as inline JSON. The quiz must be fully self-contained.

## Example JSON Structure

\`\`\`json
[
  {
    "q": "What is the core principle of the 'Bitter Lesson'?",
    "options": [
      "Human intuition is best",
      "General methods scale with compute",
      "Specialized tools are superior",
      "Data is less important than logic"
    ],
    "correct": 1,
    "insight": "General methods that leverage compute often beat human-curated specialized knowledge."
  }
]
\`\`\`

### Robust Content Extraction

To avoid missing information in long articles due to output truncation:

- **Check for Truncation**: If the content extraction \`js\` call returns a "TRUNCATED" message, read the full file from the path provided in the system message (e.g., \`cat /tmp/truncated-output...\`).
- **Filesystem Bypass**: For extremely long pages, use \`writeFile\` inside the \`page.evaluate\` block (or immediately after) to save the full text to \`/workspace/source_text.txt\`. Then, read it using \`readFile\` or \`bash\` to ensure the model has context for the entire document.
- **Sectional Extraction**: If the article has a table of contents or distinct headers, extract and process it section-by-section to maintain high detail in the generated questions.
`,q=`<!doctype html>
<html lang="en" data-theme="{{THEME}}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{{TITLE}}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap"
      rel="stylesheet"
    />
    <style>
      :root {
        --bg: #050505;
        --surface: #0f0f0f;
        --accent: #3b82f6;
        --accent-glow: rgba(59, 130, 246, 0.4);
        --text: #e5e7eb;
        --text-muted: #9ca3af;
        --border: #1f1f1f;
        --font-heading: "Space Grotesk", sans-serif;
        --font-body: "Space Grotesk", sans-serif;
        --font-mono: "IBM Plex Mono", monospace;
        --success: #10b981;
        --error: #ef4444;
        --transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      }

      /* Paper Theme */
      [data-theme="paper"] {
        --bg: #faf8f5;
        --surface: #f0ece4;
        --accent: #c45d3a;
        --accent-glow: rgba(196, 93, 58, 0.2);
        --text: #2c2825;
        --text-muted: #6b635b;
        --border: #e0dbd3;
      }

      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
        -webkit-font-smoothing: antialiased;
      }

      body {
        font-family: var(--font-body);
        background-color: var(--bg);
        color: var(--text);
        display: flex;
        justify-content: center;
        align-items: flex-start;
        min-height: 100vh;
        overflow-y: auto;
        padding: 80px 20px;
      }

      .progress-bar {
        position: fixed;
        top: 0;
        left: 0;
        height: 4px;
        background: var(--accent);
        box-shadow: 0 0 20px var(--accent-glow);
        transition: width 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        z-index: 100;
      }

      .container {
        width: 100%;
        max-width: 700px;
        position: relative;
        animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1);
      }

      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translateY(30px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .chip {
        display: inline-block;
        padding: 6px 14px;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 100px;
        font-family: var(--font-mono);
        font-size: 11px;
        font-weight: 500;
        color: var(--accent);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin-bottom: 24px;
      }

      h1 {
        font-family: var(--font-heading);
        font-size: clamp(32px, 8vw, 42px);
        font-weight: 700;
        margin-bottom: 32px;
        line-height: 1.1;
        letter-spacing: -0.02em;
      }

      .question {
        font-size: clamp(18px, 5vw, 22px);
        font-weight: 600;
        line-height: 1.4;
        margin-bottom: 32px;
      }

      .options {
        display: grid;
        gap: 12px;
      }

      .option {
        padding: 20px 24px;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 12px;
        cursor: pointer;
        transition: var(--transition);
        font-weight: 500;
        display: flex;
        align-items: center;
        font-size: 17px;
        color: var(--text-muted);
      }

      .option:hover:not(.selected):not(.correct):not(.wrong) {
        border-color: var(--accent);
        color: var(--text);
        transform: translateX(8px);
      }

      .option.correct {
        border-color: var(--success);
        background-color: rgba(16, 185, 129, 0.05);
        color: var(--success);
        box-shadow: 0 0 20px rgba(16, 185, 129, 0.1);
      }

      .option.wrong {
        border-color: var(--error);
        background-color: rgba(239, 68, 68, 0.05);
        color: var(--error);
      }

      .footer {
        margin-top: 40px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        min-height: 60px;
        gap: 20px;
        flex-wrap: wrap;
      }

      #feedback {
        font-family: var(--font-mono);
        font-size: 14px;
      }

      button {
        background-color: var(--accent);
        color: white;
        border: none;
        padding: 14px 28px;
        border-radius: 8px;
        font-weight: 600;
        font-family: var(--font-heading);
        font-size: 15px;
        cursor: pointer;
        transition: var(--transition);
      }

      button:disabled {
        opacity: 0.2;
        cursor: not-allowed;
      }

      .score-box {
        display: none;
      }

      #final-score {
        font-family: var(--font-heading);
        font-size: clamp(48px, 15vw, 72px);
        font-weight: 800;
        color: var(--accent);
        margin: 8px 0 24px 0;
        letter-spacing: -0.04em;
      }

      .insight {
        margin-top: 32px;
        padding: 20px 24px;
        background: var(--surface);
        border-left: 3px solid var(--accent);
        font-family: var(--font-mono);
        font-size: 14px;
        line-height: 1.6;
        color: var(--text-muted);
      }
    </style>
  </head>
  <body>
    <div class="progress-bar" id="progress"></div>
    <div class="container">
      <div id="quiz-content">
        <div class="chip" id="chip-text">Question 1 of 5</div>
        <h1 id="heading">{{TITLE}}</h1>
        <div class="question" id="question"></div>
        <div class="options" id="options"></div>
        <div id="insight-container"></div>
        <div class="footer">
          <span id="feedback"></span>
          <button id="next-btn" disabled>Continue</button>
        </div>
      </div>
      <div id="result-content" class="score-box">
        <div class="chip">Final Result</div>
        <h1>Quiz Complete</h1>
        <div id="final-score"></div>
        <p class="final-msg" id="final-message"></p>
        <button onclick="location.reload()">Restart Quiz</button>
      </div>
    </div>
    <script>
      // IMPORTANT: Embed questions directly as inline JSON. Do NOT load from external files.
      const quizData = {{QUESTIONS_JSON}};
      let currentStep = 0;
      let score = 0;
      let selectedOption = null;

      const questionEl = document.getElementById('question');
      const optionsEl = document.getElementById('options');
      const progressBar = document.getElementById('progress');
      const chipText = document.getElementById('chip-text');
      const nextBtn = document.getElementById('next-btn');
      const feedbackEl = document.getElementById('feedback');
      const insightContainer = document.getElementById('insight-container');

      function loadQuestion() {
          const data = quizData[currentStep];
          questionEl.innerText = data.q;
          progressBar.style.width = \`\${(currentStep / quizData.length) * 100}%\`;
          chipText.innerText = \`Question \${currentStep + 1} of \${quizData.length}\`;
          optionsEl.innerHTML = '';
          insightContainer.innerHTML = '';
          selectedOption = null;
          nextBtn.disabled = true;
          nextBtn.innerText = currentStep === quizData.length - 1 ? 'Finish Quiz' : 'Continue';
          feedbackEl.innerText = '';
          data.options.forEach((opt, i) => {
              const div = document.createElement('div');
              div.className = 'option';
              div.innerText = opt;
              div.onclick = () => selectOption(i);
              optionsEl.appendChild(div);
          });
          window.scrollTo({ top: 0, behavior: 'smooth' });
      }

      function selectOption(index) {
          if (selectedOption !== null) return;
          selectedOption = index;
          const options = document.querySelectorAll('.option');
          const data = quizData[currentStep];
          if (index === data.correct) {
              options[index].classList.add('correct');
              score++;
              feedbackEl.innerText = "// Correct";
              feedbackEl.style.color = "var(--success)";
          } else {
              options[index].classList.add('wrong');
              options[data.correct].classList.add('correct');
              feedbackEl.innerText = "// Incorrect";
              feedbackEl.style.color = "var(--error)";
          }
          if (data.insight) insightContainer.innerHTML = \`<div class="insight">// \${data.insight}</div>\`;
          nextBtn.disabled = false;
          progressBar.style.width = \`\${((currentStep + 1) / quizData.length) * 100}%\`;
      }

      nextBtn.onclick = () => {
          currentStep++;
          if (currentStep < quizData.length) loadQuestion();
          else showResults();
      };

      function showResults() {
          document.getElementById('quiz-content').style.display = 'none';
          document.getElementById('result-content').style.display = 'block';
          document.getElementById('final-score').innerText = \`\${score} / \${quizData.length}\`;
          document.getElementById('final-message').innerText = score === quizData.length ? "Excellent!" : "Good effort!";
          window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      loadQuestion();
    <\/script>
  </body>
</html>
`,W=`---
name: skill-creator
description: Guide for creating effective skills. This skill should be used when users want to create a new skill (or update an existing skill) that extends Claude's capabilities with specialized knowledge, workflows, or tool integrations.
license: Complete terms in LICENSE.txt
---

# Skill Creator

This skill provides guidance for creating effective skills.

## About Skills

Skills are modular, self-contained packages that extend Claude's capabilities by providing
specialized knowledge, workflows, and tools. Think of them as "onboarding guides" for specific
domains or tasks—they transform Claude from a general-purpose agent into a specialized agent
equipped with procedural knowledge that no model can fully possess.

### What Skills Provide

1. Specialized workflows - Multi-step procedures for specific domains
2. Tool integrations - Instructions for working with specific file formats or APIs
3. Domain expertise - Company-specific knowledge, schemas, business logic
4. Bundled resources - Scripts, references, and assets for complex and repetitive tasks

## Core Principles

### Concise is Key

The context window is a public good. Skills share the context window with everything else Claude needs: system prompt, conversation history, other Skills' metadata, and the actual user request.

**Default assumption: Claude is already very smart.** Only add context Claude doesn't already have. Challenge each piece of information: "Does Claude really need this explanation?" and "Does this paragraph justify its token cost?"

Prefer concise examples over verbose explanations.

### Set Appropriate Degrees of Freedom

Match the level of specificity to the task's fragility and variability:

**High freedom (text-based instructions)**: Use when multiple approaches are valid, decisions depend on context, or heuristics guide the approach.

**Medium freedom (pseudocode or scripts with parameters)**: Use when a preferred pattern exists, some variation is acceptable, or configuration affects behavior.

**Low freedom (specific scripts, few parameters)**: Use when operations are fragile and error-prone, consistency is critical, or a specific sequence must be followed.

Think of Claude as exploring a path: a narrow bridge with cliffs needs specific guardrails (low freedom), while an open field allows many routes (high freedom).

### Anatomy of a Skill

Every skill consists of a required SKILL.md file and optional bundled resources:

\`\`\`
skill-name/
├── SKILL.md (required)
│   ├── YAML frontmatter metadata (required)
│   │   ├── name: (required)
│   │   └── description: (required)
│   └── Markdown instructions (required)
└── Bundled Resources (optional)
    ├── scripts/          - Executable code (Python/Bash/etc.)
    ├── references/       - Documentation intended to be loaded into context as needed
    └── assets/           - Files used in output (templates, icons, fonts, etc.)
\`\`\`

#### SKILL.md (required)

Every SKILL.md consists of:

- **Frontmatter** (YAML): Contains \`name\` and \`description\` fields. These are the only fields that Claude reads to determine when the skill gets used, thus it is very important to be clear and comprehensive in describing what the skill is, and when it should be used.
- **Body** (Markdown): Instructions and guidance for using the skill. Only loaded AFTER the skill triggers (if at all).

#### Bundled Resources (optional)

##### Scripts (\`scripts/\`)

Executable code (Python/Bash/etc.) for tasks that require deterministic reliability or are repeatedly rewritten.

- **When to include**: When the same code is being rewritten repeatedly or deterministic reliability is needed
- **Example**: \`scripts/rotate_pdf.py\` for PDF rotation tasks
- **Benefits**: Token efficient, deterministic, may be executed without loading into context
- **Note**: Scripts may still need to be read by Claude for patching or environment-specific adjustments

##### References (\`references/\`)

Documentation and reference material intended to be loaded as needed into context to inform Claude's process and thinking.

- **When to include**: For documentation that Claude should reference while working
- **Examples**: \`references/finance.md\` for financial schemas, \`references/mnda.md\` for company NDA template, \`references/policies.md\` for company policies, \`references/api_docs.md\` for API specifications
- **Use cases**: Database schemas, API documentation, domain knowledge, company policies, detailed workflow guides
- **Benefits**: Keeps SKILL.md lean, loaded only when Claude determines it's needed
- **Best practice**: If files are large (>10k words), include grep search patterns in SKILL.md
- **Avoid duplication**: Information should live in either SKILL.md or references files, not both. Prefer references files for detailed information unless it's truly core to the skill—this keeps SKILL.md lean while making information discoverable without hogging the context window. Keep only essential procedural instructions and workflow guidance in SKILL.md; move detailed reference material, schemas, and examples to references files.

##### Assets (\`assets/\`)

Files not intended to be loaded into context, but rather used within the output Claude produces.

- **When to include**: When the skill needs files that will be used in the final output
- **Examples**: \`assets/logo.png\` for brand assets, \`assets/slides.pptx\` for PowerPoint templates, \`assets/frontend-template/\` for HTML/React boilerplate, \`assets/font.ttf\` for typography
- **Use cases**: Templates, images, icons, boilerplate code, fonts, sample documents that get copied or modified
- **Benefits**: Separates output resources from documentation, enables Claude to use files without loading them into context

#### What to Not Include in a Skill

A skill should only contain essential files that directly support its functionality. Do NOT create extraneous documentation or auxiliary files, including:

- README.md
- INSTALLATION_GUIDE.md
- QUICK_REFERENCE.md
- CHANGELOG.md
- etc.

The skill should only contain the information needed for an AI agent to do the job at hand. It should not contain auxilary context about the process that went into creating it, setup and testing procedures, user-facing documentation, etc. Creating additional documentation files just adds clutter and confusion.

### Progressive Disclosure Design Principle

Skills use a three-level loading system to manage context efficiently:

1. **Metadata (name + description)** - Always in context (~100 words)
2. **SKILL.md body** - When skill triggers (<5k words)
3. **Bundled resources** - As needed by Claude (Unlimited because scripts can be executed without reading into context window)

#### Progressive Disclosure Patterns

Keep SKILL.md body to the essentials and under 500 lines to minimize context bloat. Split content into separate files when approaching this limit. When splitting out content into other files, it is very important to reference them from SKILL.md and describe clearly when to read them, to ensure the reader of the skill knows they exist and when to use them.

**Key principle:** When a skill supports multiple variations, frameworks, or options, keep only the core workflow and selection guidance in SKILL.md. Move variant-specific details (patterns, examples, configuration) into separate reference files.

**Pattern 1: High-level guide with references**

\`\`\`markdown
# PDF Processing

## Quick start

Extract text with pdfplumber:
[code example]

## Advanced features

- **Form filling**: See [FORMS.md](FORMS.md) for complete guide
- **API reference**: See [REFERENCE.md](REFERENCE.md) for all methods
- **Examples**: See [EXAMPLES.md](EXAMPLES.md) for common patterns
\`\`\`

Claude loads FORMS.md, REFERENCE.md, or EXAMPLES.md only when needed.

**Pattern 2: Domain-specific organization**

For Skills with multiple domains, organize content by domain to avoid loading irrelevant context:

\`\`\`
bigquery-skill/
├── SKILL.md (overview and navigation)
└── reference/
    ├── finance.md (revenue, billing metrics)
    ├── sales.md (opportunities, pipeline)
    ├── product.md (API usage, features)
    └── marketing.md (campaigns, attribution)
\`\`\`

When a user asks about sales metrics, Claude only reads sales.md.

Similarly, for skills supporting multiple frameworks or variants, organize by variant:

\`\`\`
cloud-deploy/
├── SKILL.md (workflow + provider selection)
└── references/
    ├── aws.md (AWS deployment patterns)
    ├── gcp.md (GCP deployment patterns)
    └── azure.md (Azure deployment patterns)
\`\`\`

When the user chooses AWS, Claude only reads aws.md.

**Pattern 3: Conditional details**

Show basic content, link to advanced content:

\`\`\`markdown
# DOCX Processing

## Creating documents

Use docx-js for new documents. See [DOCX-JS.md](DOCX-JS.md).

## Editing documents

For simple edits, modify the XML directly.

**For tracked changes**: See [REDLINING.md](REDLINING.md)
**For OOXML details**: See [OOXML.md](OOXML.md)
\`\`\`

Claude reads REDLINING.md or OOXML.md only when the user needs those features.

**Important guidelines:**

- **Avoid deeply nested references** - Keep references one level deep from SKILL.md. All reference files should link directly from SKILL.md.
- **Structure longer reference files** - For files longer than 100 lines, include a table of contents at the top so Claude can see the full scope when previewing.

## Skill Creation Process

Skill creation involves these steps:

1. Understand the skill with concrete examples
2. Plan reusable skill contents (scripts, references, assets)
3. Initialize the skill (run init_skill.sh)
4. Edit the skill (implement resources and write SKILL.md)
5. Iterate based on real usage

Follow these steps in order, skipping only if there is a clear reason why they are not applicable.

### Step 1: Understanding the Skill with Concrete Examples

Skip this step only when the skill's usage patterns are already clearly understood. It remains valuable even when working with an existing skill.

To create an effective skill, clearly understand concrete examples of how the skill will be used. This understanding can come from either direct user examples or generated examples that are validated with user feedback.

For example, when building an image-editor skill, relevant questions include:

- "What functionality should the image-editor skill support? Editing, rotating, anything else?"
- "Can you give some examples of how this skill would be used?"
- "I can imagine users asking for things like 'Remove the red-eye from this image' or 'Rotate this image'. Are there other ways you imagine this skill being used?"
- "What would a user say that should trigger this skill?"

To avoid overwhelming users, avoid asking too many questions in a single message. Start with the most important questions and follow up as needed for better effectiveness.

Conclude this step when there is a clear sense of the functionality the skill should support.

### Step 2: Planning the Reusable Skill Contents

To turn concrete examples into an effective skill, analyze each example by:

1. Considering how to execute on the example from scratch
2. Identifying what scripts, references, and assets would be helpful when executing these workflows repeatedly

Example: When building a \`pdf-editor\` skill to handle queries like "Help me rotate this PDF," the analysis shows:

1. Rotating a PDF requires re-writing the same code each time
2. A \`scripts/rotate_pdf.py\` script would be helpful to store in the skill

Example: When designing a \`frontend-webapp-builder\` skill for queries like "Build me a todo app" or "Build me a dashboard to track my steps," the analysis shows:

1. Writing a frontend webapp requires the same boilerplate HTML/React each time
2. An \`assets/hello-world/\` template containing the boilerplate HTML/React project files would be helpful to store in the skill

Example: When building a \`big-query\` skill to handle queries like "How many users have logged in today?" the analysis shows:

1. Querying BigQuery requires re-discovering the table schemas and relationships each time
2. A \`references/schema.md\` file documenting the table schemas would be helpful to store in the skill

To establish the skill's contents, analyze each concrete example to create a list of the reusable resources to include: scripts, references, and assets.

### Step 3: Initializing the Skill

At this point, it is time to actually create the skill.

Skip this step only if the skill being developed already exists. In this case, continue to the next step.

When creating a new skill from scratch, always run the \`init_skill.sh\` script. The script conveniently generates a new template skill directory that automatically includes everything a skill requires, making the skill creation process much more efficient and reliable.

Skills should be created at \`/workspace/skills/{skill-name}\`.

Usage:

\`\`\`bash
scripts/init_skill.sh <skill-name>
\`\`\`

The script:

- Creates the skill directory at \`/workspace/skills/{skill-name}\`
- Generates a SKILL.md template with proper frontmatter and TODO placeholders
- Creates example resource directories: \`scripts/\`, \`references/\`, and \`assets/\`
- Adds example files in each directory that can be customized or deleted

After initialization, customize or remove the generated SKILL.md and example files as needed.

### Step 4: Edit the Skill

When editing the (newly-generated or existing) skill, remember that the skill is being created for another instance of Claude to use. Include information that would be beneficial and non-obvious to Claude. Consider what procedural knowledge, domain-specific details, or reusable assets would help another Claude instance execute these tasks more effectively.

#### Learn Proven Design Patterns

Consult these helpful guides based on your skill's needs:

- **Multi-step processes**: See references/workflows.md for sequential workflows and conditional logic
- **Specific output formats or quality standards**: See references/output-patterns.md for template and example patterns

These files contain established best practices for effective skill design.

#### Start with Reusable Skill Contents

To begin implementation, start with the reusable resources identified above: \`scripts/\`, \`references/\`, and \`assets/\` files. Note that this step may require user input. For example, when implementing a \`brand-guidelines\` skill, the user may need to provide brand assets or templates to store in \`assets/\`, or documentation to store in \`references/\`.

Added scripts must be tested by actually running them to ensure there are no bugs and that the output matches what is expected. If there are many similar scripts, only a representative sample needs to be tested to ensure confidence that they all work while balancing time to completion.

Any example files and directories not needed for the skill should be deleted. The initialization script creates example files in \`scripts/\`, \`references/\`, and \`assets/\` to demonstrate structure, but most skills won't need all of them.

#### Update SKILL.md

**Writing Guidelines:** Always use imperative/infinitive form.

##### Frontmatter

Write the YAML frontmatter with \`name\` and \`description\`:

- \`name\`: The skill name
- \`description\`: This is the primary triggering mechanism for your skill, and helps Claude understand when to use the skill.
  - Include both what the Skill does and specific triggers/contexts for when to use it.
  - Include all "when to use" information here - Not in the body. The body is only loaded after triggering, so "When to Use This Skill" sections in the body are not helpful to Claude.
  - Example description for a \`docx\` skill: "Comprehensive document creation, editing, and analysis with support for tracked changes, comments, formatting preservation, and text extraction. Use when Claude needs to work with professional documents (.docx files) for: (1) Creating new documents, (2) Modifying or editing content, (3) Working with tracked changes, (4) Adding comments, or any other document tasks"

Do not include any other fields in YAML frontmatter.

##### Body

Write instructions for using the skill and its bundled resources.

### Step 5: Iterate

After testing the skill, users may request improvements. Often this happens right after using the skill, with fresh context of how the skill performed.

**Iteration workflow:**

1. Use the skill on real tasks
2. Notice struggles or inefficiencies
3. Identify how SKILL.md or bundled resources should be updated
4. Implement changes and test again
`,j=`#!/bin/bash
#
# Skill Initializer - Creates a new skill from template
#
# Usage:
#     init_skill.sh <skill-name>
#
# Examples:
#     init_skill.sh my-new-skill
#     init_skill.sh my-api-helper
#

set -e

SKILLS_DIR="/workspace/skills"

# Function to convert skill-name to Title Case
title_case() {
    echo "$1" | sed 's/-/ /g' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2))}1'
}

# Check arguments
if [ $# -ne 1 ]; then
    echo "Usage: init_skill.sh <skill-name>"
    echo ""
    echo "Skill name requirements:"
    echo "  - Hyphen-case identifier (e.g., 'data-analyzer')"
    echo "  - Lowercase letters, digits, and hyphens only"
    echo "  - Max 40 characters"
    echo "  - Must match directory name exactly"
    echo ""
    echo "Skills are created at: $SKILLS_DIR/<skill-name>"
    echo ""
    echo "Examples:"
    echo "  init_skill.sh my-new-skill"
    echo "  init_skill.sh my-api-helper"
    exit 1
fi

SKILL_NAME="$1"
SKILL_TITLE=$(title_case "$SKILL_NAME")
SKILL_DIR="$SKILLS_DIR/$SKILL_NAME"

echo "Initializing skill: $SKILL_NAME"
echo "   Location: $SKILL_DIR"
echo ""

# Check if directory already exists
if [ -d "$SKILL_DIR" ]; then
    echo "Error: Skill directory already exists: $SKILL_DIR"
    exit 1
fi

# Create skill directory
mkdir -p "$SKILL_DIR"
echo "Created skill directory: $SKILL_DIR"

# Create SKILL.md
cat > "$SKILL_DIR/SKILL.md" << EOF
---
name: $SKILL_NAME
description: [TODO: Complete and informative explanation of what the skill does and when to use it. Include WHEN to use this skill - specific scenarios, file types, or tasks that trigger it.]
---

# $SKILL_TITLE

## Overview

[TODO: 1-2 sentences explaining what this skill enables]

## Structuring This Skill

[TODO: Choose the structure that best fits this skill's purpose. Common patterns:

**1. Workflow-Based** (best for sequential processes)
- Works well when there are clear step-by-step procedures
- Example: DOCX skill with "Workflow Decision Tree" → "Reading" → "Creating" → "Editing"
- Structure: ## Overview → ## Workflow Decision Tree → ## Step 1 → ## Step 2...

**2. Task-Based** (best for tool collections)
- Works well when the skill offers different operations/capabilities
- Example: PDF skill with "Quick Start" → "Merge PDFs" → "Split PDFs" → "Extract Text"
- Structure: ## Overview → ## Quick Start → ## Task Category 1 → ## Task Category 2...

**3. Reference/Guidelines** (best for standards or specifications)
- Works well for brand guidelines, coding standards, or requirements
- Example: Brand styling with "Brand Guidelines" → "Colors" → "Typography" → "Features"
- Structure: ## Overview → ## Guidelines → ## Specifications → ## Usage...

**4. Capabilities-Based** (best for integrated systems)
- Works well when the skill provides multiple interrelated features
- Example: Product Management with "Core Capabilities" → numbered capability list
- Structure: ## Overview → ## Core Capabilities → ### 1. Feature → ### 2. Feature...

Patterns can be mixed and matched as needed. Most skills combine patterns (e.g., start with task-based, add workflow for complex operations).

Delete this entire "Structuring This Skill" section when done - it's just guidance.]

## [TODO: Replace with the first main section based on chosen structure]

[TODO: Add content here. See examples in existing skills:
- Code samples for technical skills
- Decision trees for complex workflows
- Concrete examples with realistic user requests
- References to scripts/templates/references as needed]

## Resources

This skill includes example resource directories that demonstrate how to organize different types of bundled resources:

### scripts/
Executable code (Python/Bash/etc.) that can be run directly to perform specific operations.

**Examples from other skills:**
- PDF skill: \\\`fill_fillable_fields.py\\\`, \\\`extract_form_field_info.py\\\` - utilities for PDF manipulation
- DOCX skill: \\\`document.py\\\`, \\\`utilities.py\\\` - Python modules for document processing

**Appropriate for:** Python scripts, shell scripts, or any executable code that performs automation, data processing, or specific operations.

**Note:** Scripts may be executed without loading into context, but can still be read by Claude for patching or environment adjustments.

### references/
Documentation and reference material intended to be loaded into context to inform Claude's process and thinking.

**Examples from other skills:**
- Product management: \\\`communication.md\\\`, \\\`context_building.md\\\` - detailed workflow guides
- BigQuery: API reference documentation and query examples
- Finance: Schema documentation, company policies

**Appropriate for:** In-depth documentation, API references, database schemas, comprehensive guides, or any detailed information that Claude should reference while working.

### assets/
Files not intended to be loaded into context, but rather used within the output Claude produces.

**Examples from other skills:**
- Brand guidelines: PowerPoint template files (.pptx), logo files
- Frontend builder: HTML/React boilerplate project directories
- Typography: Font files (.ttf, .woff2)

**Appropriate for:** Templates, boilerplate code, document templates, images, icons, fonts, or any files meant to be copied or used in the final output.

---

**Any unneeded directories can be deleted.** Not every skill requires all three types of resources.
EOF
echo "Created SKILL.md"

# Create scripts directory with example script
mkdir -p "$SKILL_DIR/scripts"
cat > "$SKILL_DIR/scripts/example.sh" << EOF
#!/bin/bash
#
# Example helper script for $SKILL_NAME
#
# This is a placeholder script that can be executed directly.
# Replace with actual implementation or delete if not needed.
#
# Example real scripts from other skills:
# - pdf/scripts/fill_fillable_fields.py - Fills PDF form fields
# - pdf/scripts/convert_pdf_to_images.py - Converts PDF pages to images
#

echo "This is an example script for $SKILL_NAME"
# TODO: Add actual script logic here
# This could be data processing, file conversion, API calls, etc.
EOF
chmod +x "$SKILL_DIR/scripts/example.sh"
echo "Created scripts/example.sh"

# Create references directory with example reference doc
mkdir -p "$SKILL_DIR/references"
cat > "$SKILL_DIR/references/api_reference.md" << EOF
# Reference Documentation for $SKILL_TITLE

This is a placeholder for detailed reference documentation.
Replace with actual reference content or delete if not needed.

Example real reference docs from other skills:
- product-management/references/communication.md - Comprehensive guide for status updates
- product-management/references/context_building.md - Deep-dive on gathering context
- bigquery/references/ - API references and query examples

## When Reference Docs Are Useful

Reference docs are ideal for:
- Comprehensive API documentation
- Detailed workflow guides
- Complex multi-step processes
- Information too lengthy for main SKILL.md
- Content that's only needed for specific use cases

## Structure Suggestions

### API Reference Example
- Overview
- Authentication
- Endpoints with examples
- Error codes
- Rate limits

### Workflow Guide Example
- Prerequisites
- Step-by-step instructions
- Common patterns
- Troubleshooting
- Best practices
EOF
echo "Created references/api_reference.md"

# Create assets directory with example asset placeholder
mkdir -p "$SKILL_DIR/assets"
cat > "$SKILL_DIR/assets/example_asset.txt" << EOF
# Example Asset File

This placeholder represents where asset files would be stored.
Replace with actual asset files (templates, images, fonts, etc.) or delete if not needed.

Asset files are NOT intended to be loaded into context, but rather used within
the output Claude produces.

Example asset files from other skills:
- Brand guidelines: logo.png, slides_template.pptx
- Frontend builder: hello-world/ directory with HTML/React boilerplate
- Typography: custom-font.ttf, font-family.woff2
- Data: sample_data.csv, test_dataset.json

## Common Asset Types

- Templates: .pptx, .docx, boilerplate directories
- Images: .png, .jpg, .svg, .gif
- Fonts: .ttf, .otf, .woff, .woff2
- Boilerplate code: Project directories, starter files
- Icons: .ico, .svg
- Data files: .csv, .json, .xml, .yaml

Note: This is a text placeholder. Actual assets can be any file type.
EOF
echo "Created assets/example_asset.txt"

# Print success
echo ""
echo "Skill '$SKILL_NAME' initialized successfully at $SKILL_DIR"
echo ""
echo "Next steps:"
echo "1. Edit SKILL.md to complete the TODO items and update the description"
echo "2. Customize or delete the example files in scripts/, references/, and assets/"
echo "3. Test the skill with real tasks and iterate"
`,K='---\nname: slideshow\ndescription: Create interactive HTML slideshows from web content or topics. Use when the user asks to create a slideshow, presentation deck, or slide-based summary of content. Triggers on requests like "make a slideshow about X", "create slides for this article", "turn this into a presentation", or "build an interactive slideshow".\n---\n\n# Slideshow Creator\n\nCreate interactive HTML slideshows with keyboard navigation and progress tracking.\n\n## Available Themes\n\nChoose a theme that matches the content\'s tone. If the user doesn\'t specify, pick based on context.\n\n### 1. Midnight (default)\n\nDark mode with electric blue accents. Best for: tech, code, modern topics.\n\n- **Fonts**: `Space Grotesk` (headings), `IBM Plex Mono` (code/meta)\n- **Colors**: Background `#050505`, Surface `#0f0f0f`, Accent `#3b82f6`, Text `#e5e7eb`\n\n### 2. Paper\n\nWarm, editorial light theme with sepia tones. Best for: essays, literature, history.\n\n- **Fonts**: `Playfair Display` (headings), `Source Serif 4` (body)\n- **Colors**: Background `#faf8f5`, Surface `#f0ece4`, Accent `#c45d3a`, Text `#2c2825`\n\n### 3. Neon\n\nCyberpunk dark theme with magenta/cyan glow effects. Best for: futuristic, gaming, creative.\n\n- **Fonts**: `Orbitron` (headings), `Fira Code` (body)\n- **Colors**: Background `#0a0a0f`, Surface `#12121a`, Primary `#ff2d95`, Secondary `#00f0ff`\n\n### 4. Forest\n\nOrganic dark theme with natural greens. Best for: nature, sustainability, wellness.\n\n- **Fonts**: `Fraunces` (headings), `Nunito Sans` (body)\n- **Colors**: Background `#0d1210`, Surface `#141f1a`, Accent `#4ade80`, Text `#d4e4db`\n\n### 5. Sunset\n\nWarm gradient theme with amber/coral tones. Best for: inspiration, storytelling, personal.\n\n- **Fonts**: `Sora` (headings), `DM Sans` (body)\n- **Colors**: Background `#1a0f0a`, Surface `#251510`, Primary `#f59e0b`, Secondary `#ef4444`\n\n### 6. Arctic\n\nClean, icy light theme with cool blues. Best for: corporate, data, professional.\n\n- **Fonts**: `Plus Jakarta Sans` (headings/body)\n- **Colors**: Background `#f8fafc`, Surface `#e2e8f0`, Accent `#0ea5e9`, Text `#0f172a`\n\n### 7. Monochrome\n\nPure grayscale for maximum focus. Best for: minimalist, typography-focused, serious.\n\n- **Fonts**: `Instrument Serif` (headings), `Geist` (body)\n- **Colors**: Background `#ffffff`, Surface `#f5f5f5`, Accent `#171717`, Text `#262626`\n\n## Slide Structure\n\nEach slide contains:\n\n1. **Chip** (top): Date, category, or status\n2. **Heading** (middle): Core concept\n3. **Content** (bottom): 2-3 sentences max\n4. **Insight/Code** (optional): Code block or bolded key lesson\n\n## Workflow\n\n### 1. Extract content\n\nFrom the source URL or topic, identify:\n\n- Title and main headers (h2, h3)\n- Key paragraphs following each header\n- Important technical terms or dates\n\n### 2. Generate slideshow\n\nUse the template at `assets/template.html` as the base. Set the `data-theme` attribute on `<html>` to one of: `midnight`, `paper`, `neon`, `forest`, `sunset`, `arctic`, `monochrome`.\n\nExample structure:\n\n```html\n<html data-theme="midnight">\n  ...\n  <div class="slide active">\n    <span class="chip">CATEGORY</span>\n    <h1>Slide Title</h1>\n    <div class="content">Slide content goes here.</div>\n    <div class="insight">// Optional key insight</div>\n  </div>\n</html>\n```\n\n### 3. Content guidelines\n\n- Focus on the "why" behind each point, not just facts\n- Keep slide text concise (2-3 sentences max)\n- Use chips for context (dates, categories, status)\n- Add code blocks for technical content\n- Bold key lessons with `.key-lesson` class\n- **IMPORTANT**: Do NOT load slide content from the filesystem at runtime. Encode all slides directly in the HTML. The slideshow must be fully self-contained.\n',V=`<!doctype html>
<html lang="en" data-theme="midnight">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{{TITLE}}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=IBM+Plex+Mono:wght@400;500&family=Playfair+Display:wght@400;600;700&family=Source+Serif+4:ital,wght@0,400;0,600;1,400&family=Orbitron:wght@400;700;900&family=Fira+Code:wght@400;500&family=Fraunces:ital,wght@0,400;0,700;1,400&family=Nunito+Sans:wght@400;600&family=Sora:wght@400;600;700&family=DM+Sans:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&family=Geist:wght@400;500&display=swap"
      rel="stylesheet"
    />
    <style>
      /* ===== THEME DEFINITIONS ===== */

      /* Midnight - Dark with electric blue */
      [data-theme="midnight"] {
        --bg: #050505;
        --surface: #0f0f0f;
        --accent: #3b82f6;
        --accent-glow: rgba(59, 130, 246, 0.4);
        --text: #e5e7eb;
        --text-muted: #9ca3af;
        --border: #1f1f1f;
        --font-heading: "Space Grotesk", sans-serif;
        --font-body: "Space Grotesk", sans-serif;
        --font-mono: "IBM Plex Mono", monospace;
      }

      /* Paper - Warm editorial light */
      [data-theme="paper"] {
        --bg: #faf8f5;
        --surface: #f0ece4;
        --accent: #c45d3a;
        --accent-glow: rgba(196, 93, 58, 0.2);
        --text: #2c2825;
        --text-muted: #6b635b;
        --border: #e0dbd3;
        --font-heading: "Playfair Display", serif;
        --font-body: "Source Serif 4", serif;
        --font-mono: "IBM Plex Mono", monospace;
      }

      /* Neon - Cyberpunk with glow effects */
      [data-theme="neon"] {
        --bg: #0a0a0f;
        --surface: #12121a;
        --accent: #ff2d95;
        --accent-secondary: #00f0ff;
        --accent-glow: rgba(255, 45, 149, 0.5);
        --text: #ffffff;
        --text-muted: #a0a0b0;
        --border: #2a2a3a;
        --font-heading: "Orbitron", sans-serif;
        --font-body: "Fira Code", monospace;
        --font-mono: "Fira Code", monospace;
      }

      /* Forest - Organic dark with natural greens */
      [data-theme="forest"] {
        --bg: #0d1210;
        --surface: #141f1a;
        --accent: #4ade80;
        --accent-glow: rgba(74, 222, 128, 0.3);
        --text: #d4e4db;
        --text-muted: #8faa9a;
        --border: #1f2f28;
        --font-heading: "Fraunces", serif;
        --font-body: "Nunito Sans", sans-serif;
        --font-mono: "Fira Code", monospace;
      }

      /* Sunset - Warm gradient with amber/coral */
      [data-theme="sunset"] {
        --bg: #1a0f0a;
        --surface: #251510;
        --accent: #f59e0b;
        --accent-secondary: #ef4444;
        --accent-glow: rgba(245, 158, 11, 0.4);
        --text: #fef3e2;
        --text-muted: #c9a88a;
        --border: #3d2a1f;
        --font-heading: "Sora", sans-serif;
        --font-body: "DM Sans", sans-serif;
        --font-mono: "IBM Plex Mono", monospace;
      }

      /* Arctic - Clean icy light with cool blues */
      [data-theme="arctic"] {
        --bg: #f8fafc;
        --surface: #e2e8f0;
        --accent: #0ea5e9;
        --accent-glow: rgba(14, 165, 233, 0.2);
        --text: #0f172a;
        --text-muted: #475569;
        --border: #cbd5e1;
        --font-heading: "Plus Jakarta Sans", sans-serif;
        --font-body: "Plus Jakarta Sans", sans-serif;
        --font-mono: "IBM Plex Mono", monospace;
      }

      /* Monochrome - Pure grayscale focus */
      [data-theme="monochrome"] {
        --bg: #ffffff;
        --surface: #f5f5f5;
        --accent: #171717;
        --accent-glow: rgba(23, 23, 23, 0.1);
        --text: #171717;
        --text-muted: #525252;
        --border: #e5e5e5;
        --font-heading: "Instrument Serif", serif;
        --font-body: "DM Sans", sans-serif;
        --font-mono: "IBM Plex Mono", monospace;
      }

      /* ===== BASE STYLES ===== */
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        background-color: var(--bg);
        color: var(--text);
        font-family: var(--font-body);
        overflow: hidden;
        height: 100vh;
        display: flex;
        flex-direction: column;
      }

      /* ===== PROGRESS BAR ===== */
      .progress-bar {
        position: fixed;
        top: 0;
        left: 0;
        height: 4px;
        background: var(--accent);
        box-shadow: 0 0 20px var(--accent-glow);
        transition: width 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        z-index: 100;
      }

      [data-theme="neon"] .progress-bar {
        height: 3px;
        background: linear-gradient(90deg, var(--accent), var(--accent-secondary));
        box-shadow:
          0 0 30px var(--accent-glow),
          0 0 60px var(--accent-glow);
      }

      [data-theme="sunset"] .progress-bar {
        background: linear-gradient(90deg, var(--accent), var(--accent-secondary));
      }

      /* ===== CONTAINER ===== */
      .container {
        flex: 1;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      /* ===== SLIDES ===== */
      .slide {
        position: absolute;
        width: 100%;
        max-width: 800px;
        padding: 40px;
        opacity: 0;
        transform: translateY(30px);
        transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        pointer-events: none;
      }

      .slide.active {
        opacity: 1;
        transform: translateY(0);
        pointer-events: all;
      }

      /* ===== CHIP ===== */
      .chip {
        display: inline-block;
        padding: 6px 14px;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 100px;
        font-family: var(--font-mono);
        font-size: 11px;
        font-weight: 500;
        color: var(--accent);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin-bottom: 28px;
      }

      [data-theme="neon"] .chip {
        background: transparent;
        border-color: var(--accent);
        box-shadow:
          0 0 15px var(--accent-glow),
          inset 0 0 15px rgba(255, 45, 149, 0.1);
        text-shadow: 0 0 10px var(--accent-glow);
      }

      [data-theme="paper"] .chip {
        border-radius: 4px;
        font-family: var(--font-body);
        font-style: italic;
        text-transform: none;
        letter-spacing: 0;
      }

      [data-theme="monochrome"] .chip {
        background: var(--accent);
        color: var(--bg);
        border: none;
      }

      /* ===== HEADINGS ===== */
      h1 {
        font-family: var(--font-heading);
        font-size: 52px;
        font-weight: 700;
        margin-bottom: 28px;
        line-height: 1.1;
        letter-spacing: -0.02em;
      }

      [data-theme="paper"] h1 {
        font-size: 48px;
        font-weight: 600;
        letter-spacing: -0.01em;
      }

      [data-theme="neon"] h1 {
        font-size: 44px;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.02em;
        text-shadow: 0 0 40px var(--accent-glow);
      }

      [data-theme="forest"] h1 {
        font-size: 48px;
        font-weight: 700;
        font-style: italic;
      }

      [data-theme="monochrome"] h1 {
        font-size: 56px;
        font-weight: 400;
        font-style: italic;
      }

      /* ===== CONTENT ===== */
      .content {
        font-size: 18px;
        line-height: 1.7;
        color: var(--text-muted);
        max-width: 620px;
      }

      [data-theme="paper"] .content {
        font-size: 19px;
        line-height: 1.8;
      }

      [data-theme="neon"] .content {
        font-size: 15px;
        line-height: 1.6;
        letter-spacing: 0.01em;
      }

      /* ===== INSIGHT BOX ===== */
      .insight {
        margin-top: 36px;
        padding: 20px 24px;
        background: var(--surface);
        border-left: 3px solid var(--accent);
        font-family: var(--font-mono);
        font-size: 14px;
        line-height: 1.6;
        color: var(--text);
      }

      [data-theme="neon"] .insight {
        background: rgba(255, 45, 149, 0.05);
        border-left-color: var(--accent);
        box-shadow: 0 0 30px rgba(255, 45, 149, 0.1);
      }

      [data-theme="paper"] .insight {
        background: transparent;
        border-left: none;
        border-top: 1px solid var(--border);
        border-bottom: 1px solid var(--border);
        padding: 20px 0;
        font-family: var(--font-body);
        font-style: italic;
      }

      [data-theme="monochrome"] .insight {
        background: transparent;
        border-left: none;
        border: 1px solid var(--border);
        padding: 20px 24px;
      }

      /* ===== CODE BLOCKS ===== */
      .code-block {
        margin-top: 24px;
        padding: 20px 24px;
        background: var(--surface);
        border-radius: 8px;
        font-family: var(--font-mono);
        font-size: 13px;
        line-height: 1.6;
        overflow-x: auto;
      }

      [data-theme="neon"] .code-block {
        background: rgba(0, 240, 255, 0.05);
        border: 1px solid rgba(0, 240, 255, 0.2);
      }

      /* ===== KEY LESSON HIGHLIGHT ===== */
      .key-lesson {
        color: var(--accent);
        font-weight: 600;
      }

      [data-theme="neon"] .key-lesson {
        text-shadow: 0 0 10px var(--accent-glow);
      }

      /* ===== NAV FOOTER ===== */
      .nav-footer {
        padding: 32px 40px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-top: 1px solid var(--border);
        font-family: var(--font-mono);
        font-size: 12px;
        color: var(--text-muted);
      }

      .controls {
        display: flex;
        gap: 24px;
      }

      .control-hint {
        color: var(--accent);
      }

      [data-theme="neon"] .control-hint {
        text-shadow: 0 0 10px var(--accent-glow);
      }

      [data-theme="paper"] .nav-footer {
        font-family: var(--font-body);
      }

      /* ===== THEME-SPECIFIC BACKGROUNDS ===== */
      [data-theme="neon"] body::before {
        content: "";
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background:
          radial-gradient(ellipse at 20% 20%, rgba(255, 45, 149, 0.08) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 80%, rgba(0, 240, 255, 0.08) 0%, transparent 50%);
        pointer-events: none;
        z-index: -1;
      }

      [data-theme="sunset"] body::before {
        content: "";
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background:
          radial-gradient(ellipse at 0% 100%, rgba(245, 158, 11, 0.1) 0%, transparent 50%),
          radial-gradient(ellipse at 100% 0%, rgba(239, 68, 68, 0.08) 0%, transparent 50%);
        pointer-events: none;
        z-index: -1;
      }

      [data-theme="forest"] body::before {
        content: "";
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: radial-gradient(
          ellipse at 50% 100%,
          rgba(74, 222, 128, 0.05) 0%,
          transparent 60%
        );
        pointer-events: none;
        z-index: -1;
      }
    </style>
  </head>
  <body>
    <div class="progress-bar" id="progress"></div>
    <div class="container" id="slide-container">
      <!-- Slides will be injected here -->
    </div>
    <div class="nav-footer">
      <div id="slide-count">Slide 1 of 1</div>
      <div class="controls">
        <span><span class="control-hint">←</span> Prev</span>
        <span><span class="control-hint">→</span> Next</span>
      </div>
    </div>

    <script>
      // IMPORTANT: Embed slides directly as inline JSON. Do NOT load from external files.
      const slides = []; // Replace this empty array with the actual slides data
      let currentSlide = 0;

      function renderSlides() {
        const container = document.getElementById("slide-container");
        container.innerHTML = slides
          .map(
            (slide, i) => \`
                <div class="slide \${i === 0 ? "active" : ""}" data-index="\${i}">
                    <div class="chip">\${slide.chip || "Insight"}</div>
                    <h1>\${slide.title}</h1>
                    <div class="content">\${slide.content}</div>
                    \${slide.insight ? \`<div class="insight">// \${slide.insight}</div>\` : ""}
                    \${slide.code ? \`<pre class="code-block">\${slide.code}</pre>\` : ""}
                </div>
            \`
          )
          .join("");
        updateUI();
      }

      function updateUI() {
        document.querySelectorAll(".slide").forEach((el, i) => {
          el.classList.toggle("active", i === currentSlide);
        });
        document.getElementById("progress").style.width =
          \`\${((currentSlide + 1) / slides.length) * 100}%\`;
        document.getElementById("slide-count").textContent =
          \`Slide \${currentSlide + 1} of \${slides.length}\`;
      }

      window.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight" || e.key === " ") {
          if (currentSlide < slides.length - 1) {
            currentSlide++;
            updateUI();
          }
        } else if (e.key === "ArrowLeft") {
          if (currentSlide > 0) {
            currentSlide--;
            updateUI();
          }
        }
      });

      // Touch support for mobile
      let touchStartX = 0;
      document.addEventListener("touchstart", (e) => {
        touchStartX = e.changedTouches[0].screenX;
      });
      document.addEventListener("touchend", (e) => {
        const diff = touchStartX - e.changedTouches[0].screenX;
        if (Math.abs(diff) > 50) {
          if (diff > 0 && currentSlide < slides.length - 1) {
            currentSlide++;
            updateUI();
          } else if (diff < 0 && currentSlide > 0) {
            currentSlide--;
            updateUI();
          }
        }
      });

      // Initialize
      renderSlides();
    <\/script>
  </body>
</html>
`,X=`---
name: tldraw
description: Automate tldraw canvases in Do Browser by using the global window.editor (Editor API). Use when tasks involve creating, updating, deleting, selecting, laying out, exporting, or inspecting shapes/pages in an open tldraw tab.
---

# tldraw Automation (Do Browser)

This skill is for browser automation in Do Browser against an open tldraw tab. Use the \`Editor\` instance exposed on \`window.editor\` to mutate and inspect the file, rather than relying on fragile DOM clicks.

## Runtime Contract

- Before using any tldraw API method, read \`references/api-reference.md\` for the expected method signatures and payload shapes.
- Execute all editor calls in page context (\`page.evaluate\`, \`js -e\`, etc.).
- Use \`window.editor\` as the primary API surface.
- Use \`props.richText\` for all text/labels, including \`text\`, \`geo\` labels, and \`arrow\` labels.
- Use bindings to connect arrows to shapes (\`editor.createBindings\` with \`type: 'arrow'\`); do not rely on loose arrow coordinates for connected diagrams.
- Always wrap Editor API calls in \`try/catch\` and return/log structured error details.
- Batch multi-step edits in \`editor.run(() => { ... })\` for atomicity and cleaner history.
- Verify writes with API reads (\`getCurrentPageShapes\`, \`getSelectedShapeIds\`, etc.) and screenshot checks.

## Canonical References

- Primary API docs: <https://tldraw.dev/reference/editor/Editor>
- Source of truth (upstream): \`packages/editor/src/lib/editor/Editor.ts\` in <https://github.com/tldraw/tldraw>
- Local deep reference in this skill: \`references/api-reference.md\`

## Standard Workflow

1. **Connect to tab**: ensure the active tab is a tldraw app/file.
2. **Wait for editor (strict polling)**: do not call APIs until \`window.editor\` exists **and** \`typeof window.editor.createShapes === 'function'\`.
3. **Read reference first**: load \`references/api-reference.md\` before writing any Editor API calls.
4. **Pre-flight inspection**: if unsure about schema, create one manual shape in the UI, then inspect \`editor.getShape(id).props\` before batch writes.
5. **Read canvas state**: inspect current page/shapes before mutating.
6. **Mutate in batch**: use \`editor.run\` and call \`createShapes\` / \`updateShapes\` / \`deleteShapes\`.
7. **Frame result**: call \`editor.zoomToFit()\` (or \`zoomToSelection\`) and capture screenshot.
8. **Recover if needed**: if schema errors destabilize the app, reload tab and retry with safer payloads.

## Mandatory Guardrails

- Prefer \`geo\` shapes for robust automation unless the task explicitly needs \`line\`, \`draw\`, \`arrow\`, etc.
- Always generate unique shape IDs (\`shape:\` prefix recommended).
- The Editor validates payload structure and will throw if parameters are in the wrong shape; build payloads exactly as documented.
- \`props.text\` / \`props.label\` are legacy trap doors for labels; use \`props.richText\` for \`text\`, \`geo\`, and \`arrow\` labels.
- For arrows that connect to shapes, always create arrow bindings (\`terminal: 'start' | 'end'\`) instead of only setting \`props.start\` / \`props.end\`.
- Treat \`try/catch\` as mandatory around all write calls (\`create*\`, \`update*\`, \`delete*\`, page mutations, and exports).
- For \`text\` shapes, use \`props.richText\` (not legacy \`props.text\`).
- For updates, include both \`id\` and \`type\` in shape partials.
- Check selection/page context before destructive actions.
- Avoid internal/underscored Editor methods unless absolutely required.

## Do Browser Snippets

### Wait for \`window.editor\`

\`\`\`bash
js -e <<'EOF'
const ok = await page.evaluate(async () => {
  const start = Date.now();
  while (!(window.editor && typeof window.editor.createShapes === 'function')) {
    if (Date.now() - start > 10000) return false;
    await new Promise((r) => setTimeout(r, 100));
  }
  return true;
});
return ok ? 'editor-ready' : 'editor-missing';
EOF
\`\`\`

### Pre-flight inspection (when schema is uncertain)

\`\`\`bash
js -e <<'EOF'
const result = await page.evaluate(() => {
  const editor = window.editor;
  if (!editor) return { ok: false, error: 'window.editor missing' };

  // Create one manual shape in the UI first, select it, then inspect props.
  const id = editor.getOnlySelectedShapeId();
  if (!id) return { ok: false, error: 'No selected shape for inspection' };

  const shape = editor.getShape(id);
  return { ok: true, id, type: shape?.type, props: shape?.props ?? null };
});
return result;
EOF
\`\`\`

### Safe shape batch (preferred pattern)

\`\`\`bash
js -e <<'EOF'
const result = await page.evaluate(() => {
  try {
    const editor = window.editor;
    if (!editor) return { ok: false, error: 'window.editor missing' };

    const id = () =>
      \`shape:\${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 12)}\`;

    editor.run(() => {
      editor.createShapes([
        { id: id(), type: 'geo', x: 120, y: 120, props: { geo: 'rectangle', w: 220, h: 120 } },
        { id: id(), type: 'geo', x: 420, y: 160, props: { geo: 'ellipse', w: 120, h: 120 } },
      ]);
    });

    editor.zoomToFit();
    return { ok: true, shapeCount: editor.getCurrentPageShapes().length };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
});
return result;
EOF
\`\`\`

### Connected arrow (binding pattern)

\`\`\`bash
js -e <<'EOF'
const result = await page.evaluate(() => {
  try {
    const editor = window.editor;
    if (!editor) return { ok: false, error: 'window.editor missing' };

    const id = () =>
      \`shape:\${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 12)}\`;

    const fromId = id();
    const toId = id();
    const arrowId = id();

    editor.run(() => {
      editor.createShapes([
        { id: fromId, type: 'geo', x: 120, y: 120, props: { geo: 'rectangle', w: 180, h: 90 } },
        { id: toId, type: 'geo', x: 460, y: 120, props: { geo: 'rectangle', w: 180, h: 90 } },
        { id: arrowId, type: 'arrow', x: 300, y: 165, props: { richText: toRichText('Flow') } },
      ]);

      editor.createBindings([
        {
          fromId: arrowId,
          toId: fromId,
          type: 'arrow',
          props: { terminal: 'start', normalizedAnchor: { x: 1, y: 0.5 }, isExact: false, isPrecise: true },
        },
        {
          fromId: arrowId,
          toId: toId,
          type: 'arrow',
          props: { terminal: 'end', normalizedAnchor: { x: 0, y: 0.5 }, isExact: false, isPrecise: true },
        },
      ]);
    });

    editor.zoomToFit();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
});
return result;
EOF
\`\`\`

### Text rich-text helper

\`\`\`js
const toRichText = (text) => ({
  type: 'doc',
  content: [{ 
    type: 'paragraph', 
    content: [{ type: 'text', text: String(text) }] 
  }]
});
\`\`\`

## Failure Recovery

- If the UI shows **Something went wrong**, treat it as a schema validation failure that corrupted runtime state; the only recovery is a full page reload, then re-wait for editor readiness.
- If an invalid payload causes runtime errors/overlay: reload page, re-wait for \`window.editor\`, and retry with minimal valid payload.
- If refs go stale after a reload: reconnect to tab/page and reacquire state.
- If mutations are blocked due locking/read-only: inspect \`editor.getIsReadonly()\` and lock state (\`editor.isShapeOrAncestorLocked(...)\`).

## What To Load Next

- For full method/property inventory and shape/tool/style specifics, load \`references/api-reference.md\`.
`,Y="# tldraw Editor API Reference (Do Browser)\n\nThis reference is for agents operating inside Do Browser against an open tldraw tab, using `window.editor`.\n\n## Sources\n\n- Published API reference: <https://tldraw.dev/reference/editor/Editor>\n- Upstream source: <https://github.com/tldraw/tldraw/blob/main/packages/editor/src/lib/editor/Editor.ts>\n- API extractor report (upstream): `packages/editor/api-report.api.md`\n\n## Runtime Model in Do Browser\n\n- The editing surface is the global `window.editor` (an `Editor` instance).\n- Run calls in page context (`page.evaluate`, `js -e`).\n- Use Editor API methods instead of DOM interaction where possible.\n- Group multi-step changes with `editor.run(() => { ... })`.\n- Validate results after writes (`getCurrentPageShapes`, `getSelectedShapeIds`, `zoomToFit`, screenshot).\n\n## Strict Initialization Pattern (Mandatory)\n\n```js\nconst ready = await page.evaluate(async () => {\n  const start = Date.now();\n  while (true) {\n    const e = window.editor;\n    if (e && typeof e.createShapes === 'function') {\n      return { ok: true };\n    }\n    if (Date.now() - start > 10000) {\n      return { ok: false, error: 'Editor did not become ready in time' };\n    }\n    await new Promise((r) => setTimeout(r, 100));\n  }\n});\n```\n\n## Pre-flight Inspection (When Schema Is Unclear)\n\nIf uncertain about current shape props/schema, do a quick inspection before batch writes:\n\n1. Create one manual shape in the UI.\n2. Select it.\n3. Inspect its runtime props:\n\n```js\nconst inspection = await page.evaluate(() => {\n  const editor = window.editor;\n  if (!editor) return { ok: false, error: 'window.editor missing' };\n  const id = editor.getOnlySelectedShapeId();\n  if (!id) return { ok: false, error: 'No selected shape' };\n  const shape = editor.getShape(id);\n  return { ok: true, id, type: shape?.type, props: shape?.props ?? null };\n});\n```\n\n## Data/Shape Safety Rules\n\n- Use IDs with `shape:` prefix for consistency: `shape:${crypto.randomUUID()}`.\n- Prefer `type: 'geo'` for stable automation payloads.\n- For all labels/text, use `props.richText` (including `text`, `geo`, and `arrow`).\n- `props.text` / `props.label` are legacy trap doors; do not use them for new writes.\n- For any arrow that is meant to connect to shapes, always create arrow bindings with `createBinding` / `createBindings`.\n- Do not treat `props.start` / `props.end` alone as a connection contract; bindings are the source of truth for attached arrows.\n- For updates, include `id` and `type` in partials.\n- Avoid underscored/internal methods unless needed for advanced debugging.\n\n## Canonical Rich Text Helper (Use This Shape Exactly)\n\n```js\nconst toRichText = (text) => ({\n  type: 'doc',\n  content: [{ \n    type: 'paragraph', \n    content: [{ type: 'text', text: String(text) }] \n  }]\n});\n```\n\n## High-Value `Editor` API (Practical)\n\n### Transactions and History\n\n- `run(fn, opts?)` -> batch mutations in one transaction.\n- `markHistoryStoppingPoint(name?)` -> mark undo boundary.\n- `undo()` / `redo()` / `canUndo()` / `canRedo()` -> history control.\n- `bail()` / `bailToMark(id)` / `squashToMark(markId)` / `clearHistory()` -> advanced history management.\n\n### Shape CRUD and Layout\n\n- `createShape(shape)` / `createShapes(shapes)`\n- `updateShape(partial)` / `updateShapes(partials)`\n- `deleteShape(id)` / `deleteShapes(ids)`\n- `duplicateShapes(shapes, offset?)`\n- `moveShapesToPage(shapes, pageId)`\n- `reparentShapes(shapes, parentId, insertIndex?)`\n- `groupShapes(shapes, opts?)` / `ungroupShapes(ids, opts?)`\n- `alignShapes(shapes, operation)` / `distributeShapes(shapes, operation)`\n- `bringToFront(shapes)` / `bringForward(shapes)` / `sendToBack(shapes)` / `sendBackward(shapes)`\n- `flipShapes(shapes, operation)` / `rotateShapesBy(shapes, delta, opts?)` / `resizeShape(shape, scale, opts?)`\n\n### Arrow Bindings (for arrow-to-shape connections)\n\n- `createBinding(binding)` / `createBindings(bindings)` / `updateBinding(partial)` / `updateBindings(partials)`\n- Arrow binding record:\n  - `type: 'arrow'`\n  - `fromId`: arrow shape id\n  - `toId`: target shape id\n  - `props.terminal`: `'start' | 'end'`\n  - `props.normalizedAnchor`: `{ x: 0..1, y: 0..1 }`\n  - `props.isExact`: boolean\n  - `props.isPrecise`: boolean\n- Recommended: create both `start` and `end` bindings for fully connected arrows.\n\n### Selection and Query\n\n- `select(...shapes)` / `deselect(...shapes)` / `selectAll()` / `selectNone()`\n- `setSelectedShapes(shapes)`\n- `getSelectedShapeIds()` / `getSelectedShapes()` / `getOnlySelectedShape()`\n- `getCurrentPageShapes()` / `getCurrentPageShapesSorted()` / `getCurrentPageShapesInReadingOrder()`\n- `getShape(idOrShape)` / `getShapeAtPoint(point, opts?)` / `getShapesAtPoint(point, opts?)`\n- `getShapeGeometry(shape, opts?)` / `getShapeHandles(shape)` / `getShapePageBounds(shape)`\n\n### Camera, Viewport, Coordinate Space\n\n- `getCamera()` / `setCamera(point, opts?)`\n- `zoomToFit(opts?)` / `zoomToSelection(opts?)` / `zoomToBounds(bounds, opts?)`\n- `zoomIn(point?, opts?)` / `zoomOut(point?, opts?)` / `resetZoom(point?, opts?)`\n- `screenToPage(point)` / `pageToScreen(point)` / `pageToViewport(point)`\n- `getViewportPageBounds()` / `getViewportScreenBounds()` / `getViewportScreenCenter()`\n\n### Tools, Cursor, Focus, Edit State\n\n- `setCurrentTool(id, info?)` / `getCurrentToolId()`\n- `setCursor(cursor)`\n- `focus(opts?)` / `blur(opts?)`\n- `setEditingShape(shape)` / `getEditingShape()` / `getEditingShapeId()`\n- `setHoveredShape(shape)` / `getHoveredShape()` / `getHoveredShapeId()`\n- `setHintingShapes(shapes)` / `getHintingShapeIds()`\n\n### Pages and Document State\n\n- `createPage(pagePartial)` / `duplicatePage(page, createId?)` / `deletePage(page)`\n- `renamePage(page, name)` / `setCurrentPage(page)`\n- `getCurrentPage()` / `getCurrentPageId()` / `getPages()` / `getPage(pageId)`\n- `getDocumentSettings()` / `updateDocumentSettings(partial)`\n- `getSnapshot()` / `loadSnapshot(snapshot, opts?)`\n\n### Assets, External Content, and Export\n\n- `createAssets(assets)` / `updateAssets(assetPartials)` / `deleteAssets(assetsOrIds)`\n- `uploadAsset(asset, file, abortSignal?)`\n- `resolveAssetUrl(assetId, context)`\n- `putExternalContent(info, opts?)` / `replaceExternalContent(info, opts?)`\n- `getContentFromCurrentPage(shapes)` / `putContentOntoCurrentPage(content, opts?)`\n- `getSvgElement(shapes, opts?)` / `getSvgString(shapes, opts?)`\n- `toImage(shapes, opts?)` / `toImageDataUrl(shapes, opts?)`\n\n### Collaboration and Deep Links\n\n- `getCollaborators()` / `getCollaboratorsOnCurrentPage()`\n- `startFollowingUser(userId)` / `stopFollowingUser()` / `zoomToUser(userId, opts?)`\n- `createDeepLink(opts?)` / `navigateToDeepLink(opts)` / `registerDeepLinkListener(opts?)`\n\n## Built-In Tool IDs (Default UI)\n\n- `select`, `hand`, `eraser`, `laser`, `zoom`\n- `text`, `draw`, `geo`, `note`, `line`, `frame`, `arrow`, `highlight`\n\n## Built-In Shape Types (Default Schema)\n\n- `arrow`, `bookmark`, `draw`, `embed`, `frame`, `geo`, `group`, `highlight`, `image`, `line`, `note`, `text`, `video`\n\n## Common Style Enum Values\n\n- `color`: `black`, `grey`, `light-violet`, `violet`, `blue`, `light-blue`, `yellow`, `orange`, `green`, `light-green`, `light-red`, `red`, `white`\n- `dash`: `draw`, `solid`, `dashed`, `dotted`\n- `fill`: `none`, `semi`, `solid`, `pattern`, `fill`, `lined-fill`\n- `font`: `draw`, `sans`, `serif`, `mono`\n- `size`: `s`, `m`, `l`, `xl`\n- `textAlign`: `start`, `middle`, `end`\n- `verticalAlign`: `start`, `middle`, `end`\n\n## Geo Shape `props.geo` Values\n\n- `cloud`, `rectangle`, `ellipse`, `triangle`, `diamond`, `pentagon`, `hexagon`, `octagon`, `star`, `rhombus`, `rhombus-2`, `oval`, `trapezoid`, `arrow-right`, `arrow-left`, `arrow-up`, `arrow-down`, `x-box`, `check-box`, `heart`\n\n## Example Payloads\n\n### Geo with label (`richText`)\n\n```js\neditor.createShapes([\n  {\n    id: `shape:${crypto.randomUUID()}`,\n    type: 'geo',\n    x: 200,\n    y: 150,\n    props: {\n      geo: 'rectangle',\n      w: 260,\n      h: 120,\n      color: 'blue',\n      fill: 'semi',\n      richText: toRichText('System Diagram'),\n    },\n  },\n]);\n```\n\n### Arrow with label (`start`, `end`, `richText`)\n\n```js\neditor.createShapes([\n  {\n    id: `shape:${crypto.randomUUID()}`,\n    type: 'arrow',\n    x: 240,\n    y: 340,\n    props: {\n      start: { x: 0, y: 0 },\n      end: { x: 260, y: 0 },\n      richText: toRichText('Primary Flow'),\n    },\n  },\n]);\n```\n\n### Connected arrow using bindings (recommended)\n\n```js\nconst fromId = `shape:${crypto.randomUUID()}`;\nconst toId = `shape:${crypto.randomUUID()}`;\nconst arrowId = `shape:${crypto.randomUUID()}`;\n\neditor.createShapes([\n  { id: fromId, type: 'geo', x: 140, y: 260, props: { geo: 'rectangle', w: 180, h: 90, richText: toRichText('Source') } },\n  { id: toId, type: 'geo', x: 480, y: 260, props: { geo: 'rectangle', w: 180, h: 90, richText: toRichText('Target') } },\n  { id: arrowId, type: 'arrow', x: 320, y: 305, props: { richText: toRichText('Connected') } },\n]);\n\neditor.createBindings([\n  {\n    fromId: arrowId,\n    toId: fromId,\n    type: 'arrow',\n    props: {\n      terminal: 'start',\n      normalizedAnchor: { x: 1, y: 0.5 },\n      isExact: false,\n      isPrecise: true,\n    },\n  },\n  {\n    fromId: arrowId,\n    toId: toId,\n    type: 'arrow',\n    props: {\n      terminal: 'end',\n      normalizedAnchor: { x: 0, y: 0.5 },\n      isExact: false,\n      isPrecise: true,\n    },\n  },\n]);\n```\n\n### Create a text shape\n\n```js\neditor.createShapes([\n  {\n    id: `shape:${crypto.randomUUID()}`,\n    type: 'text',\n    x: 240,\n    y: 220,\n    props: { richText: toRichText('Hello from Do Browser'), w: 220, autoSize: false },\n  },\n]);\n```\n\n### Clear current page\n\n```js\neditor.selectAll();\neditor.deleteShapes(editor.getSelectedShapeIds());\neditor.selectNone();\n```\n\n## Crash Recovery\n\n- If the UI displays **Something went wrong**, treat it as schema validation failure with corrupted runtime state.\n- The only recovery is a full page reload, then re-run strict initialization before further mutations.\n\n## Full Published `Editor` Properties\n\nThe following property names are documented on the Editor reference page:\n- `bindingUtils`\n- `contextId`\n- `disposables`\n- `edgeScrollManager`\n- `fonts`\n- `getContainer`\n- `history`\n- `id`\n- `inputs`\n- `isDisposed`\n- `menus`\n- `options`\n- `root`\n- `scribbles`\n- `shapeUtils`\n- `sideEffects`\n- `snaps`\n- `store`\n- `styleProps`\n- `textMeasure`\n- `timers`\n- `user`\n\n## Full Published `Editor` Methods (250)\n\nEvery name below maps to this anchor pattern:\n- `https://tldraw.dev/reference/editor/Editor#<methodName>`\n\nMethod list:\n\n- `_flushEventForTick`\n- `_updateCurrentPageState`\n- `alignShapes`\n- `animateShape`\n- `animateShapes`\n- `bail`\n- `bailToMark`\n- `blur`\n- `bringForward`\n- `bringToFront`\n- `canBindShapes`\n- `cancel`\n- `cancelDoubleClick`\n- `canCreateShape`\n- `canCreateShapes`\n- `canCropShape`\n- `canEditShape`\n- `canRedo`\n- `canUndo`\n- `centerOnPoint`\n- `clearHistory`\n- `complete`\n- `createAssets`\n- `createBinding`\n- `createBindings`\n- `createDeepLink`\n- `createPage`\n- `createShape`\n- `createShapes`\n- `createTemporaryAssetPreview`\n- `deleteAssets`\n- `deleteBinding`\n- `deleteBindings`\n- `deletePage`\n- `deleteShape`\n- `deleteShapes`\n- `deselect`\n- `dispatch`\n- `dispose`\n- `distributeShapes`\n- `duplicatePage`\n- `duplicateShapes`\n- `findCommonAncestor`\n- `findShapeAncestor`\n- `flipShapes`\n- `focus`\n- `getAncestorPageId`\n- `getAsset`\n- `getAssetForExternalContent`\n- `getAssets`\n- `getBaseZoom`\n- `getBinding`\n- `getBindingsFromShape`\n- `getBindingsInvolvingShape`\n- `getBindingsToShape`\n- `getBindingUtil`\n- `getCamera`\n- `getCameraOptions`\n- `getCameraState`\n- `getCanRedo`\n- `getCanUndo`\n- `getCollaborators`\n- `getCollaboratorsOnCurrentPage`\n- `getContentFromCurrentPage`\n- `getCroppingShapeId`\n- `getCulledShapes`\n- `getCurrentPage`\n- `getCurrentPageBounds`\n- `getCurrentPageId`\n- `getCurrentPageRenderingShapesSorted`\n- `getCurrentPageShapeIds`\n- `getCurrentPageShapes`\n- `getCurrentPageShapesInReadingOrder`\n- `getCurrentPageShapesSorted`\n- `getCurrentPageState`\n- `getCurrentTool`\n- `getCurrentToolId`\n- `getDebouncedZoomLevel`\n- `getDocumentSettings`\n- `getDraggingOverShape`\n- `getEditingShape`\n- `getEditingShapeId`\n- `getEfficientZoomLevel`\n- `getErasingShapeIds`\n- `getErasingShapes`\n- `getFocusedGroup`\n- `getFocusedGroupId`\n- `getHighestIndexForParent`\n- `getHintingShape`\n- `getHintingShapeIds`\n- `getHoveredShape`\n- `getHoveredShapeId`\n- `getInitialMetaForShape`\n- `getInitialZoom`\n- `getInstanceState`\n- `getIsFocused`\n- `getIsReadonly`\n- `getNearestAdjacentShape`\n- `getNotVisibleShapes`\n- `getOnlySelectedShape`\n- `getOnlySelectedShapeId`\n- `getOutermostSelectableShape`\n- `getPage`\n- `getPages`\n- `getPageShapeIds`\n- `getPageStates`\n- `getPath`\n- `getPointInParentSpace`\n- `getPointInShapeSpace`\n- `getRenderingShapes`\n- `getRichTextEditor`\n- `getSelectedShapeAtPoint`\n- `getSelectedShapeIds`\n- `getSelectedShapes`\n- `getSelectionPageBounds`\n- `getSelectionRotatedPageBounds`\n- `getSelectionRotatedScreenBounds`\n- `getSelectionRotation`\n- `getSelectionScreenBounds`\n- `getShape`\n- `getShapeAncestors`\n- `getShapeAndDescendantIds`\n- `getShapeAtPoint`\n- `getShapeClipPath`\n- `getShapeGeometry`\n- `getShapeHandles`\n- `getShapeLocalTransform`\n- `getShapeMask`\n- `getShapeMaskedPageBounds`\n- `getShapePageBounds`\n- `getShapePageTransform`\n- `getShapeParent`\n- `getShapeParentTransform`\n- `getShapesAtPoint`\n- `getShapesPageBounds`\n- `getShapeStyleIfExists`\n- `getShapeUtil`\n- `getSharedOpacity`\n- `getSharedStyles`\n- `getSnapshot`\n- `getSortedChildIdsForParent`\n- `getStateDescendant`\n- `getStyleForNextShape`\n- `getSvgElement`\n- `getSvgString`\n- `getTemporaryAssetPreview`\n- `getTextOptions`\n- `getViewportPageBounds`\n- `getViewportScreenBounds`\n- `getViewportScreenCenter`\n- `getZoomLevel`\n- `groupShapes`\n- `hasAncestor`\n- `hasExternalAssetHandler`\n- `hasShapeUtil`\n- `interrupt`\n- `isAncestorSelected`\n- `isIn`\n- `isInAny`\n- `isPointInShape`\n- `isShapeHidden`\n- `isShapeInPage`\n- `isShapeOfType`\n- `isShapeOrAncestorLocked`\n- `loadSnapshot`\n- `markEventAsHandled`\n- `markHistoryStoppingPoint`\n- `moveShapesToPage`\n- `navigateToDeepLink`\n- `nudgeShapes`\n- `packShapes`\n- `pageToScreen`\n- `pageToViewport`\n- `popFocusedGroupId`\n- `putContentOntoCurrentPage`\n- `putExternalContent`\n- `redo`\n- `registerDeepLinkListener`\n- `registerExternalAssetHandler`\n- `registerExternalContentHandler`\n- `removeTool`\n- `renamePage`\n- `reparentShapes`\n- `replaceExternalContent`\n- `resetZoom`\n- `resizeShape`\n- `resolveAssetsInContent`\n- `resolveAssetUrl`\n- `rotateShapesBy`\n- `run`\n- `screenToPage`\n- `select`\n- `selectAdjacentShape`\n- `selectAll`\n- `selectFirstChildShape`\n- `selectNone`\n- `selectParentShape`\n- `sendBackward`\n- `sendToBack`\n- `setCamera`\n- `setCameraOptions`\n- `setCroppingShape`\n- `setCurrentPage`\n- `setCurrentTool`\n- `setCursor`\n- `setEditingShape`\n- `setErasingShapes`\n- `setFocusedGroup`\n- `setHintingShapes`\n- `setHoveredShape`\n- `setOpacityForNextShapes`\n- `setOpacityForSelectedShapes`\n- `setRichTextEditor`\n- `setSelectedShapes`\n- `setStyleForNextShapes`\n- `setStyleForSelectedShapes`\n- `setTool`\n- `slideCamera`\n- `squashToMark`\n- `stackShapes`\n- `startFollowingUser`\n- `stopCameraAnimation`\n- `stopFollowingUser`\n- `stretchShapes`\n- `toggleLock`\n- `toImage`\n- `toImageDataUrl`\n- `undo`\n- `ungroupShapes`\n- `updateAssets`\n- `updateBinding`\n- `updateBindings`\n- `updateCurrentPageState`\n- `updateDocumentSettings`\n- `updateInstanceState`\n- `updatePage`\n- `updatePointer`\n- `updateShape`\n- `updateShapes`\n- `updateViewportScreenBounds`\n- `uploadAsset`\n- `visitDescendants`\n- `wasEventAlreadyHandled`\n- `zoomIn`\n- `zoomOut`\n- `zoomToBounds`\n- `zoomToFit`\n- `zoomToSelection`\n- `zoomToSelectionIfOffscreen`\n- `zoomToUser`\n\n## Notes on Internal Methods\n\n- Names starting with `_` are generally internal implementation details.\n- Prefer non-underscored API methods for normal automation.\n- If an internal method is necessary for debugging, guard usage and verify behavior after use.\n",Q=`---
name: tweet-posting
description: Automate posting tweets to X (formerly Twitter). Use when the user wants to "post a tweet", "tweet about something", or "share an update on X". Handles navigation, content validation (no hashtags), and interaction with the X web interface.
---

# Tweet Posting Skill

This skill automates the process of posting a tweet on X.com. It handles the multi-step workflow of opening the composer, stripping hashtags, and confirming the post.

## Strict Guidelines

- **NO HASHTAGS**: Stripping hashtags is mandatory.
- **SNAPSHOT FIRST**: X.com uses dynamic IDs. Always run \`getSnapshot(page)\` to find fresh \`ref=eN\` references before every interaction.
- **VERIFY**: Log a screenshot before and after clicking "Post".

## UI Patterns & Selectors

| Element            | Role      | Name        | Selector Hint                     |
| :----------------- | :-------- | :---------- | :-------------------------------- |
| **Compose Button** | \`link\`    | "Post"      | Sidebar "Post" link               |
| **Post Textbox**   | \`textbox\` | "Post text" | \`[data-testid="tweetTextarea_0"]\` |
| **Submit Button**  | \`button\`  | "Post"      | \`[data-testid="tweetButton"]\`     |

## Workflow Example

\`\`\`javascript
// 1. Clean content (mandatory)
const cleanText = rawText.replace(/#\\w+/g, "").trim();

// 2. Open Composer (try sidebar first, then keyboard shortcut 'n')
let snapshot = await getSnapshot(page);
const postRef = snapshot.match(/link "Post" \\[ref=(e\\d+)\\]/)?.[1];
if (postRef) {
  await (await getElementByRef(page, postRef)).click();
} else {
  await page.keyboard.press("n");
}

// 3. Type text into the active textbox
await page.waitForSelector('[data-testid="tweetTextarea_0"]', { visible: true });
await page.type('[data-testid="tweetTextarea_0"]', cleanText);

// 4. Click Submit
snapshot = await getSnapshot(page);
const submitRef = snapshot.match(/button "Post" \\[ref=(e\\d+)\\]/)?.[1];
if (submitRef) {
  await (await getElementByRef(page, submitRef)).click();
} else {
  await page.click('[data-testid="tweetButton"]');
}
\`\`\`

## Troubleshooting

- **Login**: If on \`/login\`, stop and ask the user to sign in.
- **Drafts**: If a modal blocks you, check the snapshot for a "Close" or "Discard" button.
`,J=`---
name: twitter-scraper
description: A relentless tool for extracting historical data from X (Twitter). Use when the user needs deep-dive analysis, yearly syntheses, or bulk tweet exports.
---

# Relentless Twitter Scraper

When a user asks for a scraping job, you must be **relentless**. Do not stop until every requested tweet is captured, even if it requires dozens of scroll-and-wait cycles.

## Core Directives
1. **Be Relentless**: If the user asks for a year of data, do not provide a "sample." Navigate through the history using date-bounded search queries and scroll until the results are exhausted.
2. **Precision over Samples**: Avoid the main profile page for deep history. Use search filters (\`from:user since:YYYY-MM-DD\`).
3. **Handle Truncation**: When scraping hundreds of tweets, return the results in a way that avoids system truncation (e.g., summary stats + full data in a file).

## The Scraping Workflow
- **Initial Connection**: Use \`connectToPage\` and ensure the user is logged in.
- **The Loop**:
    - Use \`page.evaluate\` to grab current DOM state.
    - \`window.scrollBy(0, 4000)\`
    - \`await new Promise(r => setTimeout(r, 2000))\`
- **Deduplication**: Store results in a \`Set\` to handle the virtual list re-rendering the same elements.

## Technical Implementation Details

### Stable Selectors
- **Tweet Container**: \`article[data-testid="tweet"]\`
- **Tweet Text**: \`div[data-testid="tweetText"]\`
- **Metrics**: Search inside the article for buttons with \`data-testid\` of "reply", "retweet", and "like".
- **Views**: Look for the anchor tag containing "analytics" in the href.

### Metrics Extraction Snippet
\`\`\`bash
js -e <<'EOF'
const tweets = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('article[data-testid="tweet"]')).map(el => ({
    text: el.querySelector('div[data-testid="tweetText"]')?.textContent,
    likes: el.querySelector('button[data-testid="like"]')?.getAttribute('aria-label'),
    time: el.querySelector('time')?.getAttribute('datetime')
  }));
});
return tweets;
EOF
\`\`\`

### Search Queries
Use the URL bar for precision:
- \`https://x.com/search?q=from:[user]%20since:[date]%20until:[date]&f=live\`
`,Z=`---
name: youtube-transcript
description: Extract full transcript text from a YouTube video. Use when the user asks for a video's transcript, subtitles, or the text content of a YouTube video.
---

# YouTube Transcript Fetcher

Extracts the full text and timestamps from the YouTube transcript panel.

## Workflow

1.  **Identify Tab**: Use \`listTabs()\` to find the active YouTube video or navigate to the URL.
2.  **Verify UI State**: Check if the transcript is already open. Look for \`ytd-transcript-renderer\`.
3.  **Open Transcript (if needed)**:
    - **Expand Description**: Click the "more" button if the description is collapsed.
      Selector: \`ytd-text-inline-expander #expand\` or \`tp-yt-paper-button#expand\`
    - **Click Show Transcript**: Locate the "Show transcript" button.
      Primary Selector: \`ytd-video-description-transcript-section-renderer button\`
      Fallback: Find a \`ytd-button-renderer\` or \`button\` containing the text "Show transcript".
4.  **Wait for Load**: Wait 1-2 seconds for \`ytd-transcript-renderer\` to appear and for segments (\`ytd-transcript-segment-renderer\`) to populate.
5.  **Run Extraction**: Use \`page.evaluate()\` to extract transcript text:

\`\`\`bash
js -e <<'EOF'
const transcript = await page.evaluate(() => {
  const segments = document.querySelectorAll("ytd-transcript-segment-renderer");
  if (segments.length === 0) return null;

  return Array.from(segments)
    .map((s) => {
      const timestamp = s.querySelector(".segment-timestamp")?.textContent?.trim();
      const text = s.querySelector(".segment-text")?.textContent?.trim();
      return timestamp ? \`[\${timestamp}] \${text}\` : text;
    })
    .join("\\n");
});
return transcript;
EOF
\`\`\`

## Robust Opening Script

\`\`\`bash
js -e <<'EOF'
// Expand description if needed
try {
  const expandBtn = await page.$(
    "ytd-text-inline-expander #expand, #description-inline-expander #expand"
  );
  if (expandBtn) {
    await expandBtn.scrollIntoView();
    await expandBtn.click();
    await new Promise((r) => setTimeout(r, 500));
  }
} catch (e) {}

// Click Show Transcript
const showTranscriptSelector = "ytd-video-description-transcript-section-renderer button";
try {
  await page.waitForSelector(showTranscriptSelector, { visible: true, timeout: 3000 });
  await page.click(showTranscriptSelector);
} catch (e) {
  // Fallback: search by text
  await page.evaluate(() => {
    const buttons = Array.from(
      document.querySelectorAll("button, ytd-button-renderer, tp-yt-paper-button")
    );
    const btn = buttons.find((b) => b.textContent.toLowerCase().includes("show transcript"));
    if (btn) btn.click();
  });
}
await page.waitForSelector("ytd-transcript-segment-renderer", { timeout: 5000 });
EOF
\`\`\`

## Tips

- If "Show transcript" is missing, the video may not have a transcript available.
- For long transcripts, verify the text isn't truncated in the log output.
- The transcript panel might appear on the right side (desktop) or at the bottom.
`,ee=S.scoped("builtin-fs"),ne=Object.assign({"/sys/skills/figma-automation/SKILL.md":B,"/sys/skills/figma-automation/references/figma-api-cheatsheet.md":_,"/sys/skills/gmail-automation/SKILL.md":U,"/sys/skills/google-flights/SKILL.md":z,"/sys/skills/google-sheets/SKILL.md":G,"/sys/skills/linkedin-messaging/SKILL.md":$,"/sys/skills/quiz-creator/SKILL.md":H,"/sys/skills/quiz-creator/assets/template.html":q,"/sys/skills/skill-creator/SKILL.md":W,"/sys/skills/skill-creator/scripts/init_skill.sh":j,"/sys/skills/slideshow/SKILL.md":K,"/sys/skills/slideshow/template.html":V,"/sys/skills/tldraw/SKILL.md":X,"/sys/skills/tldraw/references/api-reference.md":Y,"/sys/skills/tweet-posting/SKILL.md":Q,"/sys/skills/twitter-scraper/SKILL.md":J,"/sys/skills/youtube-transcript/SKILL.md":Z}),I={};for(const[c,e]of Object.entries(ne))I[c]=e;class te{entries=new Map;buildTime=Date.now();constructor(){this.initializeFromGlob()}initializeFromGlob(){this.entries.set("/sys",{type:"directory",mode:493,mtime:this.buildTime});const e=new Set;for(const[n,t]of Object.entries(I)){const a=n,o=a.split("/").filter(Boolean);let r="";for(let l=0;l<o.length-1;l++)r+="/"+o[l],e.add(r);const s=new TextEncoder;this.entries.set(a,{type:"file",content:s.encode(t),mode:420,mtime:this.buildTime})}for(const n of e)this.entries.has(n)||this.entries.set(n,{type:"directory",mode:493,mtime:this.buildTime});ee.log(`Initialized with ${this.entries.size} entries`)}normalizePath(e){if(!e.startsWith("/sys"))throw new Error(`ENOENT: no such file or directory, '${e}'`);const n=e.split("/").filter(Boolean),t=[];for(const a of n)a===".."?t.pop():a!=="."&&t.push(a);return"/"+t.join("/")}readonlyError(e,n){throw new Error(`EROFS: read-only file system, ${e} '${n}'`)}async readFile(e,n){const t=this.normalizePath(e),a=this.entries.get(t);if(!a)throw new Error(`ENOENT: no such file or directory, open '${e}'`);if(a.type==="directory")throw new Error(`EISDIR: illegal operation on a directory, read '${e}'`);const o=g(n);return E(a.content,o)}async readFileBuffer(e){const n=this.normalizePath(e),t=this.entries.get(n);if(!t)throw new Error(`ENOENT: no such file or directory, open '${e}'`);if(t.type==="directory")throw new Error(`EISDIR: illegal operation on a directory, read '${e}'`);return t.content}async readdir(e){const n=this.normalizePath(e),t=this.entries.get(n);if(!t)throw new Error(`ENOENT: no such file or directory, scandir '${e}'`);if(t.type!=="directory")throw new Error(`ENOTDIR: not a directory, scandir '${e}'`);const a=n==="/sys"?"/sys/":n+"/",o=[];for(const r of this.entries.keys())if(r.startsWith(a)){const l=r.slice(a.length).split("/")[0];l&&!o.includes(l)&&o.push(l)}return o.sort()}async stat(e){const n=this.normalizePath(e),t=this.entries.get(n);if(!t)throw new Error(`ENOENT: no such file or directory, stat '${e}'`);return{isFile:t.type==="file",isDirectory:t.type==="directory",isSymbolicLink:!1,size:t.content?.length??0,mode:t.mode,mtime:new Date(t.mtime)}}async lstat(e){return this.stat(e)}async exists(e){try{const n=this.normalizePath(e);return this.entries.has(n)}catch{return!1}}async readlink(e){throw new Error(`EINVAL: invalid argument, readlink '${e}'`)}resolvePath(e,n){return n.startsWith("/")?this.normalizePath(n):this.normalizePath(e+"/"+n)}getAllPaths(){return Array.from(this.entries.keys()).sort()}getAllEntries(){const e=[];for(const[n,t]of this.entries)e.push({path:n,type:t.type,size:t.content?.length,mtime:t.mtime});return e}async writeFile(e,n,t){this.readonlyError("write",e)}async appendFile(e,n,t){this.readonlyError("append",e)}async mkdir(e,n){this.readonlyError("mkdir",e)}async rm(e,n){this.readonlyError("unlink",e)}async cp(e,n,t){this.readonlyError("copyfile",n)}async mv(e,n){this.readonlyError("rename",n)}async chmod(e,n){this.readonlyError("chmod",e)}async symlink(e,n){this.readonlyError("symlink",n)}async link(e,n){this.readonlyError("link",n)}async realpath(e){const n=this.normalizePath(e);if(!this.entries.has(n))throw new Error(`ENOENT: no such file or directory, realpath '${e}'`);return n}async utimes(e,n,t){this.readonlyError("utimes",e)}}let b=null;function k(){return b||(b=new te),b}const h=S.scoped("unified-fs");class T{constructor(e){this.indexedDBFs=e,this.ready=e.ready,e.on(n=>{this.emit(n)})}mounts=new Map;listeners=new Set;ready;on(e){this.listeners.add(e)}off(e){this.listeners.delete(e)}emit(e){for(const n of this.listeners)try{n(e)}catch(t){h.error("Error in event listener:",t)}}addMount(e,n,t,a="connected"){this.mounts.set(e,{name:e,fs:new M(n,t),handle:n,mode:t,mountedAt:Date.now(),status:a}),h.log(`Mounted ${e} (${t}, ${a})`)}removeMount(e){this.mounts.delete(e),h.log(`Unmounted ${e}`)}updateMountStatus(e,n){const t=this.mounts.get(e);t&&(t.status=n)}getMounts(){return Array.from(this.mounts.values()).map(e=>({name:e.name,handle:e.handle,mode:e.mode,mountedAt:e.mountedAt,lastAccessedAt:Date.now(),status:e.status,originalPath:e.handle.name}))}getMountNames(){return Array.from(this.mounts.keys())}hasMount(e){return this.mounts.has(e)}normalizePath(e){if(!e||e==="/")return"/";let n=e.endsWith("/")&&e!=="/"?e.slice(0,-1):e;n.startsWith("/")||(n=`/${n}`);const t=n.split("/").filter(o=>o&&o!=="."),a=[];for(const o of t)o===".."?a.pop():a.push(o);return`/${a.join("/")}`||"/"}resolve(e){const n=this.normalizePath(e);if(n==="/sys"||n.startsWith("/sys/"))return{fs:k(),relativePath:n,readOnly:!0,isMount:!1,isBuiltin:!0};if(n.startsWith("/mnt/")){const t=n.slice(5),a=t.indexOf("/"),o=a===-1?t:t.slice(0,a),r=a===-1?"":t.slice(a+1),s=this.mounts.get(o);if(s){if(s.status==="disconnected")throw h.error(`[unified-fs] EACCES: Mount "${o}" is disconnected. User must click "Re-authorize" in Settings > Mounted Directories before agent can access this mount.`),new Error(`EACCES: mount disconnected, please re-authorize: /mnt/${o}`);return{fs:s.fs,relativePath:r,readOnly:s.mode==="read",isMount:!0,isBuiltin:!1,mountName:o}}throw h.error(`[unified-fs] ENOENT: Mount "${o}" not found. Available mounts: [${this.getMountNames().join(", ")}]`),new Error(`ENOENT: mount not found: /mnt/${o}`)}return{fs:this.indexedDBFs,relativePath:n,readOnly:!1,isMount:!1,isBuiltin:!1}}async readFile(e,n){const{fs:t,relativePath:a,mountName:o}=this.resolve(e);return o&&this.updateLastAccess(o),t.readFile(a,n)}async readFileBuffer(e){const{fs:n,relativePath:t,mountName:a}=this.resolve(e);return a&&this.updateLastAccess(a),n.readFileBuffer(t)}async writeFile(e,n,t){const{fs:a,relativePath:o,readOnly:r,isMount:s,mountName:l}=this.resolve(e);if(r)throw new Error(`EROFS: read-only file system, write '${e}'`);l&&this.updateLastAccess(l),await a.writeFile(o,n,t),s&&this.emit({type:"write",path:this.normalizePath(e)})}async appendFile(e,n,t){const{fs:a,relativePath:o,readOnly:r,isMount:s,mountName:l}=this.resolve(e);if(r)throw new Error(`EROFS: read-only file system, write '${e}'`);l&&this.updateLastAccess(l),await a.appendFile(o,n,t),s&&this.emit({type:"write",path:this.normalizePath(e)})}async exists(e){if(this.normalizePath(e)==="/mnt")return!0;try{const{fs:t,relativePath:a}=this.resolve(e);return t.exists(a)}catch{return!1}}async stat(e){if(this.normalizePath(e)==="/mnt")return{isFile:!1,isDirectory:!0,isSymbolicLink:!1,mode:493,size:0,mtime:new Date};const{fs:t,relativePath:a,mountName:o}=this.resolve(e);return o&&this.updateLastAccess(o),t.stat(a)}async lstat(e){if(this.normalizePath(e)==="/mnt")return{isFile:!1,isDirectory:!0,isSymbolicLink:!1,mode:493,size:0,mtime:new Date};const{fs:t,relativePath:a,mountName:o}=this.resolve(e);return o&&this.updateLastAccess(o),t.lstat(a)}async mkdir(e,n){const{fs:t,relativePath:a,readOnly:o,isMount:r,mountName:s}=this.resolve(e);if(o)throw new Error(`EROFS: read-only file system, mkdir '${e}'`);s&&this.updateLastAccess(s),await t.mkdir(a,n),r&&this.emit({type:"mkdir",path:this.normalizePath(e)})}async readdir(e){if(this.normalizePath(e)==="/mnt")return this.getMountNames().map(r=>`${r}/`);const{fs:t,relativePath:a,mountName:o}=this.resolve(e);return o&&this.updateLastAccess(o),t.readdir(a)}async rm(e,n){const{fs:t,relativePath:a,readOnly:o,isMount:r,mountName:s}=this.resolve(e);if(o)throw new Error(`EROFS: read-only file system, rm '${e}'`);s&&this.updateLastAccess(s),await t.rm(a,n),r&&this.emit({type:"delete",path:this.normalizePath(e)})}async cp(e,n,t){const a=this.resolve(e),o=this.resolve(n);if(o.readOnly)throw new Error(`EROFS: read-only file system, cp '${n}'`);if(a.fs===o.fs)await a.fs.cp(a.relativePath,o.relativePath,t);else{const r=await a.fs.stat(a.relativePath);if(r.isFile){const s=await a.fs.readFileBuffer(a.relativePath);await o.fs.writeFile(o.relativePath,s)}else if(r.isDirectory){if(!t?.recursive)throw new Error(`EISDIR: is a directory, cp '${e}'`);await o.fs.mkdir(o.relativePath,{recursive:!0});const s=await a.fs.readdir(a.relativePath);for(const l of s){const i=l.endsWith("/")?l.slice(0,-1):l,d=`${e}/${i}`,p=`${n}/${i}`;await this.cp(d,p,t)}}}o.isMount&&this.emit({type:"write",path:this.normalizePath(n)})}async mv(e,n){const t=this.resolve(e),a=this.resolve(n);if(t.readOnly)throw new Error(`EROFS: read-only file system, mv '${e}'`);if(a.readOnly)throw new Error(`EROFS: read-only file system, mv '${n}'`);t.fs===a.fs?await t.fs.mv(t.relativePath,a.relativePath):(await this.cp(e,n,{recursive:!0}),await this.rm(e,{recursive:!0})),this.emit({type:"rename",path:this.normalizePath(e),newPath:this.normalizePath(n)})}async chmod(e,n){const{fs:t,relativePath:a,readOnly:o}=this.resolve(e);if(o)throw new Error(`EROFS: read-only file system, chmod '${e}'`);await t.chmod(a,n)}async symlink(e,n){const{fs:t,relativePath:a,readOnly:o,isMount:r}=this.resolve(n);if(r)throw new Error(`EPERM: operation not supported on native filesystem, symlink '${n}'`);if(o)throw new Error(`EROFS: read-only file system, symlink '${n}'`);await t.symlink(e,a)}async link(e,n){const t=this.resolve(e),a=this.resolve(n);if(t.isMount||a.isMount)throw new Error(`EPERM: operation not supported on native filesystem, link '${e}' '${n}'`);await t.fs.link(t.relativePath,a.relativePath)}async readlink(e){const{fs:n,relativePath:t,isMount:a}=this.resolve(e);if(a)throw new Error(`EINVAL: not a symbolic link, readlink '${e}'`);return n.readlink(t)}async realpath(e){const{fs:n,relativePath:t,isMount:a,mountName:o}=this.resolve(e);if(o&&this.updateLastAccess(o),a){const r=await n.realpath(t);return`/mnt/${o}${r}`}return"realpath"in n&&typeof n.realpath=="function"?n.realpath(t):this.normalizePath(e)}async utimes(e,n,t){const{fs:a,relativePath:o,readOnly:r,mountName:s}=this.resolve(e);if(r)throw new Error(`EROFS: read-only file system, utimes '${e}'`);s&&this.updateLastAccess(s),"utimes"in a&&typeof a.utimes=="function"&&await a.utimes(o,n,t)}resolvePath(e,n){if(n.startsWith("/"))return this.normalizePath(n);const t=e==="/"?`/${n}`:`${e}/${n}`;return this.normalizePath(t)}getAllPaths(){return h.warn("getAllPaths() called - returning empty array"),[]}async getAllEntries(){const e=await this.indexedDBFs.getAllEntries(),t=k().getAllEntries();for(const a of t)e.push(a);if(this.mounts.size>0){e.push({path:"/mnt",type:"directory",mtime:Date.now()});for(const[a,o]of this.mounts){if(o.status==="disconnected"){e.push({path:`/mnt/${a}`,type:"directory",mtime:o.mountedAt});continue}try{const r=await o.fs.getAllEntries();for(const s of r)e.push({...s,path:`/mnt/${a}${s.path}`});e.push({path:`/mnt/${a}`,type:"directory",mtime:o.mountedAt})}catch(r){h.error(`Failed to get entries from mount ${a}:`,r),o.status="disconnected",e.push({path:`/mnt/${a}`,type:"directory",mtime:o.mountedAt})}}}return e}getIndexedDBFs(){return this.indexedDBFs}updateLastAccess(e){this.mounts.get(e)}}let f=null,m=null;async function ae(c){return f||m||(m=(async()=>{let e;if(c)e=c;else{const{getFsInstance:i}=await y(async()=>{const{getFsInstance:d}=await import("./indexeddb-fs-Bt_2jXuF.js");return{getFsInstance:d}},__vite__mapDeps([0,1]));e=await i()}const n=new T(e);await n.ready;const{getStoredHandles:t}=await y(async()=>{const{getStoredHandles:i}=await import("./handle-store-BUxaqm9W.js");return{getStoredHandles:i}},[]),{queryPermission:a}=await y(async()=>{const{queryPermission:i}=await import("./permissions-D0zItE5S.js");return{queryPermission:i}},__vite__mapDeps([2,1])),o=await t();h.log(`Loading ${o.length} stored mount(s)...`);for(const i of o){h.log(`Checking permission for mount "${i.name}" (handle: ${i.handle.name}, mode: ${i.mode})`);const d=await a(i.handle,i.mode),p=d?"connected":"disconnected";h.log(`Mount "${i.name}" status: ${p}${d?"":" - User must re-authorize in Settings > Mounted Directories"}`),n.addMount(i.name,i.handle,i.mode,p)}const r=n.getMounts(),s=r.filter(i=>i.status==="connected").length,l=r.filter(i=>i.status==="disconnected").length;return h.log(`Mount summary: ${s} connected, ${l} disconnected`),l>0&&h.warn(`${l} mount(s) are disconnected and inaccessible to the agent. User must click "Re-authorize" button in sidebar Settings.`),f=n,m=null,n})(),m)}function oe(){if(!f)throw new Error("UnifiedFs not initialized. Call getUnifiedFsInstance() first.");return f}const ie=Object.freeze(Object.defineProperty({__proto__:null,UnifiedFs:T,getUnifiedFs:oe,getUnifiedFsInstance:ae},Symbol.toStringTag,{value:"Module"}));export{se as R,y as _,ae as a,oe as b,E as f,g,L as r,v as t,ie as u};
