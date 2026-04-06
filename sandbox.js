
const Kl = new Bl({
    isPuppeteerCore: !0
})
  , {connect: Hl} = Kl
  , Ft = console.log.bind(console);
async function Ul(i) {
    return new Promise( (e, t) => {
        const r = crypto.randomUUID();
        Ft("[SandboxTransport] sendAttachRequest called, tabId:", i, "requestId:", r);
        const n = s => {
            s.source === window.parent && s.data?.type === "CDP_ATTACH_RESPONSE" && s.data.id === r && (Ft("[SandboxTransport] CDP_ATTACH_RESPONSE received, success:", s.data.success),
            window.removeEventListener("message", n),
            s.data.success ? e() : t(new Error(s.data.error || "Failed to attach debugger")))
        }
        ;
        window.addEventListener("message", n),
        setTimeout( () => {
            Ft("[SandboxTransport] sendAttachRequest timeout for requestId:", r),
            window.removeEventListener("message", n),
            t(new Error("Attach request timeout"))
        }
        , 1e4),
        Ft("[SandboxTransport] Posting CDP_ATTACH to parent"),
        window.parent.postMessage({
            type: "CDP_ATTACH",
            id: r,
            tabId: i
        }, "*")
    }
    )
}
class ji {
    onmessage;
    onclose;
    #e;
    #t = !1;
    static async connectTab(e) {
        return Ft("[SandboxTransport] connectTab called, tabId:", e),
        await Ul(e),
        Ft("[SandboxTransport] sendAttachRequest completed, creating transport"),
        new ji(e)
    }
    constructor(e) {
        this.#e = e,
        window.addEventListener("message", this.#r)
    }
    #r = e => {
        e.source === window.parent && (e.data?.type === "CDP_RESPONSE" && e.data.tabId === this.#e ? setTimeout( () => {
            this.onmessage?.(JSON.stringify(e.data.payload))
        }
        , 0) : e.data?.type === "CDP_EVENT" && e.data.tabId === this.#e ? setTimeout( () => {
            this.onmessage?.(JSON.stringify(e.data.payload))
        }
        , 0) : e.data?.type === "CDP_CLOSE" && e.data.tabId === this.#e && (this.#t = !0,
        this.onclose?.()))
    }
    ;
    send(e) {
        if (this.#t)
            return;
        const t = JSON.parse(e);
        window.parent.postMessage({
            type: "CDP_REQUEST",
            tabId: this.#e,
            payload: t
        }, "*")
    }
    close() {
        this.#t || (this.#t = !0,
        window.removeEventListener("message", this.#r),
        window.parent.postMessage({
            type: "CDP_DETACH",
            tabId: this.#e
        }, "*"),
        this.onclose?.())
    }
}
function ql(i) {
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(i) || i.length % 4 !== 0)
        return !1;
    try {
        return atob(i),
        !0
    } catch {
        return !1
    }
}
function Wl(i) {
    try {
        return atob(i).startsWith(`PNG\r

`)
    } catch {
        return !1
    }
}
function Rs(i) {
    return function(t) {
        if (typeof t != "string" || t.length === 0)
            throw new Error("logImage: Input must be a non-empty string");
        if (!ql(t))
            throw new Error("logImage: Invalid base64 encoding");
        if (!Wl(t))
            throw new Error("logImage: Data is not a valid PNG image");
        i.images.push(t),
        i.counter++,
        console.log(`[Image #${i.counter} logged]`)
    }
}
async function $l(i, e={}) {
    const {timeout: t=2e3, pollInterval: r=100} = e
      , n = Date.now();
    for (console.log(`[waitForPageLoad] Waiting up to ${t}ms...`); Date.now() - n < t; ) {
        try {
            const s = await i.evaluate( () => document.readyState);
            if (s === "complete") {
                const a = Date.now() - n;
                return console.log(`[waitForPageLoad] Ready after ${a}ms, readyState: ${s}`),
                {
                    success: !0,
                    readyState: s,
                    pendingRequests: 0,
                    waitTimeMs: a,
                    timedOut: !1
                }
            }
        } catch {}
        await new Promise(s => setTimeout(s, r))
    }
    try {
        const s = await i.evaluate( () => document.readyState);
        return console.log(`[waitForPageLoad] Timeout after ${t}ms, readyState: ${s}`),
        {
            success: s === "complete",
            readyState: s,
            pendingRequests: 0,
            waitTimeMs: t,
            timedOut: !0
        }
    } catch (s) {
        return console.log(`[waitForPageLoad] Timeout after ${t}ms, error: ${s}`),
        {
            success: !1,
            readyState: "unknown",
            pendingRequests: 0,
            waitTimeMs: t,
            timedOut: !0
        }
    }
}
const Vl = `
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
async function Ls(i) {
    await i.evaluate(Vl)
}
async function jl(i) {
    return await Ls(i),
    await i.evaluate( () => window.__ariaSnapshot_get())
}
async function zl(i, e) {
    return await Ls(i),
    await i.evaluateHandle(t => window.__ariaSnapshot_selectRef(t), e)
}
async function Gl(i, e={}) {
    const {maxDepth: t=3} = e
      , r = new Map
      , n = [];
    async function s(a, c, d) {
        if (!(c > t))
            try {
                const f = await jl(a)
                  , u = "url"in a ? await a.url() : a.url();
                if (r.set(d, {
                    yaml: f.yaml,
                    iframeRefs: f.iframeRefs,
                    frameUrl: u
                }),
                d === "main")
                    n.push(f.yaml);
                else {
                    const p = f.yaml.split(`
