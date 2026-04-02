import {
    connect
} from 'puppeteer-core/lib/esm/puppeteer/puppeteer-core-browser.js';

// Console Overrides for debugging

const SNAPSHOT_SCRIPT = `
(function() {
  // Skip if already injected
  if (window.__ariaSnapshot_get) return;

  // === domUtils ===
  let cacheStyle;
  let cachesCounter = 0;

  function beginDOMCaches() {
    ++cachesCounter;
    cacheStyle = cacheStyle || new Map();
  }

  function endDOMCaches() {
    if (!--cachesCounter) {
      cacheStyle = undefined;
    }
  }

  function getElementComputedStyle(element, pseudo) {
    const cache = cacheStyle;
    const cacheKey = pseudo ? undefined : element;
    if (cache && cacheKey && cache.has(cacheKey)) return cache.get(cacheKey);
    const style = element.ownerDocument && element.ownerDocument.defaultView
      ? element.ownerDocument.defaultView.getComputedStyle(element, pseudo)
      : undefined;
    if (cache && cacheKey) cache.set(cacheKey, style);
    return style;
  }

  function parentElementOrShadowHost(element) {
    if (element.parentElement) return element.parentElement;
    if (!element.parentNode) return;
    if (element.parentNode.nodeType === 11 && element.parentNode.host)
      return element.parentNode.host;
  }

  function enclosingShadowRootOrDocument(element) {
    let node = element;
    while (node.parentNode) node = node.parentNode;
    if (node.nodeType === 11 || node.nodeType === 9)
      return node;
  }

  function closestCrossShadow(element, css, scope) {
    while (element) {
      const closest = element.closest(css);
      if (scope && closest !== scope && closest?.contains(scope)) return;
      if (closest) return closest;
      element = enclosingShadowHost(element);
    }
  }

  function enclosingShadowHost(element) {
    while (element.parentElement) element = element.parentElement;
    return parentElementOrShadowHost(element);
  }

  function isElementStyleVisibilityVisible(element, style) {
    style = style || getElementComputedStyle(element);
    if (!style) return true;
    if (style.visibility !== "visible") return false;
    const detailsOrSummary = element.closest("details,summary");
    if (detailsOrSummary !== element && detailsOrSummary?.nodeName === "DETAILS" && !detailsOrSummary.open)
      return false;
    return true;
  }

  function computeBox(element) {
    const style = getElementComputedStyle(element);
    if (!style) return { visible: true, inline: false };
    const cursor = style.cursor;
    if (style.display === "contents") {
      for (let child = element.firstChild; child; child = child.nextSibling) {
        if (child.nodeType === 1 && isElementVisible(child))
          return { visible: true, inline: false, cursor };
        if (child.nodeType === 3 && isVisibleTextNode(child))
          return { visible: true, inline: true, cursor };
      }
      return { visible: false, inline: false, cursor };
    }
    if (!isElementStyleVisibilityVisible(element, style))
      return { cursor, visible: false, inline: false };
    const rect = element.getBoundingClientRect();
    return { rect, cursor, visible: rect.width > 0 && rect.height > 0, inline: style.display === "inline" };
  }

  function isElementVisible(element) {
    return computeBox(element).visible;
  }

  function isVisibleTextNode(node) {
    const range = node.ownerDocument.createRange();
    range.selectNode(node);
    const rect = range.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function elementSafeTagName(element) {
    const tagName = element.tagName;
    if (typeof tagName === "string") return tagName.toUpperCase();
    if (element instanceof HTMLFormElement) return "FORM";
    return element.tagName.toUpperCase();
  }

  function normalizeWhiteSpace(text) {
    return text.split("\\u00A0").map(chunk =>
      chunk.replace(/\\r\\n/g, "\\n").replace(/[\\u200b\\u00ad]/g, "").replace(/\\s\\s*/g, " ")
    ).join("\\u00A0").trim();
  }

  // === yaml ===
  function yamlEscapeKeyIfNeeded(str) {
    if (!yamlStringNeedsQuotes(str)) return str;
    return "'" + str.replace(/'/g, "''") + "'";
  }

  function yamlEscapeValueIfNeeded(str) {
    if (!yamlStringNeedsQuotes(str)) return str;
    return '"' + str.replace(/[\\\\"\0-\\x1f\\x7f-\\x9f]/g, c => {
      switch (c) {
        case "\\\\": return "\\\\\\\\";
        case '"': return '\\\\"';
        case "\\b": return "\\\\b";
        case "\\f": return "\\\\f";
        case "\\n": return "\\\\n";
        case "\\r": return "\\\\r";
        case "\\t": return "\\\\t";
        default:
          const code = c.charCodeAt(0);
          return "\\\\x" + code.toString(16).padStart(2, "0");
      }
    }) + '"';
  }

  function yamlStringNeedsQuotes(str) {
    if (str.length === 0) return true;
    if (/^\\s|\\s$/.test(str)) return true;
    if (/[\\x00-\\x08\\x0b\\x0c\\x0e-\\x1f\\x7f-\\x9f]/.test(str)) return true;
    if (/^-/.test(str)) return true;
    if (/[\\n:](\\s|$)/.test(str)) return true;
    if (/\\s#/.test(str)) return true;
    if (/[\\n\\r]/.test(str)) return true;
    if (/^[&*\\],?!>|@"'#%]/.test(str)) return true;
    if (/[{}]/.test(str)) return true;
    if (/^\\[/.test(str)) return true;
    if (!isNaN(Number(str)) || ["y","n","yes","no","true","false","on","off","null"].includes(str.toLowerCase())) return true;
    return false;
  }

  // === roleUtils ===
  const validRoles = ["alert","alertdialog","application","article","banner","blockquote","button","caption","cell","checkbox","code","columnheader","combobox","complementary","contentinfo","definition","deletion","dialog","directory","document","emphasis","feed","figure","form","generic","grid","gridcell","group","heading","img","insertion","link","list","listbox","listitem","log","main","mark","marquee","math","meter","menu","menubar","menuitem","menuitemcheckbox","menuitemradio","navigation","none","note","option","paragraph","presentation","progressbar","radio","radiogroup","region","row","rowgroup","rowheader","scrollbar","search","searchbox","separator","slider","spinbutton","status","strong","subscript","superscript","switch","tab","table","tablist","tabpanel","term","textbox","time","timer","toolbar","tooltip","tree","treegrid","treeitem"];

  let cacheAccessibleName;
  let cacheIsHidden;
  let cachePointerEvents;
  let ariaCachesCounter = 0;

  function beginAriaCaches() {
    beginDOMCaches();
    ++ariaCachesCounter;
    cacheAccessibleName = cacheAccessibleName || new Map();
    cacheIsHidden = cacheIsHidden || new Map();
    cachePointerEvents = cachePointerEvents || new Map();
  }

  function endAriaCaches() {
    if (!--ariaCachesCounter) {
      cacheAccessibleName = undefined;
      cacheIsHidden = undefined;
      cachePointerEvents = undefined;
    }
    endDOMCaches();
  }

  function hasExplicitAccessibleName(e) {
    return e.hasAttribute("aria-label") || e.hasAttribute("aria-labelledby");
  }

  const kAncestorPreventingLandmark = "article:not([role]), aside:not([role]), main:not([role]), nav:not([role]), section:not([role]), [role=article], [role=complementary], [role=main], [role=navigation], [role=region]";

  const kGlobalAriaAttributes = [
    ["aria-atomic", undefined],["aria-busy", undefined],["aria-controls", undefined],["aria-current", undefined],
    ["aria-describedby", undefined],["aria-details", undefined],["aria-dropeffect", undefined],["aria-flowto", undefined],
    ["aria-grabbed", undefined],["aria-hidden", undefined],["aria-keyshortcuts", undefined],
    ["aria-label", ["caption","code","deletion","emphasis","generic","insertion","paragraph","presentation","strong","subscript","superscript"]],
    ["aria-labelledby", ["caption","code","deletion","emphasis","generic","insertion","paragraph","presentation","strong","subscript","superscript"]],
    ["aria-live", undefined],["aria-owns", undefined],["aria-relevant", undefined],["aria-roledescription", ["generic"]]
  ];

  function hasGlobalAriaAttribute(element, forRole) {
    return kGlobalAriaAttributes.some(([attr, prohibited]) => !prohibited?.includes(forRole || "") && element.hasAttribute(attr));
  }

  function hasTabIndex(element) {
    return !Number.isNaN(Number(String(element.getAttribute("tabindex"))));
  }

  function isFocusable(element) {
    return !isNativelyDisabled(element) && (isNativelyFocusable(element) || hasTabIndex(element));
  }

  function isNativelyFocusable(element) {
    const tagName = elementSafeTagName(element);
    if (["BUTTON","DETAILS","SELECT","TEXTAREA"].includes(tagName)) return true;
    if (tagName === "A" || tagName === "AREA") return element.hasAttribute("href");
    if (tagName === "INPUT") return !element.hidden;
    return false;
  }

  function isNativelyDisabled(element) {
    const isNativeFormControl = ["BUTTON","INPUT","SELECT","TEXTAREA","OPTION","OPTGROUP"].includes(elementSafeTagName(element));
    return isNativeFormControl && (element.hasAttribute("disabled") || belongsToDisabledFieldSet(element));
  }

  function belongsToDisabledFieldSet(element) {
    const fieldSetElement = element?.closest("FIELDSET[DISABLED]");
    if (!fieldSetElement) return false;
    const legendElement = fieldSetElement.querySelector(":scope > LEGEND");
    return !legendElement || !legendElement.contains(element);
  }

  const inputTypeToRole = {button:"button",checkbox:"checkbox",image:"button",number:"spinbutton",radio:"radio",range:"slider",reset:"button",submit:"button"};

  function getIdRefs(element, ref) {
    if (!ref) return [];
    const root = enclosingShadowRootOrDocument(element);
    if (!root) return [];
    try {
      const ids = ref.split(" ").filter(id => !!id);
      const result = [];
      for (const id of ids) {
        const firstElement = root.querySelector("#" + CSS.escape(id));
        if (firstElement && !result.includes(firstElement)) result.push(firstElement);
      }
      return result;
    } catch { return []; }
  }

  const kImplicitRoleByTagName = {
    A: e => e.hasAttribute("href") ? "link" : null,
    AREA: e => e.hasAttribute("href") ? "link" : null,
    ARTICLE: () => "article", ASIDE: () => "complementary", BLOCKQUOTE: () => "blockquote", BUTTON: () => "button",
    CAPTION: () => "caption", CODE: () => "code", DATALIST: () => "listbox", DD: () => "definition",
    DEL: () => "deletion", DETAILS: () => "group", DFN: () => "term", DIALOG: () => "dialog", DT: () => "term",
    EM: () => "emphasis", FIELDSET: () => "group", FIGURE: () => "figure",
    FOOTER: e => closestCrossShadow(e, kAncestorPreventingLandmark) ? null : "contentinfo",
    FORM: e => hasExplicitAccessibleName(e) ? "form" : null,
    H1: () => "heading", H2: () => "heading", H3: () => "heading", H4: () => "heading", H5: () => "heading", H6: () => "heading",
    HEADER: e => closestCrossShadow(e, kAncestorPreventingLandmark) ? null : "banner",
    HR: () => "separator", HTML: () => "document",
    IMG: e => e.getAttribute("alt") === "" && !e.getAttribute("title") && !hasGlobalAriaAttribute(e) && !hasTabIndex(e) ? "presentation" : "img",
    INPUT: e => {
      const type = e.type.toLowerCase();
      if (type === "search") return e.hasAttribute("list") ? "combobox" : "searchbox";
      if (["email","tel","text","url",""].includes(type)) {
        const list = getIdRefs(e, e.getAttribute("list"))[0];
        return list && elementSafeTagName(list) === "DATALIST" ? "combobox" : "textbox";
      }
      if (type === "hidden") return null;
      if (type === "file") return "button";
      return inputTypeToRole[type] || "textbox";
    },
    INS: () => "insertion", LI: () => "listitem", MAIN: () => "main", MARK: () => "mark", MATH: () => "math",
    MENU: () => "list", METER: () => "meter", NAV: () => "navigation", OL: () => "list", OPTGROUP: () => "group",
    OPTION: () => "option", OUTPUT: () => "status", P: () => "paragraph", PROGRESS: () => "progressbar",
    SEARCH: () => "search", SECTION: e => hasExplicitAccessibleName(e) ? "region" : null,
    SELECT: e => e.hasAttribute("multiple") || e.size > 1 ? "listbox" : "combobox",
    STRONG: () => "strong", SUB: () => "subscript", SUP: () => "superscript", SVG: () => "img",
    TABLE: () => "table", TBODY: () => "rowgroup",
    TD: e => { const table = closestCrossShadow(e, "table"); const role = table ? getExplicitAriaRole(table) : ""; return role === "grid" || role === "treegrid" ? "gridcell" : "cell"; },
    TEXTAREA: () => "textbox", TFOOT: () => "rowgroup",
    TH: e => { const scope = e.getAttribute("scope"); if (scope === "col" || scope === "colgroup") return "columnheader"; if (scope === "row" || scope === "rowgroup") return "rowheader"; return "columnheader"; },
    THEAD: () => "rowgroup", TIME: () => "time", TR: () => "row", UL: () => "list"
  };

  function getExplicitAriaRole(element) {
    const roles = (element.getAttribute("role") || "").split(" ").map(role => role.trim());
    return roles.find(role => validRoles.includes(role)) || null;
  }

  function getImplicitAriaRole(element) {
    const fn = kImplicitRoleByTagName[elementSafeTagName(element)];
    return fn ? fn(element) : null;
  }

  function hasPresentationConflictResolution(element, role) {
    return hasGlobalAriaAttribute(element, role) || isFocusable(element);
  }

  function getAriaRole(element) {
    const explicitRole = getExplicitAriaRole(element);
    if (!explicitRole) return getImplicitAriaRole(element);
    if (explicitRole === "none" || explicitRole === "presentation") {
      const implicitRole = getImplicitAriaRole(element);
      if (hasPresentationConflictResolution(element, implicitRole)) return implicitRole;
    }
    return explicitRole;
  }

  function getAriaBoolean(attr) {
    return attr === null ? undefined : attr.toLowerCase() === "true";
  }

  function isElementIgnoredForAria(element) {
    return ["STYLE","SCRIPT","NOSCRIPT","TEMPLATE"].includes(elementSafeTagName(element));
  }

  function isElementHiddenForAria(element) {
    if (isElementIgnoredForAria(element)) return true;
    const style = getElementComputedStyle(element);
    const isSlot = element.nodeName === "SLOT";
    if (style?.display === "contents" && !isSlot) {
      for (let child = element.firstChild; child; child = child.nextSibling) {
        if (child.nodeType === 1 && !isElementHiddenForAria(child)) return false;
        if (child.nodeType === 3 && isVisibleTextNode(child)) return false;
      }
      return true;
    }
    const isOptionInsideSelect = element.nodeName === "OPTION" && !!element.closest("select");
    if (!isOptionInsideSelect && !isSlot && !isElementStyleVisibilityVisible(element, style)) return true;
    return belongsToDisplayNoneOrAriaHiddenOrNonSlotted(element);
  }

  function belongsToDisplayNoneOrAriaHiddenOrNonSlotted(element) {
    let hidden = cacheIsHidden?.get(element);
    if (hidden === undefined) {
      hidden = false;
      if (element.parentElement && element.parentElement.shadowRoot && !element.assignedSlot) hidden = true;
      if (!hidden) {
        const style = getElementComputedStyle(element);
        hidden = !style || style.display === "none" || getAriaBoolean(element.getAttribute("aria-hidden")) === true;
      }
      if (!hidden) {
        const parent = parentElementOrShadowHost(element);
        if (parent) hidden = belongsToDisplayNoneOrAriaHiddenOrNonSlotted(parent);
      }
      cacheIsHidden?.set(element, hidden);
    }
    return hidden;
  }

  function getAriaLabelledByElements(element) {
    const ref = element.getAttribute("aria-labelledby");
    if (ref === null) return null;
    const refs = getIdRefs(element, ref);
    return refs.length ? refs : null;
  }

  function getElementAccessibleName(element, includeHidden) {
    let accessibleName = cacheAccessibleName?.get(element);
    if (accessibleName === undefined) {
      accessibleName = "";
      const elementProhibitsNaming = ["caption","code","definition","deletion","emphasis","generic","insertion","mark","paragraph","presentation","strong","subscript","suggestion","superscript","term","time"].includes(getAriaRole(element) || "");
      if (!elementProhibitsNaming) {
        accessibleName = normalizeWhiteSpace(getTextAlternativeInternal(element, { includeHidden, visitedElements: new Set(), embeddedInTargetElement: "self" }));
      }
      cacheAccessibleName?.set(element, accessibleName);
    }
    return accessibleName;
  }

  function getTextAlternativeInternal(element, options) {
    if (options.visitedElements.has(element)) return "";
    const childOptions = { ...options, embeddedInTargetElement: options.embeddedInTargetElement === "self" ? "descendant" : options.embeddedInTargetElement };

    if (!options.includeHidden) {
      const isEmbeddedInHiddenReferenceTraversal = !!options.embeddedInLabelledBy?.hidden || !!options.embeddedInLabel?.hidden;
      if (isElementIgnoredForAria(element) || (!isEmbeddedInHiddenReferenceTraversal && isElementHiddenForAria(element))) {
        options.visitedElements.add(element);
        return "";
      }
    }

    const labelledBy = getAriaLabelledByElements(element);
    if (!options.embeddedInLabelledBy) {
      const accessibleName = (labelledBy || []).map(ref => getTextAlternativeInternal(ref, { ...options, embeddedInLabelledBy: { element: ref, hidden: isElementHiddenForAria(ref) }, embeddedInTargetElement: undefined, embeddedInLabel: undefined })).join(" ");
      if (accessibleName) return accessibleName;
    }

    const role = getAriaRole(element) || "";
    const tagName = elementSafeTagName(element);

    const ariaLabel = element.getAttribute("aria-label") || "";
    if (ariaLabel.trim()) { options.visitedElements.add(element); return ariaLabel; }

    if (!["presentation","none"].includes(role)) {
      if (tagName === "INPUT" && ["button","submit","reset"].includes(element.type)) {
        options.visitedElements.add(element);
        const value = element.value || "";
        if (value.trim()) return value;
        if (element.type === "submit") return "Submit";
        if (element.type === "reset") return "Reset";
        return element.getAttribute("title") || "";
      }
      if (tagName === "INPUT" && element.type === "image") {
        options.visitedElements.add(element);
        const alt = element.getAttribute("alt") || "";
        if (alt.trim()) return alt;
        const title = element.getAttribute("title") || "";
        if (title.trim()) return title;
        return "Submit";
      }
      if (tagName === "IMG") {
        options.visitedElements.add(element);
        const alt = element.getAttribute("alt") || "";
        if (alt.trim()) return alt;
        return element.getAttribute("title") || "";
      }
      if (!labelledBy && ["BUTTON","INPUT","TEXTAREA","SELECT"].includes(tagName)) {
        const labels = element.labels;
        if (labels?.length) {
          options.visitedElements.add(element);
          return [...labels].map(label => getTextAlternativeInternal(label, { ...options, embeddedInLabel: { element: label, hidden: isElementHiddenForAria(label) }, embeddedInLabelledBy: undefined, embeddedInTargetElement: undefined })).filter(name => !!name).join(" ");
        }
      }
    }

    const allowsNameFromContent = ["button","cell","checkbox","columnheader","gridcell","heading","link","menuitem","menuitemcheckbox","menuitemradio","option","radio","row","rowheader","switch","tab","tooltip","treeitem"].includes(role);
    if (allowsNameFromContent || !!options.embeddedInLabelledBy || !!options.embeddedInLabel) {
      options.visitedElements.add(element);
      const accessibleName = innerAccumulatedElementText(element, childOptions);
      const maybeTrimmedAccessibleName = options.embeddedInTargetElement === "self" ? accessibleName.trim() : accessibleName;
      if (maybeTrimmedAccessibleName) return accessibleName;
    }

    if (!["presentation","none"].includes(role) || tagName === "IFRAME") {
      options.visitedElements.add(element);
      const title = element.getAttribute("title") || "";
      if (title.trim()) return title;
    }

    options.visitedElements.add(element);
    return "";
  }

  function innerAccumulatedElementText(element, options) {
    const tokens = [];
    const visit = (node, skipSlotted) => {
      if (skipSlotted && node.assignedSlot) return;
      if (node.nodeType === 1) {
        const display = getElementComputedStyle(node)?.display || "inline";
        let token = getTextAlternativeInternal(node, options);
        if (display !== "inline" || node.nodeName === "BR") token = " " + token + " ";
        tokens.push(token);
      } else if (node.nodeType === 3) {
        tokens.push(node.textContent || "");
      }
    };
    const assignedNodes = element.nodeName === "SLOT" ? element.assignedNodes() : [];
    if (assignedNodes.length) {
      for (const child of assignedNodes) visit(child, false);
    } else {
      for (let child = element.firstChild; child; child = child.nextSibling) visit(child, true);
      if (element.shadowRoot) {
        for (let child = element.shadowRoot.firstChild; child; child = child.nextSibling) visit(child, true);
      }
    }
    return tokens.join("");
  }

  const kAriaCheckedRoles = ["checkbox","menuitemcheckbox","option","radio","switch","menuitemradio","treeitem"];
  function getAriaChecked(element) {
    const tagName = elementSafeTagName(element);
    if (tagName === "INPUT" && element.indeterminate) return "mixed";
    if (tagName === "INPUT" && ["checkbox","radio"].includes(element.type)) return element.checked;
    if (kAriaCheckedRoles.includes(getAriaRole(element) || "")) {
      const checked = element.getAttribute("aria-checked");
      if (checked === "true") return true;
      if (checked === "mixed") return "mixed";
      return false;
    }
    return false;
  }

  const kAriaDisabledRoles = ["application","button","composite","gridcell","group","input","link","menuitem","scrollbar","separator","tab","checkbox","columnheader","combobox","grid","listbox","menu","menubar","menuitemcheckbox","menuitemradio","option","radio","radiogroup","row","rowheader","searchbox","select","slider","spinbutton","switch","tablist","textbox","toolbar","tree","treegrid","treeitem"];
  function getAriaDisabled(element) {
    return isNativelyDisabled(element) || hasExplicitAriaDisabled(element);
  }
  function hasExplicitAriaDisabled(element, isAncestor) {
    if (!element) return false;
    if (isAncestor || kAriaDisabledRoles.includes(getAriaRole(element) || "")) {
      const attribute = (element.getAttribute("aria-disabled") || "").toLowerCase();
      if (attribute === "true") return true;
      if (attribute === "false") return false;
      return hasExplicitAriaDisabled(parentElementOrShadowHost(element), true);
    }
    return false;
  }

  const kAriaExpandedRoles = ["application","button","checkbox","combobox","gridcell","link","listbox","menuitem","row","rowheader","tab","treeitem","columnheader","menuitemcheckbox","menuitemradio","switch"];
  function getAriaExpanded(element) {
    if (elementSafeTagName(element) === "DETAILS") return element.open;
    if (kAriaExpandedRoles.includes(getAriaRole(element) || "")) {
      const expanded = element.getAttribute("aria-expanded");
      if (expanded === null) return undefined;
      if (expanded === "true") return true;
      return false;
    }
    return undefined;
  }

  const kAriaLevelRoles = ["heading","listitem","row","treeitem"];
  function getAriaLevel(element) {
    const native = {H1:1,H2:2,H3:3,H4:4,H5:5,H6:6}[elementSafeTagName(element)];
    if (native) return native;
    if (kAriaLevelRoles.includes(getAriaRole(element) || "")) {
      const attr = element.getAttribute("aria-level");
      const value = attr === null ? Number.NaN : Number(attr);
      if (Number.isInteger(value) && value >= 1) return value;
    }
    return 0;
  }

  const kAriaPressedRoles = ["button"];
  function getAriaPressed(element) {
    if (kAriaPressedRoles.includes(getAriaRole(element) || "")) {
      const pressed = element.getAttribute("aria-pressed");
      if (pressed === "true") return true;
      if (pressed === "mixed") return "mixed";
    }
    return false;
  }

  const kAriaSelectedRoles = ["gridcell","option","row","tab","rowheader","columnheader","treeitem"];
  function getAriaSelected(element) {
    if (elementSafeTagName(element) === "OPTION") return element.selected;
    if (kAriaSelectedRoles.includes(getAriaRole(element) || "")) return getAriaBoolean(element.getAttribute("aria-selected")) === true;
    return false;
  }

  function receivesPointerEvents(element) {
    const cache = cachePointerEvents;
    let e = element;
    let result;
    const parents = [];
    for (; e; e = parentElementOrShadowHost(e)) {
      const cached = cache?.get(e);
      if (cached !== undefined) { result = cached; break; }
      parents.push(e);
      const style = getElementComputedStyle(e);
      if (!style) { result = true; break; }
      const value = style.pointerEvents;
      if (value) { result = value !== "none"; break; }
    }
    if (result === undefined) result = true;
    for (const parent of parents) cache?.set(parent, result);
    return result;
  }

  function getCSSContent(element, pseudo) {
    const style = getElementComputedStyle(element, pseudo);
    if (!style) return undefined;
    const contentValue = style.content;
    if (!contentValue || contentValue === "none" || contentValue === "normal") return undefined;
    if (style.display === "none" || style.visibility === "hidden") return undefined;
    const match = contentValue.match(/^"(.*)"$/);
    if (match) {
      const content = match[1].replace(/\\\\"/g, '"');
      if (pseudo) {
        const display = style.display || "inline";
        if (display !== "inline") return " " + content + " ";
      }
      return content;
    }
    return undefined;
  }

  // === ariaSnapshot ===
  let lastRef = 0;

  function generateAriaTree(rootElement) {
    const options = { visibility: "ariaOrVisible", refs: "interactable", refPrefix: "", includeGenericRole: true, renderActive: true, renderCursorPointer: true };
    const visited = new Set();
    const snapshot = {
      root: { role: "fragment", name: "", children: [], element: rootElement, props: {}, box: computeBox(rootElement), receivesPointerEvents: true },
      elements: new Map(),
      refs: new Map(),
      iframeRefs: []
    };

    const visit = (ariaNode, node, parentElementVisible) => {
      if (visited.has(node)) return;
      visited.add(node);
      if (node.nodeType === Node.TEXT_NODE && node.nodeValue) {
        if (!parentElementVisible) return;
        const text = node.nodeValue;
        if (ariaNode.role !== "textbox" && text) ariaNode.children.push(node.nodeValue || "");
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const element = node;
      const isElementVisibleForAria = !isElementHiddenForAria(element);
      let visible = isElementVisibleForAria;
      if (options.visibility === "ariaOrVisible") visible = isElementVisibleForAria || isElementVisible(element);
      if (options.visibility === "ariaAndVisible") visible = isElementVisibleForAria && isElementVisible(element);
      if (options.visibility === "aria" && !visible) return;
      const ariaChildren = [];
      if (element.hasAttribute("aria-owns")) {
        const ids = element.getAttribute("aria-owns").split(/\\s+/);
        for (const id of ids) {
          const ownedElement = rootElement.ownerDocument.getElementById(id);
          if (ownedElement) ariaChildren.push(ownedElement);
        }
      }
      const childAriaNode = visible ? toAriaNode(element, options) : null;
      if (childAriaNode) {
        if (childAriaNode.ref) {
          snapshot.elements.set(childAriaNode.ref, element);
          snapshot.refs.set(element, childAriaNode.ref);
          if (childAriaNode.role === "iframe") snapshot.iframeRefs.push(childAriaNode.ref);
        }
        ariaNode.children.push(childAriaNode);
      }
      processElement(childAriaNode || ariaNode, element, ariaChildren, visible);
    };

    function processElement(ariaNode, element, ariaChildren, parentElementVisible) {
      const display = getElementComputedStyle(element)?.display || "inline";
      const treatAsBlock = display !== "inline" || element.nodeName === "BR" ? " " : "";
      if (treatAsBlock) ariaNode.children.push(treatAsBlock);
      ariaNode.children.push(getCSSContent(element, "::before") || "");
      const assignedNodes = element.nodeName === "SLOT" ? element.assignedNodes() : [];
      if (assignedNodes.length) {
        for (const child of assignedNodes) visit(ariaNode, child, parentElementVisible);
      } else {
        for (let child = element.firstChild; child; child = child.nextSibling) {
          if (!child.assignedSlot) visit(ariaNode, child, parentElementVisible);
        }
        if (element.shadowRoot) {
          for (let child = element.shadowRoot.firstChild; child; child = child.nextSibling) visit(ariaNode, child, parentElementVisible);
        }
      }
      for (const child of ariaChildren) visit(ariaNode, child, parentElementVisible);
      ariaNode.children.push(getCSSContent(element, "::after") || "");
      if (treatAsBlock) ariaNode.children.push(treatAsBlock);
      if (ariaNode.children.length === 1 && ariaNode.name === ariaNode.children[0]) ariaNode.children = [];
      if (ariaNode.role === "link" && element.hasAttribute("href")) ariaNode.props["url"] = element.getAttribute("href");
      if (ariaNode.role === "textbox" && element.hasAttribute("placeholder") && element.getAttribute("placeholder") !== ariaNode.name) ariaNode.props["placeholder"] = element.getAttribute("placeholder");
    }

    beginAriaCaches();
    try { visit(snapshot.root, rootElement, true); }
    finally { endAriaCaches(); }
    normalizeStringChildren(snapshot.root);
    normalizeGenericRoles(snapshot.root);
    return snapshot;
  }

  function computeAriaRef(ariaNode, options) {
    if (options.refs === "none") return;
    if (options.refs === "interactable" && (!ariaNode.box.visible || !ariaNode.receivesPointerEvents)) return;
    let ariaRef = ariaNode.element._ariaRef;
    if (!ariaRef || ariaRef.role !== ariaNode.role || ariaRef.name !== ariaNode.name) {
      ariaRef = { role: ariaNode.role, name: ariaNode.name, ref: (options.refPrefix || "") + "e" + (++lastRef) };
      ariaNode.element._ariaRef = ariaRef;
    }
    ariaNode.ref = ariaRef.ref;
  }

  function toAriaNode(element, options) {
    const active = element.ownerDocument.activeElement === element;
    if (element.nodeName === "IFRAME") {
      const ariaNode = { role: "iframe", name: "", children: [], props: {}, element, box: computeBox(element), receivesPointerEvents: true, active };
      computeAriaRef(ariaNode, options);
      return ariaNode;
    }
    const defaultRole = options.includeGenericRole ? "generic" : null;
    const role = getAriaRole(element) || defaultRole;
    if (!role || role === "presentation" || role === "none") return null;
    const name = normalizeWhiteSpace(getElementAccessibleName(element, false) || "");
    const receivesPointerEventsValue = receivesPointerEvents(element);
    const box = computeBox(element);
    if (role === "generic" && box.inline && element.childNodes.length === 1 && element.childNodes[0].nodeType === Node.TEXT_NODE) return null;
    const result = { role, name, children: [], props: {}, element, box, receivesPointerEvents: receivesPointerEventsValue, active };
    computeAriaRef(result, options);
    if (kAriaCheckedRoles.includes(role)) result.checked = getAriaChecked(element);
    if (kAriaDisabledRoles.includes(role)) result.disabled = getAriaDisabled(element);
    if (kAriaExpandedRoles.includes(role)) result.expanded = getAriaExpanded(element);
    if (kAriaLevelRoles.includes(role)) result.level = getAriaLevel(element);
    if (kAriaPressedRoles.includes(role)) result.pressed = getAriaPressed(element);
    if (kAriaSelectedRoles.includes(role)) result.selected = getAriaSelected(element);
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      if (element.type !== "checkbox" && element.type !== "radio" && element.type !== "file") result.children = [element.value];
    }
    return result;
  }

  function normalizeGenericRoles(node) {
    const normalizeChildren = (node) => {
      const result = [];
      for (const child of node.children || []) {
        if (typeof child === "string") { result.push(child); continue; }
        const normalized = normalizeChildren(child);
        result.push(...normalized);
      }
      const removeSelf = node.role === "generic" && !node.name && result.length <= 1 && result.every(c => typeof c !== "string" && !!c.ref);
      if (removeSelf) return result;
      node.children = result;
      return [node];
    };
    normalizeChildren(node);
  }

  function normalizeStringChildren(rootA11yNode) {
    const flushChildren = (buffer, normalizedChildren) => {
      if (!buffer.length) return;
      const text = normalizeWhiteSpace(buffer.join(""));
      if (text) normalizedChildren.push(text);
      buffer.length = 0;
    };
    const visit = (ariaNode) => {
      const normalizedChildren = [];
      const buffer = [];
      for (const child of ariaNode.children || []) {
        if (typeof child === "string") { buffer.push(child); }
        else { flushChildren(buffer, normalizedChildren); visit(child); normalizedChildren.push(child); }
      }
      flushChildren(buffer, normalizedChildren);
      ariaNode.children = normalizedChildren.length ? normalizedChildren : [];
      if (ariaNode.children.length === 1 && ariaNode.children[0] === ariaNode.name) ariaNode.children = [];
    };
    visit(rootA11yNode);
  }

  function hasPointerCursor(ariaNode) { return ariaNode.box.cursor === "pointer"; }

  function renderAriaTree(ariaSnapshot) {
    const options = { visibility: "ariaOrVisible", refs: "interactable", refPrefix: "", includeGenericRole: true, renderActive: true, renderCursorPointer: true };
    const lines = [];
    let nodesToRender = ariaSnapshot.root.role === "fragment" ? ariaSnapshot.root.children : [ariaSnapshot.root];

    const visitText = (text, indent) => {
      const escaped = yamlEscapeValueIfNeeded(text);
      if (escaped) lines.push(indent + "- text: " + escaped);
    };

    const createKey = (ariaNode, renderCursorPointer) => {
      let key = ariaNode.role;
      if (ariaNode.name && ariaNode.name.length <= 900) {
        const name = ariaNode.name;
        if (name) {
          const stringifiedName = name.startsWith("/") && name.endsWith("/") ? name : JSON.stringify(name);
          key += " " + stringifiedName;
        }
      }
      if (ariaNode.checked === "mixed") key += " [checked=mixed]";
      if (ariaNode.checked === true) key += " [checked]";
      if (ariaNode.disabled) key += " [disabled]";
      if (ariaNode.expanded) key += " [expanded]";
      if (ariaNode.active && options.renderActive) key += " [active]";
      if (ariaNode.level) key += " [level=" + ariaNode.level + "]";
      if (ariaNode.pressed === "mixed") key += " [pressed=mixed]";
      if (ariaNode.pressed === true) key += " [pressed]";
      if (ariaNode.selected === true) key += " [selected]";
      if (ariaNode.ref) {
        key += " [ref=" + ariaNode.ref + "]";
        if (renderCursorPointer && hasPointerCursor(ariaNode)) key += " [cursor=pointer]";
      }
      return key;
    };

    const getSingleInlinedTextChild = (ariaNode) => {
      return ariaNode?.children.length === 1 && typeof ariaNode.children[0] === "string" && !Object.keys(ariaNode.props).length ? ariaNode.children[0] : undefined;
    };

    const visit = (ariaNode, indent, renderCursorPointer) => {
      const escapedKey = indent + "- " + yamlEscapeKeyIfNeeded(createKey(ariaNode, renderCursorPointer));
      const singleInlinedTextChild = getSingleInlinedTextChild(ariaNode);
      if (!ariaNode.children.length && !Object.keys(ariaNode.props).length) {
        lines.push(escapedKey);
      } else if (singleInlinedTextChild !== undefined) {
        lines.push(escapedKey + ": " + yamlEscapeValueIfNeeded(singleInlinedTextChild));
      } else {
        lines.push(escapedKey + ":");
        for (const [name, value] of Object.entries(ariaNode.props)) lines.push(indent + "  - /" + name + ": " + yamlEscapeValueIfNeeded(value));
        const childIndent = indent + "  ";
        const inCursorPointer = !!ariaNode.ref && renderCursorPointer && hasPointerCursor(ariaNode);
        for (const child of ariaNode.children) {
          if (typeof child === "string") visitText(child, childIndent);
          else visit(child, childIndent, renderCursorPointer && !inCursorPointer);
        }
      }
    };

    for (const nodeToRender of nodesToRender) {
      if (typeof nodeToRender === "string") visitText(nodeToRender, "");
      else visit(nodeToRender, "", !!options.renderCursorPointer);
    }
    return lines.join("\\n");
  }

  function getSnapshot() {
    const snapshot = generateAriaTree(document.body);
    const refsObject = {};
    for (const [ref, element] of snapshot.elements) refsObject[ref] = element;
    window.__ariaSnapshotRefs = refsObject;
    return {
      yaml: renderAriaTree(snapshot),
      iframeRefs: snapshot.iframeRefs
    };
  }

  function selectRef(ref) {
    const refs = window.__ariaSnapshotRefs;
    if (!refs) throw new Error("No snapshot refs found. Call getSnapshot first.");
    const element = refs[ref];
    if (!element) throw new Error('Ref "' + ref + '" not found. Available refs: ' + Object.keys(refs).join(", "));
    return element;
  }

  // Expose functions
  window.__ariaSnapshot_get = getSnapshot;
  window.__ariaSnapshot_selectRef = selectRef;
})();
`;

/**
 * Sandbox script: runs inside the eval iframe. Listens for messages from the parent (CdpHandler),
 * responds to SANDBOX_PING with SANDBOX_READY, runs code on EVAL_REQUEST and posts EVAL_RESULT,
 * and honors ABORT to cancel in-flight eval. Exposes connectToPage(tabId) for Puppeteer tab connection.
 */

const parentOrigin = '*';

let aborted = false;
let currentEvalId = null;

// Cached Puppeteer browser and page per tab (one connection per tab)
let cachedBrowser = null;
let cachedPage = null;
let cachedTabId = null;

function sandboxLog(...args) {
    if (typeof console !== 'undefined' && console.log) {
        console.log('[sandbox]', ...args);
    }
}

function clearPageCache() {
    cachedBrowser = null;
    cachedPage = null;
    cachedTabId = null;
    sandboxLog('browser disconnected, clearing cache');
}

/**
 * Wrap a promise with a timeout. Rejects with an Error after ms.
 * @param {Promise<T>} promise
 * @param {number} ms
 * @param {string} label
 * @returns {Promise<T>}
 */
function withTimeout(promise, ms, label) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`${label || 'Operation'} timed out after ${ms}ms`));
        }, ms);
        promise
            .then((value) => {
                clearTimeout(timer);
                resolve(value);
            })
            .catch((err) => {
                clearTimeout(timer);
                reject(err);
            });
    });
}