`).map(w => "    " + w).join(`
`);
                    n.push(`  # iframe ${d} (${u}):`),
                    n.push(p)
                }
                for (const p of f.iframeRefs)
                    try {
                        const w = await a.evaluateHandle(T => window.__ariaSnapshot_selectRef(T), p);
                        if (!w)
                            continue;
                        const v = await w.contentFrame();
                        if (!v) {
                            n.push(`  # iframe ${p}: [cross-origin or inaccessible]`);
                            continue
                        }
                        await s(v, c + 1, p),
                        await w.dispose()
                    } catch (w) {
                        n.push(`  # iframe ${p}: [error: ${w.message}]`)
                    }
            } catch (f) {
                console.error(`Error processing frame ${d}:`, f)
            }
    }
    return await s(i, 0, "main"),
    {
        yaml: n.join(`
`),
        frames: r
    }
}
async function Xl(i) {
    return (await Gl(i)).yaml
}
const Ql = /^\/(?:a\/[^/]+\/)?spreadsheets\/(?:u\/\d+\/)?d\/([a-zA-Z0-9-_]+)/;
function Jl(i) {
    if (!i)
        return null;
    let e;
    try {
        e = new URL(i)
    } catch {
        return null
    }
    return e.hostname !== "docs.google.com" ? null : e.pathname.match(Ql)?.[1] ?? null
}
const Yl = "FS_READ_REQUEST"
  , Zl = "FS_WRITE_REQUEST"
  , eu = "FS_LIST_REQUEST"
  , tu = "FS_DELETE_REQUEST"
  , ru = "FS_MKDIR_REQUEST"
  , iu = "FS_EXISTS_REQUEST"
  , nu = "FS_STAT_REQUEST"
  , su = "BASH_REQUEST"
  , au = "FS_READ_RESPONSE"
  , ou = "FS_WRITE_RESPONSE"
  , cu = "FS_LIST_RESPONSE"
  , lu = "FS_DELETE_RESPONSE"
  , uu = "FS_MKDIR_RESPONSE"
  , du = "FS_EXISTS_RESPONSE"
  , hu = "FS_STAT_RESPONSE"
  , fu = "BASH_RESPONSE";
function lt(i, e, t, r, n) {
    return new Promise( (s, a) => {
        const c = crypto.randomUUID()
          , d = u => {
            i.isValidSource(u) && u.data?.type === t && u.data.id === c && (window.removeEventListener("message", d),
            clearTimeout(f),
            u.data.success ? s(u.data) : a(new Error(u.data.error || `${e} failed`)))
        }
        ;
        window.addEventListener("message", d);
        const f = setTimeout( () => {
            window.removeEventListener("message", d),
            a(new Error(`${e} timeout`))
        }
        , n);
        i.postMessage({
            type: e,
            id: c,
            ...r
        })
    }
    )
}
function pu(i) {
    const e = i.fsTimeout ?? 3e4
      , t = i.bashTimeout ?? 6e4;
    return {
        async readFile(r) {
            return (await lt(i, Yl, au, {
                path: r
            }, e)).content
        },
        async writeFile(r, n) {
            await lt(i, Zl, ou, {
                path: r,
                content: n
            }, e)
        },
        async listFiles(r) {
            return (await lt(i, eu, cu, {
                path: r
            }, e)).entries
        },
        async deleteFile(r) {
            await lt(i, tu, lu, {
                path: r
            }, e)
        },
        async mkdir(r) {
            await lt(i, ru, uu, {
                path: r
            }, e)
        },
        async exists(r) {
            return (await lt(i, iu, du, {
                path: r
            }, e)).exists
        },
        async stat(r) {
            return (await lt(i, nu, hu, {
                path: r
            }, e)).stat
        },
        async bash(r, n) {
            const s = await lt(i, su, fu, {
                command: r,
                cwd: n?.cwd
            }, t);
            return {
                stdout: s.stdout,
                stderr: s.stderr,
                exitCode: s.exitCode
            }
        }
    }
}
function mu(i) {
    return pu({
        postMessage: e => window.parent.postMessage(e, "*"),
        isValidSource: e => e.source === window.parent,
        ...i
    })
}
const yu = "WORKSPACE_REQUEST"
  , gu = "WORKSPACE_RESPONSE";