/**
 * Send a request message to parent and await matching response.
 * @param {string} requestType
 * @param {string} responseType
 * @param {object} payload
 * @param {number} timeoutMs
 * @param {string} timeoutLabel
 * @returns {Promise<any>}
 */
function sendParentRequest(requestType, responseType, payload, timeoutMs, timeoutLabel) {
    return new Promise((resolve, reject) => {
        if (window.parent === window) {
            reject(new Error('Parent window is not available'));
            return;
        }

        const id = crypto.randomUUID();
        let timeoutId;
        const onMessage = event => {
            if (event.source !== window.parent) return;
            const data = event.data;
            if (data?.type !== responseType || data.id !== id) return;

            window.removeEventListener('message', onMessage);
            clearTimeout(timeoutId);

            if (!data.success) {
                reject(new Error(data.error || `${requestType} failed`));
                return;
            }
            resolve(data);
        };

        window.addEventListener('message', onMessage);
        timeoutId = setTimeout(() => {
            window.removeEventListener('message', onMessage);
            reject(new Error(`${timeoutLabel} timeout`));
        }, timeoutMs);

        window.parent.postMessage(
            {
                type: requestType,
                id,
                ...payload,
            },
            parentOrigin
        );
    });
}

/**
 * List tabs from the extension host via parent request/response.
 * @returns {Promise<Array<{id:number,title:string,url:string,active:boolean}>>}
 */
async function listTabs() {
    const response = await sendParentRequest(
        'LIST_TABS_REQUEST',
        'LIST_TABS_RESPONSE',
        {},
        10000,
        'listTabs'
    );
    return response.tabs;
}

/**
 * Open a new tab via extension host.
 * @param {string} url
 * @returns {Promise<{id:number,title:string,url:string,active:boolean}>}
 */
async function createTab(url) {
    const response = await sendParentRequest(
        'CREATE_TAB_REQUEST',
        'CREATE_TAB_RESPONSE',
        { url },
        10000,
        'createTab'
    );
    return response.tab;
}

/**
 * Close a tab via extension host and clear cached Puppeteer connection if needed.
 * @param {number} tabId
 * @returns {Promise<void>}
 */
async function closeTab(tabId) {
    try {
        await sendParentRequest(
            'CLOSE_TAB_REQUEST',
            'CLOSE_TAB_RESPONSE',
            { tabId },
            10000,
            'closeTab'
        );
    } finally {
        if (cachedTabId === tabId) {
            sandboxLog('closeTab clearing cached connection for tab:', tabId);
            if (cachedBrowser) {
                await withTimeout(cachedBrowser.close(), 5000, 'browser.close').catch(err => {
                    sandboxLog('browser.close error:', err?.message ?? err);
                });
            }
            clearPageCache();
        }
    }
}