function xe(i, e, t) {
    return new Promise( (r, n) => {
        const s = crypto.randomUUID()
          , a = i.timeoutMs ?? 3e4
          , c = f => {
            if (!i.isValidSource(f))
                return;
            const u = f.data;
            if (!(u?.type !== gu || u.id !== s)) {
                if (window.removeEventListener("message", c),
                clearTimeout(d),
                !u.success) {
                    n(new Error(u.error ?? `${e} failed`));
                    return
                }
                r(u.result)
            }
        }
        ;
        window.addEventListener("message", c);
        const d = setTimeout( () => {
            window.removeEventListener("message", c),
            n(new Error(`${e} timeout`))
        }
        , a);
        i.postMessage({
            type: yu,
            id: s,
            operation: e,
            ...t !== void 0 ? {
                input: t
            } : {}
        })
    }
    )
}
function wu(i) {
    return {
        status() {
            return xe(i, "status")
        },
        sheetsCreateSpreadsheet(e) {
            return xe(i, "sheets.createSpreadsheet", e)
        },
        sheetsGetSpreadsheet(e) {
            return xe(i, "sheets.getSpreadsheet", e)
        },
        sheetsListSheets(e) {
            return xe(i, "sheets.listSheets", e)
        },
        sheetsRequestAccess(e) {
            return xe(i, "sheets.requestAccess", e)
        },
        sheetsReadRange(e) {
            return xe(i, "sheets.readRange", e)
        },
        sheetsBatchRead(e) {
            return xe(i, "sheets.batchRead", e)
        },
        sheetsWriteRange(e) {
            return xe(i, "sheets.writeRange", e)
        },
        sheetsBatchWrite(e) {
            return xe(i, "sheets.batchWrite", e)
        },
        sheetsAppendRows(e) {
            return xe(i, "sheets.appendRows", e)
        },
        sheetsClearRange(e) {
            return xe(i, "sheets.clearRange", e)
        },
        sheetsBatchClear(e) {
            return xe(i, "sheets.batchClear", e)
        },
        sheetsBatchUpdate(e) {
            return xe(i, "sheets.batchUpdate", e)
        }
    }
}
function bu(i) {
    return wu({
        postMessage: e => window.parent.postMessage(e, "*"),
        isValidSource: e => e.source === window.parent,
        ...i
    })
}
const vu = 1e6
  , mr = `

[SANDBOX OUTPUT CAPPED at 1MB - full output not available]`;
function _n(i, e=vu) {
    return i.length <= e ? i : e <= mr.length ? mr.slice(0, e) : i.slice(0, e - mr.length) + mr
}
const Su = /^([A-Za-z]{1,3})([1-9]\d*)(?::([A-Za-z]{1,3})([1-9]\d*))?$/
  , Eu = /^#[0-9A-Fa-f]{6}$/;