/**
 * Activate a Chrome tab by id via extension host.
 * @param {number} tabId
 * @returns {Promise<void>}
 */
async function activateTab(tabId) {
    await sendParentRequest(
        'ACTIVATE_TAB_REQUEST',
        'ACTIVATE_TAB_RESPONSE',
        { tabId },
        5000,
        'activateTab'
    );
}

// ---------------------------------------------------------------------------
// SandboxTransport: CDP over postMessage (implements Puppeteer transport shape)
// ---------------------------------------------------------------------------

async function sendCdpAttachRequest(tabId) {
    return new Promise((e, t) => {
        const r = crypto.randomUUID();
        sandboxLog("[SandboxTransport] sendAttachRequest called, tabId:", tabId, "requestId:", r);

        /** @param {MessageEvent} s */
        const n = (s) => {
            s.source === window.parent &&
                s.data?.type === "CDP_ATTACH_RESPONSE" &&
                s.data.id === r &&
                (sandboxLog("[SandboxTransport] CDP_ATTACH_RESPONSE received, success:", s.data.success),
                    window.removeEventListener("message", n),
                    s.data.success ? e() : t(new Error(s.data.error || "Failed to attach debugger")));
        };

        window.addEventListener("message", n);

        setTimeout(() => {
            sandboxLog("[SandboxTransport] sendAttachRequest timeout for requestId:", r);
            window.removeEventListener("message", n);
            t(new Error("Attach request timeout"));
        }, 1e4);

        sandboxLog("[SandboxTransport] Posting CDP_ATTACH to parent");
        window.parent.postMessage({ type: "CDP_ATTACH", id: r, tabId }, "*");
    });
}

class SandboxCdpTransport {
    /** @type {(message: string) => void | undefined} */
    onmessage;
    /** @type {(() => void) | undefined} */
    onclose;

    /** @type {number} */
    tabId;
    /** @type {boolean} */
    isClosed = false;

    /**
     * Attach debugger for the tab, then return a transport wired to that tabId.
     * @param {number} e tabId
     * @returns {Promise<SandboxCdpTransport>}
     */
    static async connectToTab(tabId) {
        return (
            sandboxLog("[SandboxTransport] connectTab called, tabId:", tabId),
            await sendCdpAttachRequest(tabId),
            sandboxLog("[SandboxTransport] sendAttachRequest completed, creating transport"),
            new SandboxCdpTransport(tabId)
        );
    }

    constructor(tabId) {
        this.tabId = tabId;
        window.addEventListener("message", this.handleMessage);
    }

    /** @param {MessageEvent} event */
    handleMessage = (event) => {
        if (event.source !== window.parent) return;

        const data = event.data;
        if (!data || data.tabId !== this.tabId) return;

        if (data.type === "CDP_RESPONSE" || data.type === "CDP_EVENT") {
            setTimeout(() => {
                this.onmessage?.(JSON.stringify(data.payload));
            }, 0);
            return;
        }

        if (data.type === "CDP_CLOSE") {
            this.isClosed = true;
            this.onclose?.();
        }
    };

    /**
     * Called by Puppeteer with a stringified CDP request.
     * We parse it and forward it to the parent bridge as an object.
     *
     * @param {string} e JSON string (CDP request)
     */
    send(stringPayload) {
        if (this.isClosed) return;
        const payload = JSON.parse(stringPayload);
        window.parent.postMessage({ type: "CDP_REQUEST", tabId: this.tabId, payload }, "*");
    }

    /**
     * Close the transport and ask parent to detach the debugger.
     */
    close() {
        this.isClosed ||
            ((this.isClosed = true),
                window.removeEventListener("message", this.handleMessage),
                window.parent.postMessage({ type: "CDP_DETACH", tabId: this.tabId }, "*"),
                this.onclose?.());
    }
}

/**
 * Connect to a Chrome tab and return a Puppeteer Page. Caches one browser/page per tab;
 * reuses cache when tabId is unchanged, closes and reconnects when tabId changes.
 * @param {number} tabId - Chrome tab ID
 * @returns {Promise<import('puppeteer-core').Page>}
 */
async function connectToPage(tabId) {
    sandboxLog('connectToPage called with tabId:', tabId);

    //await activateTab(tabId);

    if (cachedPage && cachedTabId === tabId) {
        sandboxLog('returning cached page for tab:', tabId);
        return cachedPage;
    }

    if (cachedBrowser && cachedTabId !== tabId) {
        sandboxLog('closing previous connection for tab:', cachedTabId);
        await withTimeout(cachedBrowser.close(), 5000, 'browser.close').catch((err) => {
            sandboxLog('browser.close error:', err?.message ?? err);
        });
        clearPageCache();
    }

    sandboxLog('connecting to tab:', tabId);
    const transport = await SandboxCdpTransport.connectToTab(tabId);
    sandboxLog('transport created');

    const browser = await withTimeout(
        connect({ transport, defaultViewport: null }),
        10000,
        'puppeteer.connect'
    );
    sandboxLog('browser connected');

    browser.on('disconnected', () => {
        if (cachedBrowser === browser) {
            clearPageCache();
        }
    });

    const targets = browser.targets();
    sandboxLog(
        'initial targets:',
        targets.map((t) => ({ type: t.type(), url: t.url() }))
    );
    sandboxLog('waiting for page target...');

    const pageTarget = await browser.waitForTarget(
        (t) => {
            sandboxLog('checking target:', t.type(), t.url());
            return t.type() === 'page';
        },
        { timeout: 10000 }
    );
    sandboxLog('found target:', pageTarget.type(), pageTarget.url());

    const page = await withTimeout(pageTarget.page(), 10000, 'target.page');
    sandboxLog('got page:', !!page);

    cachedBrowser = browser;
    cachedPage = page ?? null;
    cachedTabId = tabId;
    return page;
}

/**
 * Wait for the page's document.readyState to be "complete" by polling.
 * @param {import('puppeteer-core').Page} page - Puppeteer page
 * @param {{ timeout?: number, pollInterval?: number }} options - timeout ms (default 2000), pollInterval ms (default 100)
 * @returns {Promise<{ success: boolean, readyState: string, pendingRequests: number, waitTimeMs: number, timedOut: boolean }>}
 */