function Ti(i) {
    if (i.length < 1 || i.length > 3)
        throw new Error("Invalid A1 range format.");
    let e = 0;
    for (const t of i.toUpperCase()) {
        const r = t.charCodeAt(0);
        if (r < 65 || r > 90)
            throw new Error("Invalid A1 range format.");
        e = e * 26 + (r - 64)
    }
    return e
}
function An(i) {
    const e = i.match(/^([A-Za-z]{1,3})([1-9]\d*)$/);
    return e ? {
        columnIndexOneBased: Ti(e[1]),
        rowIndexOneBased: Number(e[2])
    } : null
}
function ku(i) {
    if (!i.startsWith("'") || !i.endsWith("'")) {
        if (i.length === 0)
            throw new Error("Invalid A1 range format.");
        return i
    }
    const e = i.slice(1, -1);
    if (e.length === 0)
        throw new Error("Invalid A1 range format.");
    return e.replace(/''/g, "'")
}
function Tu(i) {
    let e = !1;
    for (let t = 0; t < i.length; t += 1) {
        const r = i[t];
        if (r === "'") {
            if (e && i[t + 1] === "'") {
                t += 1;
                continue
            }
            e = !e;
            continue
        }
        if (r === "!" && !e) {
            const n = i.slice(0, t).trim()
              , s = i.slice(t + 1).trim();
            if (!s)
                throw new Error("Invalid A1 range format.");
            return {
                sheetTitle: ku(n),
                rangeWithoutSheet: s
            }
        }
    }
    if (e)
        throw new Error("Invalid A1 range format.");
    return {
        sheetTitle: null,
        rangeWithoutSheet: i.trim()
    }
}
function Cu(i) {
    const e = i.trim();
    if (!e.includes(":"))
        return !1;
    const t = e.split(":");
    if (t.length !== 2)
        return !1;
    const [r,n] = t.map(f => f.trim());
    if (!r || !n)
        return !0;
    const s = An(r)
      , a = An(n);
    if (s && a)
        return !1;
    const c = f => /^\d+$/.test(f)
      , d = f => /^[A-Za-z]+$/.test(f);
    return c(r) || c(n) || d(r) || d(n) || /^[A-Za-z]{1,3}\d+$/.test(r) || /^[A-Za-z]{1,3}\d+$/.test(n)
}
function _u(i) {
    if (!Eu.test(i))
        throw new Error(`Invalid color format: ${i}. Expected #RRGGBB.`);
    return i.toUpperCase()
}
function li(i) {
    return Number.parseInt(i, 16) / 255
}
function Ci(i) {
    const e = _u(i);
    return {
        red: li(e.slice(1, 3)),
        green: li(e.slice(3, 5)),
        blue: li(e.slice(5, 7))
    }
}
function yr(i, e, t) {
    const r = {
        style: i.style
    };
    return t.push(`${e}.style`),
    i.color !== void 0 && (r.color = Ci(i.color),
    t.push(`${e}.color`)),
    r
}
function Pn(i, e) {
    return i.find(t => t.sheetId === e)
}
function xn(i, e) {
    return i.find(t => t.title === e)
}
function Au(i) {
    const e = i.trim();
    if (!e)
        throw new Error("Invalid A1 range format.");
    const {sheetTitle: t, rangeWithoutSheet: r} = Tu(e);
    if (Cu(r))
        throw new Error("Unbounded A1 range is not supported.");
    const n = r.match(Su);
    if (!n)
        throw new Error("Invalid A1 range format.");
    const s = n[1]
      , a = Number(n[2])
      , c = n[3] ?? s
      , d = Number(n[4] ?? n[2])
      , f = Ti(s)
      , u = Ti(c);
    if (d < a || u < f)
        throw new Error("Invalid A1 range format.");
    const p = a - 1
      , w = d
      , v = f - 1
      , T = u
      , C = w - p
      , A = T - v;
    return {
        rawRange: e,
        rangeWithoutSheet: r,
        sheetTitle: t,
        startRowIndex: p,
        endRowIndex: w,
        startColumnIndex: v,
        endColumnIndex: T,
        rowCount: C,
        columnCount: A,
        cellCount: C * A
    }
}
function Pu(i) {
    const e = {}
      , t = [];
    if (i.text) {
        const r = {};
        i.text.bold !== void 0 && (r.bold = i.text.bold,
        t.push("userEnteredFormat.textFormat.bold")),
        i.text.italic !== void 0 && (r.italic = i.text.italic,
        t.push("userEnteredFormat.textFormat.italic")),
        i.text.underline !== void 0 && (r.underline = i.text.underline,
        t.push("userEnteredFormat.textFormat.underline")),
        i.text.strikethrough !== void 0 && (r.strikethrough = i.text.strikethrough,
        t.push("userEnteredFormat.textFormat.strikethrough")),
        i.text.fontSize !== void 0 && (r.fontSize = i.text.fontSize,
        t.push("userEnteredFormat.textFormat.fontSize")),
        i.text.fontFamily !== void 0 && (r.fontFamily = i.text.fontFamily,
        t.push("userEnteredFormat.textFormat.fontFamily")),
        i.text.color !== void 0 && (r.foregroundColor = Ci(i.text.color),
        t.push("userEnteredFormat.textFormat.foregroundColor")),
        Object.keys(r).length > 0 && (e.textFormat = r)
    }
    if (i.fillColor !== void 0 && (e.backgroundColor = Ci(i.fillColor),
    t.push("userEnteredFormat.backgroundColor")),
    i.horizontalAlign !== void 0 && (e.horizontalAlignment = i.horizontalAlign,
    t.push("userEnteredFormat.horizontalAlignment")),
    i.verticalAlign !== void 0 && (e.verticalAlignment = i.verticalAlign,
    t.push("userEnteredFormat.verticalAlignment")),
    i.wrapStrategy !== void 0 && (e.wrapStrategy = i.wrapStrategy,
    t.push("userEnteredFormat.wrapStrategy")),
    i.numberFormat !== void 0 && (e.numberFormat = {
        type: i.numberFormat.type,
        ...i.numberFormat.pattern !== void 0 ? {
            pattern: i.numberFormat.pattern
        } : {}
    },
    t.push("userEnteredFormat.numberFormat.type"),
    i.numberFormat.pattern !== void 0 && t.push("userEnteredFormat.numberFormat.pattern")),
    i.borders) {
        const r = {};
        i.borders.top && (r.top = yr(i.borders.top, "userEnteredFormat.borders.top", t)),
        i.borders.right && (r.right = yr(i.borders.right, "userEnteredFormat.borders.right", t)),
        i.borders.bottom && (r.bottom = yr(i.borders.bottom, "userEnteredFormat.borders.bottom", t)),
        i.borders.left && (r.left = yr(i.borders.left, "userEnteredFormat.borders.left", t)),
        Object.keys(r).length > 0 && (e.borders = r)
    }
    if (t.length === 0)
        throw new Error("setFormat requires at least one format field.");
    return {
        userEnteredFormat: e,
        appliedFields: Array.from(new Set(t))
    }
}
function xu(i) {
    const {sheets: e, explicitSheet: t, sheetTitleFromRange: r, fallbackSheetId: n} = i;
    if (e.length === 0)
        throw new Error("No sheets available in spreadsheet.");
    let s = null;
    if (t)
        if ("sheetId"in t) {
            const d = Pn(e, t.sheetId);
            if (!d)
                throw new Error(`Sheet ID not found: ${t.sheetId}`);
            s = d
        } else {
            const d = xn(e, t.sheetTitle);
            if (!d)
                throw new Error(`Sheet title not found: ${t.sheetTitle}`);
            s = d
        }
    let a = null;
    if (r) {
        const d = xn(e, r);
        if (!d)
            throw new Error(`Sheet title not found: ${r}`);
        a = d
    }
    if (s && a && s.sheetId !== a.sheetId)
        throw new Error("Sheet reference conflict between range and sheet input.");
    const c = s ?? a;
    if (c)
        return {
            sheetId: c.sheetId,
            sheetTitle: c.title
        };
    if (n != null) {
        const d = Pn(e, n);
        if (d)
            return {
                sheetId: d.sheetId,
                sheetTitle: d.title
            }
    }
    throw new Error("Sheet reference is required. Include the sheet name in the A1 range or provide sheet.sheetTitle/sheet.sheetId.")
}
function Mu(i) {
    return {
        repeatCell: {
            range: {
                sheetId: i.resolvedSheetId,
                startRowIndex: i.parsedRange.startRowIndex,
                endRowIndex: i.parsedRange.endRowIndex,
                startColumnIndex: i.parsedRange.startColumnIndex,
                endColumnIndex: i.parsedRange.endColumnIndex
            },
            cell: {
                userEnteredFormat: i.userEnteredFormat
            },
            fields: i.appliedFields.join(",")
        }
    }
}
const $ = console.log.bind(console);
console.warn.bind(console);
console.error.bind(console);
const Mn = 1e5;
let Kt = null
  , Pr = null
  , it = null
  , Vt = null;