async function waitForPageLoad(page, options = {}) {
    const { timeout = 2000, pollInterval = 100 } = options;
    const start = Date.now();

    sandboxLog(`[waitForPageLoad] Waiting up to ${timeout}ms...`);

    while (Date.now() - start < timeout) {
        try {
            const readyState = await page.evaluate(() => document.readyState);
            if (readyState === 'complete') {
                const waitTimeMs = Date.now() - start;
                sandboxLog(`[waitForPageLoad] Ready after ${waitTimeMs}ms, readyState: ${readyState}`);
                return {
                    success: true,
                    readyState,
                    pendingRequests: 0,
                    waitTimeMs,
                    timedOut: false,
                };
            }
        } catch (_) { }
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    try {
        const readyState = await page.evaluate(() => document.readyState);
        sandboxLog(`[waitForPageLoad] Timeout after ${timeout}ms, readyState: ${readyState}`);
        return {
            success: readyState === 'complete',
            readyState,
            pendingRequests: 0,
            waitTimeMs: timeout,
            timedOut: true,
        };
    } catch (err) {
        sandboxLog(`[waitForPageLoad] Timeout after ${timeout}ms, error: ${err}`);
        return {
            success: false,
            readyState: 'unknown',
            pendingRequests: 0,
            waitTimeMs: timeout,
            timedOut: true,
        };
    }
}

/**
 * Valid base64: pattern [A-Za-z0-9+/]* with optional = padding (0, 1, or 2), length % 4 === 0, and atob must not throw.
 */
function isValidBase64(str) {
    if (typeof str !== 'string') return false;
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(str) || str.length % 4 !== 0) return false;
    try {
        atob(str);
        return true;
    } catch (_) {
        return false;
    }
}

/** PNG signature (8 bytes): 0x89 'P' 'N' 'G' \r \n 0x1a \n */
const PNG_SIGNATURE = '\x89PNG\r\n\x1a\n';

/**
 * Check if base64 decodes to a string that starts with the PNG file signature.
 */
function isValidPng(base64Str) {
    try {
        return atob(base64Str).startsWith(PNG_SIGNATURE);
    } catch (_) {
        return false;
    }
}

const imageContext = { images: [], counter: 0 };
function logImage(imageBase64) {
    if (typeof imageBase64 !== 'string' || imageBase64.length === 0) {
        throw new Error('logImage: Input must be a non-empty string');
    }
    if (!isValidBase64(imageBase64)) {
        throw new Error('logImage: Invalid base64 encoding');
    }
    if (!isValidPng(imageBase64)) {
        throw new Error('logImage: Data is not a valid PNG image');
    }
    imageContext.images.push(imageBase64);
    imageContext.counter += 1;
    sandboxLog(`[Image #${imageContext.counter} logged]`);
}

/**
 * Injects the ARIA snapshot script into the page, then returns the snapshot (yaml + iframeRefs).
 * @param {import('puppeteer-core').Page} page - Puppeteer page
 * @returns {Promise<{ yaml: string, iframeRefs: unknown }>}
 */
async function injectSnapshotScript(page) {
    sandboxLog('injectSnapshotScript');
    await page.evaluate(SNAPSHOT_SCRIPT);
    sandboxLog('injectSnapshotScript evaluated');
    return page.evaluate(() => {
        if (typeof window.__ariaSnapshot_get !== 'function') {
            throw new Error('Snapshot script did not inject. __ariaSnapshot_get is missing.');
        }
        return window.__ariaSnapshot_get();
    });
}

function getTargetUrl(target) {
    if (!target || typeof target.url !== 'function') return '';
    return Promise.resolve(target.url()).catch(() => '');
}

/**
 * Collects aria snapshots from main frame and nested iframes up to maxDepth.
 * Returns a combined yaml plus per-frame metadata.
 * @param {import('puppeteer-core').Page} page
 * @param {{ maxDepth?: number }} [options]
 * @returns {Promise<{ yaml: string, frames: Map<string, { yaml: string, iframeRefs: unknown[], frameUrl: string }> }>}
 */
async function collectSnapshot(page, options = {}) {
    const { maxDepth = 3 } = options;
    const frames = new Map();
    const yamlLines = [];

    async function visit(target, depth, frameRef) {
        if (depth > maxDepth) return;
        try {
            const frameSnapshot = await injectSnapshotScript(target);
            const frameUrl = await getTargetUrl(target);
            const iframeRefs = Array.isArray(frameSnapshot?.iframeRefs) ? frameSnapshot.iframeRefs : [];
            const yaml = typeof frameSnapshot?.yaml === 'string' ? frameSnapshot.yaml : '';

            frames.set(frameRef, { yaml, iframeRefs, frameUrl });

            if (frameRef === 'main') {
                yamlLines.push(yaml);
            } else {
                const indentedYaml = yaml
                    .split('\n')
                    .map(line => `    ${line}`)
                    .join('\n');
                yamlLines.push(`  # iframe ${frameRef} (${frameUrl}):`);
                yamlLines.push(indentedYaml);
            }

            for (const nestedRef of iframeRefs) {
                let frameHandle = null;
                try {
                    frameHandle = await target.evaluateHandle(
                        refId => window.__ariaSnapshot_selectRef(refId),
                        nestedRef
                    );
                    const childFrame = await frameHandle.contentFrame();
                    if (!childFrame) {
                        yamlLines.push(`  # iframe ${nestedRef}: [cross-origin or inaccessible]`);
                        continue;
                    }
                    await visit(childFrame, depth + 1, nestedRef);
                } catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    yamlLines.push(`  # iframe ${nestedRef}: [error: ${message}]`);
                } finally {
                    if (frameHandle) {
                        await frameHandle.dispose().catch(() => {});
                    }
                }
            }
        } catch (err) {
            console.error(`Error processing frame ${frameRef}:`, err);
        }
    }

    await visit(page, 0, 'main');
    return {
        yaml: yamlLines.join('\n'),
        frames,
    };
}

async function getSnapshot(page, options = {}) {
    const snapshot = await collectSnapshot(page, options);
    // sandboxLog('getSnapshot', snapshot);   
    return snapshot.yaml;
}

async function getElementByRef(page, ref) {
    await page.evaluate(SNAPSHOT_SCRIPT);
    return page.evaluateHandle((refId) => window.__ariaSnapshot_selectRef(refId), ref);
}

/**
 * Clears the content of an input, textarea, or contenteditable element.
 * Focuses, selects all (via quad-click or Range/Selection), then sends Backspace.
 * @param {import('puppeteer-core').ElementHandle} handle - ElementHandle for the field (e.g. from getElementByRef)
 * @returns {Promise<void>}
 */
async function clearInput(handle) {
    await handle.focus();
    await handle.click({ clickCount: 4 });
    await handle.evaluate((el) => {
        const target = el.closest('input, textarea, [contenteditable]') || el;
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
            target.select();
        } else if ('isContentEditable' in target && target.isContentEditable) {
            const range = document.createRange();
            range.selectNodeContents(target);
            const sel = window.getSelection();
            if (sel) {
                sel.removeAllRanges();
                sel.addRange(range);
            }
        }
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    await handle.press('Backspace');
}

// -----------------------------------------------------------------------------
// Workspace request/response (sandbox → parent; e.g. status, bash/workspace APIs)
// -----------------------------------------------------------------------------

const WORKSPACE_REQUEST = 'WORKSPACE_REQUEST';
const WORKSPACE_RESPONSE = 'WORKSPACE_RESPONSE';

/**
 * Sends a workspace request to the parent and resolves when parent replies with matching id.
 * @param {{ postMessage: (payload: object) => void, isValidSource: (event: MessageEvent) => boolean, timeoutMs?: number }} config
 * @param {string} operation - Operation name (e.g. "status")
 * @param {unknown} [input] - Optional input for the operation
 * @returns {Promise<unknown>} - result from parent
 */
function sendWorkspaceRequest(config, operation, input) {
    return new Promise((resolve, reject) => {
        const id = crypto.randomUUID();
        const timeoutMs = config.timeoutMs ?? 30000;

        const onMessage = (event) => {
            if (!config.isValidSource(event)) return;
            const data = event.data;
            if (data?.type !== WORKSPACE_RESPONSE || data.id !== id) return;
            window.removeEventListener('message', onMessage);
            clearTimeout(timeoutId);
            if (!data.success) {
                reject(new Error(data.error ?? `${operation} failed`));
                return;
            }
            resolve(data.result);
        };

        window.addEventListener('message', onMessage);
        const timeoutId = setTimeout(() => {
            window.removeEventListener('message', onMessage);
            reject(new Error(`${operation} timeout`));
        }, timeoutMs);

        config.postMessage({
            type: WORKSPACE_REQUEST,
            id,
            operation,
            ...(input !== undefined ? { input } : {}),
        });
    });
}

/**
 * Creates a workspace client that posts requests to window.parent and validates source.
 * Use for status and other workspace operations from eval code.
 * @param {{ timeoutMs?: number }} [overrides] - Optional overrides (e.g. timeoutMs)
 * @returns {{ status: () => Promise<unknown> }}
 */
function createWorkspaceClient(overrides = {}) {
    const config = {
        postMessage: (payload) => {
            if (window.parent !== window) {
                window.parent.postMessage(payload, parentOrigin);
            }
        },
        isValidSource: (event) => event.source === window.parent,
        ...overrides,
    };
    return {
        status() {
            return sendWorkspaceRequest(config, 'status');
        },
    };
}

function createWorkspaceRequestConfig(overrides = {}) {
    return {
        postMessage: (payload) => {
            if (window.parent !== window) {
                window.parent.postMessage(payload, parentOrigin);
            }
        },
        isValidSource: (event) => event.source === window.parent,
        ...overrides,
    };
}

function extractResultField(result, field) {
    if (!result || typeof result !== 'object') return result;
    return Object.prototype.hasOwnProperty.call(result, field) ? result[field] : result;
}

// Expose for code run via EVAL_REQUEST (e.g. browser automation tools)
window.listTabs = listTabs;
window.createTab = createTab;
window.closeTab = closeTab;
window.activateTab = activateTab;
window.connectToPage = connectToPage;
window.waitForPageLoad = waitForPageLoad;
window.logImage = logImage;
window.getSnapshot = getSnapshot;
window.getElementByRef = getElementByRef;
window.clearInput = clearInput;
window.workspace = createWorkspaceClient();
window.readFile = function(path) {
    const config = createWorkspaceRequestConfig();
    return sendWorkspaceRequest(config, 'readFile', { path })
        .then((result) => extractResultField(result, 'content'));
};
window.writeFile = function(path, content) {
    const config = createWorkspaceRequestConfig();
    return sendWorkspaceRequest(config, 'writeFile', { path, content });
};
window.listFiles = function(path) {
    const config = createWorkspaceRequestConfig();
    return sendWorkspaceRequest(config, 'listFiles', { path })
        .then((result) => extractResultField(result, 'entries'));
};
window.deleteFile = function(path) {
    const config = createWorkspaceRequestConfig();
    return sendWorkspaceRequest(config, 'deleteFile', { path });
};

function sendToParent(payload) {
    if (window.parent !== window) {
        window.parent.postMessage(payload, parentOrigin);
    }
}

const MAX_TRUNCATED_OUTPUT_LENGTH = 3e4;
const TRUNCATED_OUTPUT_HEAD_TAIL_LENGTH = 12e3;
const MAX_PERSISTED_OUTPUT_LENGTH = 1e5;

async function truncateOutput(output, maxLength = MAX_TRUNCATED_OUTPUT_LENGTH) {
    if (output.length <= maxLength) return output;

    const outputKbTotal = (output.length / 1024).toFixed(1);
    const outputHead = output.slice(0, TRUNCATED_OUTPUT_HEAD_TAIL_LENGTH);
    const outputTail = output.slice(-12e3);
    let truncatedFilePath;

    try {
        const requestConfig = {
            postMessage: (payload) => {
                if (window.parent !== window) {
                    window.parent.postMessage(payload, parentOrigin);
                }
            },
            isValidSource: (event) => event.source === window.parent,
            timeoutMs: 500,
        };

        await sendWorkspaceRequest(requestConfig, 'mkdir', { path: '/tmp' }).catch(() => { });
        truncatedFilePath = `/tmp/truncated-output-${Date.now()}.txt`;

        const persistedContent =
            output.length > MAX_PERSISTED_OUTPUT_LENGTH
                ? `${output.slice(0, MAX_PERSISTED_OUTPUT_LENGTH)}\n---\n(Note: Persisted output was capped to avoid oversized writes)`
                : output;

        await sendWorkspaceRequest(requestConfig, 'writeFile', {
            path: truncatedFilePath,
            content: persistedContent,
            encoding: 'utf8',
        });
    } catch (error) {
        sandboxLog('[sandbox] Failed to save truncated output:', error);
    }

    const truncationBanner = `--- TRUNCATED (${outputKbTotal}KB total) ---`;
    const systemMessage = truncatedFilePath
        ? `**SYSTEM MESSAGE**: The output was too long and has been truncated. If you need more details the full contents are stored at \`${truncatedFilePath}\`. You can either use the readFile tool or bash commands to paginate through or search the contents if needed.`
        : '';

    return `${outputHead}\n${truncationBanner}\n${systemMessage}\n${outputTail}\n--\nNote: The middle of this output is missing due to truncation`;
}


async function runEval(id, code, timeoutMs) {
    // sandboxLog('runEval', id, code, timeoutMs);
    aborted = false;
    currentEvalId = id;
    const timeout = Math.max(1000, Math.min(timeoutMs || 45000, 120000));

    const chunks = [];
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    const capture = (method, args) => {
        try {
            const text = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
            if (text) chunks.push(text);
        } catch (_) { }
        method.apply(console, args);
    };

    const runWithTimeout = async (runner) => {
        let timer;
        try {
            return await Promise.race([
                Promise.resolve().then(() => runner()),
                new Promise((_, reject) => {
                    timer = setTimeout(() => reject(new Error('Execution timeout')), timeout);
                }),
            ]);
        } finally {
            clearTimeout(timer);
        }
    };

    console.log = (...args) => capture(originalLog, args);
    console.warn = (...args) => capture(originalWarn, args);
    console.error = (...args) => capture(originalError, args);

    let settled = false;
    const done = async (result) => {
        if (settled) return;
        settled = true;
        console.log = originalLog;
        console.warn = originalWarn;
        console.error = originalError;
        currentEvalId = null;
        const end = Date.now();
        const executionTime = end - result.startTime;
        const consoleOutput = chunks.length > 0 ? chunks.join(`\n`) : "(no console output)";
        const output = ["[Console Output]", consoleOutput, "", "[Return Value]", result.output, "", "[Execution Time]", `${executionTime}ms`].join(`\n`);
        const truncatedOutput = await truncateOutput(output || '');
        sendToParent({
            type: 'EVAL_RESULT',
            id,
            output: truncatedOutput || '',
            hasError: !!result.hasError,
            images: imageContext?.images || [],
            aborted: !!result.aborted,
        });
    };



    const startTime = Date.now();
    try {
        let value;
        try {
            const expressionFn = new Function(`return (async () => { return (${code}); })()`);
            value = await runWithTimeout(() => expressionFn());
        } catch (err) {
            if (!(err instanceof SyntaxError)) throw err;
            const statementFn = new Function(`return (async () => { ${code} })()`);
            value = await runWithTimeout(() => statementFn());
        }

        if (!settled && currentEvalId === id) {
            const output = value !== undefined ? JSON.stringify(value) : '';
            await done({ output, hasError: false, startTime });
        }
    } catch (err) {
        if (!settled && currentEvalId === id) {
            const output = err instanceof Error ? (err.message || String(err)) : String(err);
            await done({ output, hasError: true, aborted, startTime });
        }
    }
}

window.addEventListener('message', (event) => {
    const msg = event.data;
    if (!msg || typeof msg !== 'object' || !msg.type) return;

    switch (msg.type) {
        case 'SANDBOX_PING':
            sandboxLog('SANDBOX_PING');
            sendToParent({ type: 'SANDBOX_READY' });
            break;

        case 'EVAL_REQUEST':
            sandboxLog('EVAL_REQUEST', msg);
            if (typeof msg.code === 'string' && msg.id) {
                runEval(msg.id, msg.code, msg.timeout);
            }
            break;

        case 'ABORT':
            aborted = true;
            if (currentEvalId) {
                sendToParent({
                    type: 'EVAL_RESULT',
                    id: currentEvalId,
                    output: 'Execution aborted by user',
                    hasError: true,
                    images: [],
                    aborted: true,
                });
                currentEvalId = null;
            }
            break;

        default:
            break;
    }
});

// Signal ready when loaded (in case parent already sent SANDBOX_PING)
if (document.readyState === 'complete') {
    sendToParent({ type: 'SANDBOX_READY' });
} else {
    window.addEventListener('load', () => sendToParent({ type: 'SANDBOX_READY' }));
}