function Ur() {
    $("[sandbox] Clearing browser cache"),
    Kt = null,
    Pr = null,
    it = null
}
window.addEventListener("message", i => {
    i.source === window.parent && i.data?.type === "CDP_CLOSE" && ($("[sandbox] Received CDP_CLOSE for tab:", i.data.tabId, "reason:", i.data.reason),
    i.data.tabId === it && Ur())
}
);
window.addEventListener("message", i => {
    i.source === window.parent && i.data?.type === "ABORT" && ($("[sandbox] Received ABORT message"),
    Vt && Vt.abort())
}
);
function Iu() {
    if (Vt?.signal.aborted)
        throw new DOMException("Execution aborted by user","AbortError")
}
function Fu() {
    return Vt?.signal ?? new AbortController().signal
}
let Zt = {
    images: [],
    counter: 0
}
  , In = Rs(Zt);
async function Ns() {
    return new Promise( (i, e) => {
        const t = crypto.randomUUID()
          , r = n => {
            n.source === window.parent && n.data?.type === "LIST_TABS_RESPONSE" && n.data.id === t && (window.removeEventListener("message", r),
            n.data.success ? i(n.data.tabs) : e(new Error(n.data.error || "Failed to list tabs")))
        }
        ;
        window.addEventListener("message", r),
        setTimeout( () => {
            window.removeEventListener("message", r),
            e(new Error("listTabs timeout"))
        }
        , 1e4),
        window.parent.postMessage({
            type: "LIST_TABS_REQUEST",
            id: t
        }, "*")
    }
    )
}
async function Ru(i) {
    return new Promise( (e, t) => {
        const r = crypto.randomUUID()
          , n = s => {
            s.source === window.parent && s.data?.type === "CREATE_TAB_RESPONSE" && s.data.id === r && (window.removeEventListener("message", n),
            s.data.success ? e(s.data.tab) : t(new Error(s.data.error || "Failed to create tab")))
        }
        ;
        window.addEventListener("message", n),
        setTimeout( () => {
            window.removeEventListener("message", n),
            t(new Error("createTab timeout"))
        }
        , 1e4),
        window.parent.postMessage({
            type: "CREATE_TAB_REQUEST",
            id: r,
            url: i
        }, "*")
    }
    )
}
async function Lu(i) {
    return new Promise( (e, t) => {
        const r = crypto.randomUUID()
          , n = s => {
            s.source === window.parent && s.data?.type === "CLOSE_TAB_RESPONSE" && s.data.id === r && (window.removeEventListener("message", n),
            s.data.success ? e() : t(new Error(s.data.error || "Failed to close tab")))
        }
        ;
        window.addEventListener("message", n),
        setTimeout( () => {
            window.removeEventListener("message", n),
            t(new Error("closeTab timeout"))
        }
        , 1e4),
        window.parent.postMessage({
            type: "CLOSE_TAB_REQUEST",
            id: r,
            tabId: i
        }, "*")
    }
    ).finally(async () => {
        it === i && ($("[sandbox] closeTab clearing cached connection for tab:", i),
        Kt && await Mr(Kt.close(), 5e3, "browser.close").catch(e => {
            $("[sandbox] browser.close error:", e.message)
        }
        ),
        Ur())
    }
    )
}
async function Nu(i) {
    return new Promise( (e, t) => {
        const r = crypto.randomUUID()
          , n = s => {
            s.source === window.parent && s.data?.type === "ACTIVATE_TAB_RESPONSE" && s.data.id === r && (window.removeEventListener("message", n),
            s.data.success ? e() : t(new Error(s.data.error || "Failed to activate tab")))
        }
        ;
        window.addEventListener("message", n),
        setTimeout( () => {
            window.removeEventListener("message", n),
            t(new Error("activateTab timeout"))
        }
        , 5e3),
        window.parent.postMessage({
            type: "ACTIVATE_TAB_REQUEST",
            id: r,
            tabId: i
        }, "*")
    }
    )
}
async function Ou(i) {
    await i.focus(),
    await i.click({
        clickCount: 4
    }),
    await i.evaluate(e => {
        const t = e.closest("input, textarea, [contenteditable]") || e;
        if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement)
            t.select();
        else if ("isContentEditable"in t && t.isContentEditable) {
            const r = document.createRange();
            r.selectNodeContents(t);
            const n = window.getSelection();
            n && (n.removeAllRanges(),
            n.addRange(r))
        }
    }
    ),
    await new Promise(e => setTimeout(e, 50)),
    await i.press("Backspace")
}
const pt = mu()
  , Du = pt.readFile
  , Bu = pt.writeFile
  , Ku = pt.listFiles
  , Hu = pt.deleteFile
  , Uu = pt.mkdir
  , qu = pt.exists
  , Wu = pt.stat
  , $u = pt.bash
  , Ce = bu();
async function Vu() {
    const i = await Ns();
    if (it != null) {
        const t = i.find(r => r.id === it);
        if (t)
            return t
    }
    const e = i.find(t => t.active);
    if (!e)
        throw new Error("No active browser tab found");
    return e
}
async function xr() {
    const i = await Vu()
      , e = Jl(i.url);
    if (!e)
        throw new Error("Active tab is not a Google Sheet. Open a Sheet tab or pass spreadsheetId.");
    return {
        kind: "sheet",
        spreadsheetId: e,
        tabId: i.id,
        url: i.url,
        title: i.title
    }
}
async function je(i) {
    return i || (await xr()).spreadsheetId
}
function ju(i) {
    try {
        const t = new URL(i).searchParams.get("gid");
        if (!t)
            return null;
        const r = Number.parseInt(t, 10);
        return Number.isInteger(r) && r >= 0 ? r : null
    } catch {
        return null
    }
}
const zu = {
    status: () => Ce.status(),
    current: () => xr(),
    sheets: {
        createSpreadsheet: i => Ce.sheetsCreateSpreadsheet(i),
        getSpreadsheet: async i => Ce.sheetsGetSpreadsheet({
            ...i,
            spreadsheetId: await je(i?.spreadsheetId)
        }),
        listSheets: async i => Ce.sheetsListSheets({
            ...i,
            spreadsheetId: await je(i?.spreadsheetId)
        }),
        requestAccess: async i => {
            let e = i?.spreadsheetId;
            if (!e)
                try {
                    e = (await xr()).spreadsheetId
                } catch {}
            return Ce.sheetsRequestAccess({
                ...i,
                spreadsheetId: e,
                source: i?.source ?? "agent"
            })
        }
        ,
        readRange: async i => Ce.sheetsReadRange({
            ...i,
            spreadsheetId: await je(i.spreadsheetId)
        }),
        batchRead: async i => Ce.sheetsBatchRead({
            ...i,
            spreadsheetId: await je(i.spreadsheetId)
        }),
        writeRange: async i => Ce.sheetsWriteRange({
            ...i,
            spreadsheetId: await je(i.spreadsheetId)
        }),
        batchWrite: async i => Ce.sheetsBatchWrite({
            ...i,
            spreadsheetId: await je(i.spreadsheetId)
        }),
        appendRows: async i => Ce.sheetsAppendRows({
            ...i,
            spreadsheetId: await je(i.spreadsheetId)
        }),
        clearRange: async i => Ce.sheetsClearRange({
            ...i,
            spreadsheetId: await je(i.spreadsheetId)
        }),
        batchClear: async i => Ce.sheetsBatchClear({
            ...i,
            spreadsheetId: await je(i.spreadsheetId)
        }),
        setFormat: async i => {
            const e = i.spreadsheetId ? null : await xr()
              , t = i.spreadsheetId ?? e?.spreadsheetId;
            if (!t)
                throw new Error("spreadsheetId is required. Use workspace.current() to resolve the active sheet.");
            const r = Au(i.range);
            if (r.cellCount > Mn)
                throw new Error(`Range exceeds setFormat limit (${Mn} cells).`);
            const n = Pu(i.format)
              , s = await Ce.sheetsListSheets({
                spreadsheetId: t
            })
              , a = e ? ju(e.url) : null
              , c = xu({
                sheets: s.sheets.map(d => ({
                    sheetId: d.sheetId,
                    title: d.title
                })),
                explicitSheet: i.sheet,
                sheetTitleFromRange: r.sheetTitle,
                fallbackSheetId: a
            });
            return await Ce.sheetsBatchUpdate({
                spreadsheetId: t,
                requests: [Mu({
                    parsedRange: r,
                    resolvedSheetId: c.sheetId,
                    userEnteredFormat: n.userEnteredFormat,
                    appliedFields: n.appliedFields
                })]
            }),
            {
                spreadsheetId: t,
                range: r.rawRange,
                resolvedSheetId: c.sheetId,
                resolvedSheetTitle: c.sheetTitle,
                updatedCells: r.cellCount,
                appliedFields: n.appliedFields
            }
        }
        ,
        batchUpdate: async i => Ce.sheetsBatchUpdate({
            ...i,
            spreadsheetId: await je(i.spreadsheetId)
        })
    }
};
function Mr(i, e, t) {
    return Promise.race([i, new Promise( (r, n) => setTimeout( () => n(new Error(`${t} timed out after ${e}ms`)), e))])
}
async function Gu(i) {
    if ($("[sandbox] connectToPage called with tabId:", i),
    await Nu(i).catch(a => {
        $("[sandbox] Failed to activate tab:", a)
    }
    ),
    Pr && it === i)
        return $("[sandbox] returning cached page for tab:", i),
        Pr;
    Kt && it !== i && ($("[sandbox] closing previous connection for tab:", it),
    await Mr(Kt.close(), 5e3, "browser.close").catch(a => {
        $("[sandbox] browser.close error:", a.message)
    }
    ),
    Ur());
    const e = await ji.connectTab(i);
    $("[sandbox] transport created");
    const t = await Mr(Hl({
        transport: e,
        defaultViewport: null
    }), 1e4, "puppeteer.connect");
    $("[sandbox] browser connected"),
    t.on("disconnected", () => {
        $("[sandbox] browser disconnected, clearing cache"),
        Ur()
    }
    );
    const r = t.targets();
    $("[sandbox] initial targets:", r.map(a => ({
        type: a.type(),
        url: a.url()
    }))),
    $("[sandbox] waiting for page target...");
    const n = await t.waitForTarget(a => ($("[sandbox] checking target:", a.type(), a.url()),
    a.type() === "page"), {
        timeout: 1e4
    });
    $("[sandbox] found target:", n.type(), n.url());
    const s = await Mr(n.page(), 1e4, "target.page");
    return $("[sandbox] got page:", s),
    Kt = t,
    Pr = s ?? null,
    it = i,
    s
}
window.addEventListener("message", async i => {
    if (i.source !== window.parent)
        return;
    const e = i.data;
    e?.type === "EVAL_REQUEST" && await Qu(e)
}
);
function Xu(i) {
    if (i === void 0)
        return "undefined";
    if (i === null)
        return "null";
    if (typeof i == "string")
        return i;
    if (typeof i == "number" || typeof i == "boolean")
        return String(i);
    try {
        return JSON.stringify(i, null, 2)
    } catch {
        return String(i)
    }
}
function gr(i) {
    if (typeof i == "object" && i !== null)
        try {
            return JSON.stringify(i)
        } catch {
            return String(i)
        }
    return String(i)
}
async function Qu(i) {
    const {id: e, code: t, timeout: r=1e4} = i
      , n = Date.now();
    $("[sandbox] handleEvalRequest called, id:", e, "timeout:", r),
    Vt = new AbortController,
    Zt = {
        images: [],
        counter: 0
    },
    In = Rs(Zt);
    const s = []
      , a = {
        log: console.log,
        warn: console.warn,
        error: console.error,
        info: console.info
    };
    console.log = (...d) => {
        s.push(d.map(gr).join(" ")),
        a.log(...d)
    }
    ,
    console.warn = (...d) => {
        s.push(`[warn] ${d.map(gr).join(" ")}`),
        a.warn(...d)
    }
    ,
    console.error = (...d) => {
        s.push(`[error] ${d.map(gr).join(" ")}`),
        a.error(...d)
    }
    ,
    console.info = (...d) => {
        s.push(`[info] ${d.map(gr).join(" ")}`),
        a.info(...d)
    }
    ;
    const c = () => {
        console.log = a.log,
        console.warn = a.warn,
        console.error = a.error,
        console.info = a.info
    }
    ;
    try {
        let d;
        $("[sandbox] Starting code execution");
        const f = ["listTabs", "connectToPage", "logImage", "createTab", "closeTab", "waitForPageLoad", "getSnapshot", "getElementByRef", "clearInput", "readFile", "writeFile", "listFiles", "deleteFile", "mkdir", "exists", "stat", "bash", "workspace", "checkAbort", "getAbortSignal"]
          , u = [Ns, Gu, In, Ru, Lu, $l, Xl, zl, Ou, Du, Bu, Ku, Hu, Uu, qu, Wu, $u, zu, Iu, Fu];
        try {
            const C = new Function(...f,`return (async () => { return (${t}); })()`);
            d = await Promise.race([C(...u), new Promise( (A, x) => setTimeout( () => x(new Error("Timeout")), r))])
        } catch {
            const C = new Function(...f,`return (async () => { ${t} })()`);
            d = await Promise.race([C(...u), new Promise( (A, x) => setTimeout( () => x(new Error("Timeout")), r))])
        }
        c();
        const p = Date.now() - n;
        $("[sandbox] Code execution completed, executionTime:", p, "ms");
        const w = s.length > 0 ? s.join(`
`) : "(no console output)"
          , v = Xu(d)
          , T = _n(["[Console Output]", w, "", "[Return Value]", v, "", "[Execution Time]", `${p}ms`].join(`
`));
        $("[sandbox] Posting EVAL_RESULT (success), id:", e),
        window.parent.postMessage({
            type: "EVAL_RESULT",
            id: e,
            success: !0,
            output: T,
            hasError: !1,
            images: Zt.images
        }, "*")
    } catch (d) {
        $("[sandbox] Code execution error:", d),
        c();
        const f = Date.now() - n
          , u = d instanceof DOMException && d.name === "AbortError"
          , p = d instanceof Error ? d.message : String(d)
          , w = s.length > 0 ? s.join(`
`) : "(no console output)"
          , v = _n([u ? "[Aborted]" : "[Error]", p, "", "[Console Output]", w, "", "[Execution Time]", `${f}ms`].join(`
`));
        $("[sandbox] Posting EVAL_RESULT (error), id:", e, "aborted:", u),
        window.parent.postMessage({
            type: "EVAL_RESULT",
            id: e,
            success: !1,
            output: v,
            hasError: !0,
            aborted: u,
            images: Zt.images
        }, "*")
    } finally {
        Vt = null
    }
}
$("[sandbox] Script loaded");
window.addEventListener("message", i => {
    i.source === window.parent && ($("[sandbox] Received message:", i.data?.type),
    i.data?.type === "SANDBOX_PING" && ($("[sandbox] Responding to ping with SANDBOX_READY"),
    window.parent.postMessage({
        type: "SANDBOX_READY"
    }, "*")))
}
);
$("[sandbox] Sending initial SANDBOX_READY");
window.parent.postMessage({
    type: "SANDBOX_READY"
}, "*");
export {Rr as $, Vr as A, nr as B, ys as C, V as D, Z as E, tt as F, Tr as G, Tc as H, ze as I, Ot as J, _o as K, ko as L, Tt as M, De as N, Ui as O, Et as P, on as Q, Lc as R, dl as S, ut as T, Hi as U, Sc as V, Oc as W, di as X, Yu as Y, ae as Z, Ee as _, nn as a, Ze as a0, et as a1, Dc as a2, wn as a3, Lt as a4, jt as a5, Be as a6, Pe as a7, ja as a8, Za as a9, Zu as aa, Mt as ab, G as ac, Cc as ad, _c as ae, ge as af, Ac as ag, gi as ah, Ic as ai, Xc as aj, Sl as ak, $c as al, Po as am, W as an, Hc as ao, ad as ap, fs as aq, Nc as ar, Me as as, xo as at, Io as au, Mo as av, ks as b, So as c, Ki as d, O as e, ft as f, q as g, I as h, sd as i, wc as j, bt as k, U as l, Lo as m, ht as n, tr as o, go as p, qe as q, hn as r, Bi as s, B as t, mo as u, ri as v, Ec as w, td as x, rd as y, id as z};
