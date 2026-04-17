
//#endregion
//#region apex-log-parser/src/types.ts
const LOG_LEVEL = {
    Error: "ERROR",
    Warn: "WARN",
    Info: "INFO",
    Debug: "DEBUG",
    Fine: "FINE",
    Finer: "FINER",
    Finest: "FINEST"
};
/**
* Original Salesforce debug log categories as defined in SF Setup > Debug Log Levels.
* These are the categories users configure in the Salesforce UI.
* See: https://help.salesforce.com/s/articleView?id=platform.code_setting_debug_log_levels.htm
*/
const DEBUG_CATEGORY = {
    Database: "Database",
    Workflow: "Workflow",
    NBA: "NBA",
    Validation: "Validation",
    Callout: "Callout",
    ApexCode: "Apex Code",
    ApexProfiling: "Apex Profiling",
    Visualforce: "Visualforce",
    System: "System",
    DataAccess: "Data Access",
    Wave: "Wave"
};
/**
* Timeline display categories - our simplified/enhanced view of SF categories.
* Split Database → DML + SOQL, merge Flow + Workflow → Automation.
*/
const LOG_CATEGORY = {
    Apex: "Apex",
    System: "System",
    CodeUnit: "Code Unit",
    Automation: "Automation",
    DML: "DML",
    SOQL: "SOQL",
    Validation: "Validation",
    Callout: "Callout"
};
/** Readonly array of all category values (for building Sets, iterating, etc.) */
const ALL_LOG_CATEGORIES = Object.values(LOG_CATEGORY);

export const initialize = (vscode: any) => {
    const { CodeLens, ConfigurationTarget, FoldingRange, FoldingRangeKind, MarkdownString, Range, Selection, TabInputText, Uri, commands, languages, window: window$1, workspace } = vscode as any;
            

    //#region \0rolldown/runtime.js
    var __defProp = Object.defineProperty;
    var __name = (target, value) => __defProp(target, "name", {
        value,
        configurable: true
    });

    //#endregion
    //#region lana/src/stubs/fspromises.ts
    /**
    * Browser-safe fs/promises stub.
    * readFile is implemented using the VS Code workspace virtual FS so LogEventCache works
    * correctly when decorations/folding providers need to parse open log files.
    */
    async function readFile(filePath, encoding) {
        const bytes = await workspace.fs.readFile(Uri.file(filePath));
        if (encoding === "utf-8" || encoding === "utf8") return new TextDecoder().decode(bytes);
        return bytes;
    }

    

    //#endregion
    //#region apex-log-parser/src/LogEvents.ts
    /**
    * All log lines extend this base class.
    */
    var LogEvent = class {
        constructor(parser, parts) {
            this.parent = null;
            this.children = [];
            this.type = null;
            this.logLine = "";
            this.text = "";
            this.acceptsText = false;
            this.isExit = false;
            this.isParent = false;
            this.isTruncated = false;
            this.nextLineIsExit = false;
            this.lineNumber = null;
            this.namespace = "";
            this.hasValidSymbols = false;
            this.suffix = null;
            this.discontinuity = false;
            this.timestamp = 0;
            this.exitStamp = null;
            this.category = "";
            this.debugCategory = "";
            this.debugLevel = "";
            this.cpuType = "";
            this.duration = {
                self: 0,
                total: 0
            };
            this.dmlRowCount = {
                self: 0,
                total: 0
            };
            this.soqlRowCount = {
                self: 0,
                total: 0
            };
            this.soslRowCount = {
                self: 0,
                total: 0
            };
            this.dmlCount = {
                self: 0,
                total: 0
            };
            this.soqlCount = {
                self: 0,
                total: 0
            };
            this.soslCount = {
                self: 0,
                total: 0
            };
            this.totalThrownCount = 0;
            this.exitTypes = [];
            this.logParser = parser;
            const [timeData, type] = parts;
            if (type) this.text = this.type = type;
            if (timeData) this.timestamp = this.parseTimestamp(timeData);
        }
        recalculateDurations() {
            if (this.exitStamp) this.duration.total = this.duration.self = this.exitStamp - this.timestamp;
        }
        parseTimestamp(text) {
            const start = text.indexOf("(");
            if (start !== -1) return Number(text.slice(start + 1, -1));
            throw new Error(`Unable to parse timestamp: '${text}'`);
        }
        parseLineNumber(text) {
            switch (true) {
                case text === "[EXTERNAL]": return "EXTERNAL";
                case !!text: {
                    const lineNumberStr = text.slice(1, -1);
                    if (lineNumberStr) return Number(lineNumberStr);
                    throw new Error(`Unable to parse line number: '${text}'`);
                }
                default: return 0;
            }
        }
    };
    var DurationLogEvent = class extends LogEvent {
        constructor(parser, parts, exitTypes, category, cpuType) {
            super(parser, parts);
            this.isParent = true;
            this.exitTypes = exitTypes;
            this.category = category;
            this.cpuType = cpuType;
        }
    };
    var BasicLogLine = class extends LogEvent {};
    var BasicExitLine = class extends LogEvent {
        constructor(..._args) {
            super(..._args);
            this.isExit = true;
        }
    };
    /**
    * This export class represents the single root node for the node tree.
    * It is a "pseudo" node and not present in the log.
    * Since it has children it extends "Method".
    */
    var ApexLog = class extends LogEvent {
        constructor(parser) {
            super(parser, []);
            this.type = null;
            this.text = "LOG_ROOT";
            this.timestamp = 0;
            this.exitStamp = 0;
            this.exitTypes = [];
            this.category = "";
            this.cpuType = "";
            this.size = 0;
            this.debugLevels = [];
            this.namespaces = [];
            this.logIssues = [];
            this.parsingErrors = [];
            this.governorLimits = {
                soqlQueries: {
                    used: 0,
                    limit: 0
                },
                soslQueries: {
                    used: 0,
                    limit: 0
                },
                queryRows: {
                    used: 0,
                    limit: 0
                },
                dmlStatements: {
                    used: 0,
                    limit: 0
                },
                publishImmediateDml: {
                    used: 0,
                    limit: 0
                },
                dmlRows: {
                    used: 0,
                    limit: 0
                },
                cpuTime: {
                    used: 0,
                    limit: 0
                },
                heapSize: {
                    used: 0,
                    limit: 0
                },
                callouts: {
                    used: 0,
                    limit: 0
                },
                emailInvocations: {
                    used: 0,
                    limit: 0
                },
                futureCalls: {
                    used: 0,
                    limit: 0
                },
                queueableJobsAddedToQueue: {
                    used: 0,
                    limit: 0
                },
                mobileApexPushCalls: {
                    used: 0,
                    limit: 0
                },
                byNamespace: /* @__PURE__ */ new Map(),
                snapshots: []
            };
            this.startTime = null;
            this.executionEndTime = 0;
        }
        setTimes() {
            const firstChild = this.children.find((child) => {
                return child.timestamp;
            });
            this.timestamp = firstChild?.timestamp || 0;
            if (firstChild?.logLine) this.startTime = parseWallClockTime(firstChild.logLine);
            let endTime;
            const reverseLen = this.children.length - 1;
            for (let i = reverseLen; i >= 0; i--) {
                const child = this.children[i];
                if (child?.exitStamp) {
                    endTime ??= child.exitStamp;
                    if (child.duration) {
                        this.executionEndTime = child.exitStamp;
                        break;
                    }
                }
                endTime ??= child?.timestamp;
            }
            this.exitStamp = endTime || 0;
            this.recalculateDurations();
        }
    };
    function parseObjectNamespace(text) {
        if (!text) return "";
        const sep = text.indexOf("__");
        if (sep === -1) return "default";
        return text.slice(0, sep);
    }
    function parseVfNamespace(text) {
        const sep = text.indexOf("__");
        if (sep === -1) return "default";
        const firstSlash = text.indexOf("/");
        if (firstSlash === -1) return "default";
        const secondSlash = text.indexOf("/", firstSlash + 1);
        if (secondSlash < 0) return "default";
        return text.substring(secondSlash + 1, sep);
    }
    /**
    * Parses the wall-clock time from a log line's timestamp portion.
    * Log lines start with `HH:MM:SS.f (nanoseconds)|...`
    * Returns milliseconds since midnight, or null if parsing fails.
    */
    function parseWallClockTime(logLine) {
        const match = /^(\d{1,2}):(\d{2}):(\d{2})\.(\d+)\s/.exec(logLine);
        if (!match) return null;
        const hours = Number(match[1]);
        const minutes = Number(match[2]);
        const seconds = Number(match[3]);
        const fraction = Number(match[4].padEnd(3, "0"));
        return (hours * 3600 + minutes * 60 + seconds) * 1e3 + fraction;
    }
    function parseRows(text) {
        if (!text) return 0;
        const rowCount = text.slice(text.indexOf("Rows:") + 5);
        if (rowCount) return Number(rowCount);
        throw new Error(`Unable to parse row count: '${text}'`);
    }
    var BulkHeapAllocateLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Finest;
            this.debugCategory = DEBUG_CATEGORY.ApexCode;
            this.logCategory = "Apex Code";
            this.text = parts[2] || "";
        }
    };
    var CalloutRequestLine = class extends DurationLogEvent {
        constructor(parser, parts) {
            super(parser, parts, ["CALLOUT_RESPONSE"], LOG_CATEGORY.Callout, "free");
            this.debugCategory = DEBUG_CATEGORY.Callout;
            this.debugLevel = LOG_LEVEL.Info;
            this.text = parts[3] ?? "";
            this.lineNumber = this.parseLineNumber(parts[2]);
        }
    };
    var CalloutResponseLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Info;
            this.debugCategory = DEBUG_CATEGORY.Callout;
            this.isExit = true;
            this.text = parts[3] ?? "";
            this.lineNumber = this.parseLineNumber(parts[2]);
        }
    };
    var NamedCredentialRequestLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.Callout;
            this.debugLevel = LOG_LEVEL.Info;
            this.text = `${parts[3]} : ${parts[4]} : ${parts[5]} : ${parts[6]}`;
        }
    };
    var NamedCredentialResponseLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.Callout;
            this.debugLevel = LOG_LEVEL.Info;
            this.text = `${parts[2]}`;
        }
    };
    var NamedCredentialResponseDetailLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.Callout;
            this.debugLevel = LOG_LEVEL.Finer;
            this.text = `${parts[3]} : ${parts[4]} ${parts[5]} : ${parts[6]} ${parts[7]}`;
        }
    };
    var ConstructorEntryLine = class extends DurationLogEvent {
        constructor(parser, parts) {
            super(parser, parts, ["CONSTRUCTOR_EXIT"], LOG_CATEGORY.Apex, "method");
            this.debugCategory = DEBUG_CATEGORY.ApexCode;
            this.debugLevel = LOG_LEVEL.Fine;
            this.hasValidSymbols = true;
            this.suffix = " (constructor)";
            this.lineNumber = this.parseLineNumber(parts[2]);
            const [, , , , args, className] = parts;
            this.text = className + (args ? args.substring(args.lastIndexOf("(")) : "");
            const possibleNS = this._parseConstructorNamespace(className || "");
            if (possibleNS) this.namespace = possibleNS;
        }
        _parseConstructorNamespace(className) {
            let possibleNs = className.slice(0, className.indexOf("."));
            if (this.logParser.namespaces.has(possibleNs)) return possibleNs;
            const constructorParts = (className ?? "").split(".");
            possibleNs = constructorParts[0] || "";
            if (constructorParts.length === 3) return possibleNs;
            return "";
        }
    };
    var ConstructorExitLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Fine;
            this.debugCategory = DEBUG_CATEGORY.ApexCode;
            this.isExit = true;
            this.lineNumber = this.parseLineNumber(parts[2]);
        }
    };
    var EmailQueueLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Info;
            this.debugCategory = DEBUG_CATEGORY.ApexCode;
            this.acceptsText = true;
            this.lineNumber = this.parseLineNumber(parts[2]);
        }
    };
    var MethodEntryLine = class extends DurationLogEvent {
        constructor(parser, parts) {
            super(parser, parts, ["METHOD_EXIT"], LOG_CATEGORY.Apex, "method");
            this.debugCategory = DEBUG_CATEGORY.ApexCode;
            this.debugLevel = LOG_LEVEL.Fine;
            this.hasValidSymbols = true;
            const [, , lineNumber, , methodName] = parts;
            this.lineNumber = this.parseLineNumber(lineNumber);
            this.text = methodName || this.type || this.text;
            if (this.text.startsWith("System.Type.forName(")) this.cpuType = "loading";
            else {
                const possibleNs = this._parseMethodNamespace(methodName);
                if (possibleNs) this.namespace = possibleNs;
            }
        }
        onEnd(end, _stack) {
            if (end.namespace && !end.text.endsWith(")")) this.namespace = end.namespace;
        }
        _parseMethodNamespace(methodName) {
            if (!methodName) return "";
            const methodBracketIndex = methodName.indexOf("(");
            if (methodBracketIndex === -1) return "";
            const nsSeparator = methodName.indexOf(".");
            if (nsSeparator === -1) return "";
            const possibleNs = methodName.slice(0, nsSeparator);
            if (this.logParser.namespaces.has(possibleNs)) return possibleNs;
            const methodNameParts = methodName.slice(0, methodBracketIndex)?.split(".");
            if (methodNameParts.length === 4) return methodNameParts[0] ?? "";
            else if (methodNameParts.length === 2) return "default";
            return "";
        }
    };
    var MethodExitLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Fine;
            this.debugCategory = DEBUG_CATEGORY.ApexCode;
            this.isExit = true;
            this.lineNumber = this.parseLineNumber(parts[2]);
            this.text = parts[4] ?? parts[3] ?? this.text;
            if (!this.text.endsWith(")")) {
                const index = this.text.indexOf(".");
                if (index !== -1) this.namespace = this.text.slice(0, index);
            }
        }
    };
    var SystemConstructorEntryLine = class extends DurationLogEvent {
        constructor(parser, parts) {
            super(parser, parts, ["SYSTEM_CONSTRUCTOR_EXIT"], LOG_CATEGORY.System, "method");
            this.debugCategory = DEBUG_CATEGORY.System;
            this.debugLevel = LOG_LEVEL.Fine;
            this.suffix = "(system constructor)";
            this.lineNumber = this.parseLineNumber(parts[2]);
            this.text = parts[3] || "";
        }
    };
    var SystemConstructorExitLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Fine;
            this.debugCategory = DEBUG_CATEGORY.System;
            this.isExit = true;
            this.lineNumber = this.parseLineNumber(parts[2]);
        }
    };
    var SystemMethodEntryLine = class extends DurationLogEvent {
        constructor(parser, parts) {
            super(parser, parts, ["SYSTEM_METHOD_EXIT"], LOG_CATEGORY.System, "method");
            this.debugCategory = DEBUG_CATEGORY.System;
            this.debugLevel = LOG_LEVEL.Fine;
            this.lineNumber = this.parseLineNumber(parts[2]);
            this.text = parts[3] || "";
        }
    };
    var SystemMethodExitLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Fine;
            this.debugCategory = DEBUG_CATEGORY.System;
            this.isExit = true;
            this.lineNumber = this.parseLineNumber(parts[2]);
        }
    };
    var CodeUnitStartedLine = class extends DurationLogEvent {
        constructor(parser, parts) {
            super(parser, parts, ["CODE_UNIT_FINISHED"], LOG_CATEGORY.CodeUnit, "custom");
            this.debugCategory = DEBUG_CATEGORY.ApexCode;
            this.debugLevel = LOG_LEVEL.Error;
            this.suffix = " (entrypoint)";
            this.codeUnitType = "";
            const typeString = parts[5] || parts[4] || parts[3] || "";
            let sepIndex = typeString.indexOf(":");
            if (sepIndex === -1) sepIndex = typeString.indexOf("/");
            this.codeUnitType = sepIndex !== -1 ? typeString.slice(0, sepIndex) : "";
            const name = parts[4] || parts[3] || this.codeUnitType || "";
            switch (this.codeUnitType) {
                case "EventService":
                    this.cpuType = "method";
                    this.namespace = parseObjectNamespace(typeString.slice(sepIndex + 1));
                    this.text = name;
                    break;
                case "Validation":
                    this.cpuType = "custom";
                    this.text = name;
                    break;
                case "Workflow":
                    this.cpuType = "custom";
                    this.text = name;
                    break;
                case "Flow":
                    this.cpuType = "custom";
                    this.text = name;
                    break;
                case "VF":
                    this.cpuType = "method";
                    this.namespace = parseVfNamespace(name);
                    this.text = name;
                    break;
                case "apex": {
                    this.cpuType = "method";
                    const namespaceIndex = name.indexOf(".");
                    this.namespace = namespaceIndex !== -1 ? name.slice(name.indexOf("apex://") + 7, namespaceIndex) : "default";
                    this.text = name;
                    break;
                }
                case "__sfdc_trigger": {
                    this.cpuType = "method";
                    this.text = name || parts[4] || "";
                    const triggerParts = parts[5]?.split("/") || "";
                    this.namespace = triggerParts.length === 3 ? triggerParts[1] || "default" : "default";
                    break;
                }
                default: {
                    this.cpuType = "method";
                    this.text = name;
                    const openBracket = name.lastIndexOf("(");
                    const methodName = openBracket !== -1 ? name.slice(0, openBracket + 1).split(".") : name.split(".");
                    if (methodName.length === 3 || methodName.length === 2 && !methodName[1]?.endsWith("(")) this.namespace = methodName[0] || "default";
                    break;
                }
            }
            this.namespace ||= "default";
        }
    };
    var CodeUnitFinishedLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Error;
            this.debugCategory = DEBUG_CATEGORY.ApexCode;
            this.isExit = true;
            this.text = parts[2] || "";
        }
    };
    var VFApexCallStartLine = class extends DurationLogEvent {
        constructor(parser, parts) {
            super(parser, parts, ["VF_APEX_CALL_END"], LOG_CATEGORY.Apex, "method");
            this.debugCategory = DEBUG_CATEGORY.Visualforce;
            this.debugLevel = LOG_LEVEL.Fine;
            this.hasValidSymbols = true;
            this.suffix = " (VF APEX)";
            this.invalidClasses = [
                "pagemessagescomponentcontroller",
                "pagemessagecomponentcontroller",
                "severitymessages"
            ];
            this.lineNumber = this.parseLineNumber(parts[2]);
            const classText = parts[5] || parts[3] || "";
            let methodtext = parts[4] || "";
            if (!methodtext && (!classText.includes(" ") || this.invalidClasses.some((invalidCls) => classText.toLowerCase().includes(invalidCls)))) {
                this.exitTypes = [];
                this.hasValidSymbols = false;
            } else if (methodtext) {
                const methodIndex = methodtext.indexOf("(");
                const constructorIndex = methodtext.indexOf("<init>");
                if (methodIndex > -1) methodtext = "." + methodtext.substring(methodIndex).slice(1, -1) + "()";
                else if (constructorIndex > -1) methodtext = methodtext.substring(constructorIndex + 6) + "()";
                else methodtext = "." + methodtext;
            }
            this.text = classText + methodtext;
        }
    };
    var VFApexCallEndLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Fine;
            this.debugCategory = DEBUG_CATEGORY.Visualforce;
            this.isExit = true;
            this.text = parts[2] || "";
        }
    };
    var VFDeserializeViewstateBeginLine = class extends DurationLogEvent {
        constructor(parser, parts) {
            super(parser, parts, ["VF_DESERIALIZE_VIEWSTATE_END"], LOG_CATEGORY.System, "method");
            this.debugCategory = DEBUG_CATEGORY.Visualforce;
            this.debugLevel = LOG_LEVEL.Info;
        }
    };
    var VFFormulaStartLine = class extends DurationLogEvent {
        constructor(parser, parts) {
            super(parser, parts, ["VF_EVALUATE_FORMULA_END"], LOG_CATEGORY.System, "custom");
            this.debugCategory = DEBUG_CATEGORY.Visualforce;
            this.debugLevel = LOG_LEVEL.Finer;
            this.suffix = " (VF FORMULA)";
            this.text = parts[3] || "";
        }
    };
    var VFFormulaEndLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.Visualforce;
            this.debugLevel = LOG_LEVEL.Finer;
            this.isExit = true;
            this.text = parts[2] || "";
        }
    };
    var VFSeralizeViewStateStartLine = class extends DurationLogEvent {
        constructor(parser, parts) {
            super(parser, parts, ["VF_SERIALIZE_VIEWSTATE_END"], LOG_CATEGORY.System, "method");
            this.debugCategory = DEBUG_CATEGORY.Visualforce;
            this.debugLevel = LOG_LEVEL.Info;
        }
    };
    var VFPageMessageLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.ApexCode;
            this.debugLevel = LOG_LEVEL.Info;
            this.acceptsText = true;
            this.text = parts[2] || "";
        }
    };
    var DMLBeginLine = class extends DurationLogEvent {
        constructor(parser, parts) {
            super(parser, parts, ["DML_END"], LOG_CATEGORY.DML, "free");
            this.debugCategory = DEBUG_CATEGORY.Database;
            this.debugLevel = LOG_LEVEL.Info;
            this.dmlCount = {
                self: 1,
                total: 1
            };
            this.namespace = "default";
            this.lineNumber = this.parseLineNumber(parts[2]);
            this.text = "DML " + parts[3] + " " + parts[4];
            const rowCountString = parts[5];
            this.dmlRowCount.total = this.dmlRowCount.self = rowCountString ? parseRows(rowCountString) : 0;
        }
    };
    var DMLEndLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Info;
            this.debugCategory = DEBUG_CATEGORY.Database;
            this.isExit = true;
            this.lineNumber = this.parseLineNumber(parts[2]);
        }
    };
    var IdeasQueryExecuteLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Finest;
            this.debugCategory = DEBUG_CATEGORY.Database;
            this.lineNumber = this.parseLineNumber(parts[2]);
        }
    };
    var SOQLExecuteBeginLine = class extends DurationLogEvent {
        constructor(parser, parts) {
            super(parser, parts, ["SOQL_EXECUTE_END"], LOG_CATEGORY.SOQL, "free");
            this.debugCategory = DEBUG_CATEGORY.Database;
            this.debugLevel = LOG_LEVEL.Info;
            this.aggregations = 0;
            this.children = [];
            this.soqlCount = {
                self: 1,
                total: 1
            };
            this.lineNumber = this.parseLineNumber(parts[2]);
            const [, , , aggregations, soqlString] = parts;
            const aggregationText = aggregations || "";
            if (aggregationText) {
                const aggregationIndex = aggregationText.indexOf("Aggregations:");
                this.aggregations = Number(aggregationText.slice(aggregationIndex + 13));
            }
            this.text = soqlString || "";
        }
        onEnd(end, _stack) {
            this.soqlRowCount.total = this.soqlRowCount.self = end.soqlRowCount.total;
        }
    };
    var SOQLExecuteEndLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Info;
            this.debugCategory = DEBUG_CATEGORY.Database;
            this.isExit = true;
            this.lineNumber = this.parseLineNumber(parts[2]);
            this.soqlRowCount.total = this.soqlRowCount.self = parseRows(parts[3] || "");
        }
    };
    var SOQLExecuteExplainLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Finest;
            this.debugCategory = DEBUG_CATEGORY.Database;
            this.cardinality = null;
            this.fields = null;
            this.leadingOperationType = null;
            this.relativeCost = null;
            this.sObjectCardinality = null;
            this.sObjectType = null;
            this.lineNumber = this.parseLineNumber(parts[2]);
            const queryPlanDetails = parts[3] || "";
            this.text = queryPlanDetails;
            const queryplanParts = queryPlanDetails.split("],");
            if (queryplanParts.length > 1) {
                const planExplain = queryplanParts[0] || "";
                const [cardinalityText, sobjCardinalityText, costText] = (queryplanParts[1] || "").split(",");
                const onIndex = planExplain.indexOf(" on");
                this.leadingOperationType = planExplain.slice(0, onIndex);
                const colonIndex = planExplain.indexOf(" :");
                this.sObjectType = planExplain.slice(onIndex + 4, colonIndex);
                const fieldsAsString = planExplain.slice(planExplain.indexOf("[") + 1).replace(/\s+/g, "");
                this.fields = fieldsAsString === "" ? [] : fieldsAsString.split(",");
                this.cardinality = cardinalityText ? Number(cardinalityText.slice(cardinalityText.indexOf("cardinality: ") + 13)) : null;
                this.sObjectCardinality = sobjCardinalityText ? Number(sobjCardinalityText.slice(sobjCardinalityText.indexOf("sobjectCardinality: ") + 20)) : null;
                this.relativeCost = costText ? Number(costText.slice(costText.indexOf("relativeCost ") + 13)) : null;
            }
        }
    };
    var SOSLExecuteBeginLine = class extends DurationLogEvent {
        constructor(parser, parts) {
            super(parser, parts, ["SOSL_EXECUTE_END"], LOG_CATEGORY.SOQL, "free");
            this.debugCategory = DEBUG_CATEGORY.Database;
            this.debugLevel = LOG_LEVEL.Info;
            this.soslCount = {
                self: 1,
                total: 1
            };
            this.lineNumber = this.parseLineNumber(parts[2]);
            this.text = `SOSL: ${parts[3]}`;
        }
        onEnd(end, _stack) {
            this.soslRowCount.total = this.soslRowCount.self = end.soslRowCount.total;
        }
    };
    var SOSLExecuteEndLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Info;
            this.debugCategory = DEBUG_CATEGORY.Database;
            this.isExit = true;
            this.lineNumber = this.parseLineNumber(parts[2]);
            this.soslRowCount.total = this.soslRowCount.self = parseRows(parts[3] || "");
        }
    };
    var HeapAllocateLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Finer;
            this.debugCategory = DEBUG_CATEGORY.ApexCode;
            this.lineNumber = this.parseLineNumber(parts[2]);
            this.text = parts[3] || "";
        }
    };
    var HeapDeallocateLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Finer;
            this.debugCategory = DEBUG_CATEGORY.ApexCode;
            this.lineNumber = this.parseLineNumber(parts[2]);
        }
    };
    var StatementExecuteLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Finer;
            this.debugCategory = DEBUG_CATEGORY.ApexCode;
            this.lineNumber = this.parseLineNumber(parts[2]);
        }
    };
    var VariableScopeBeginLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Finest;
            this.debugCategory = DEBUG_CATEGORY.ApexCode;
            this.lineNumber = this.parseLineNumber(parts[2]);
            this.text = parts.slice(3).join(" | ");
        }
    };
    var VariableAssignmentLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Finest;
            this.debugCategory = DEBUG_CATEGORY.ApexCode;
            this.lineNumber = this.parseLineNumber(parts[2]);
            this.text = parts.slice(3).join(" | ");
        }
    };
    var UserInfoLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Error;
            this.debugCategory = DEBUG_CATEGORY.ApexCode;
            this.lineNumber = this.parseLineNumber(parts[2]);
            this.text = parts[3] + " " + parts[4];
        }
    };
    var UserDebugLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Debug;
            this.debugCategory = DEBUG_CATEGORY.ApexCode;
            this.acceptsText = true;
            this.lineNumber = this.parseLineNumber(parts[2]);
            this.text = parts.slice(3).join(" | ");
        }
    };
    var CumulativeLimitUsageLine = class extends DurationLogEvent {
        constructor(parser, parts) {
            super(parser, parts, ["CUMULATIVE_LIMIT_USAGE_END"], LOG_CATEGORY.System, "system");
            this.debugCategory = DEBUG_CATEGORY.ApexProfiling;
            this.debugLevel = LOG_LEVEL.Info;
            this.namespace = "default";
        }
    };
    var CumulativeProfilingLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Fine;
            this.debugCategory = DEBUG_CATEGORY.ApexProfiling;
            this.acceptsText = true;
            this.namespace = "default";
            this.text = parts[2] + " " + (parts[3] ?? "");
        }
    };
    var CumulativeProfilingBeginLine = class extends DurationLogEvent {
        constructor(parser, parts) {
            super(parser, parts, ["CUMULATIVE_PROFILING_END"], LOG_CATEGORY.System, "custom");
            this.debugCategory = DEBUG_CATEGORY.ApexProfiling;
            this.debugLevel = LOG_LEVEL.Fine;
            this.namespace = "default";
        }
    };
    var LimitUsageLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.ApexProfiling;
            this.debugLevel = LOG_LEVEL.Finest;
            this.namespace = "default";
            this.lineNumber = this.parseLineNumber(parts[2]);
            this.text = parts[3] + " " + parts[4] + " out of " + parts[5];
        }
    };
    var LimitUsageForNSLine = class LimitUsageForNSLine extends LogEvent {
        static {
            this.limitsKeys = new Map([
                ["Number of SOQL queries", "soqlQueries"],
                ["Number of query rows", "queryRows"],
                ["Number of SOSL queries", "soslQueries"],
                ["Number of DML statements", "dmlStatements"],
                ["Number of Publish Immediate DML", "publishImmediateDml"],
                ["Number of DML rows", "dmlRows"],
                ["Maximum CPU time", "cpuTime"],
                ["Maximum heap size", "heapSize"],
                ["Number of callouts", "callouts"],
                ["Number of Email Invocations", "emailInvocations"],
                ["Number of future calls", "futureCalls"],
                ["Number of queueable jobs added to the queue", "queueableJobsAddedToQueue"],
                ["Number of Mobile Apex push calls", "mobileApexPushCalls"]
            ]);
        }
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.ApexProfiling;
            this.debugLevel = LOG_LEVEL.Finest;
            this.namespace = "default";
            this.acceptsText = true;
            this.text = parts[2] || "";
        }
        onAfter(parser, _next) {
            this.namespace = this.text.slice(0, this.text.indexOf("\n")).replace(/\(|\)/g, "");
            const cleanedText = this.text.replace(/^\s+/gm, "").replaceAll("******* CLOSE TO LIMIT", "").replaceAll(" out of ", "/");
            this.text = cleanedText;
            const lines = cleanedText.split("\n");
            const limits = {
                soqlQueries: {
                    used: 0,
                    limit: 0
                },
                soslQueries: {
                    used: 0,
                    limit: 0
                },
                queryRows: {
                    used: 0,
                    limit: 0
                },
                dmlStatements: {
                    used: 0,
                    limit: 0
                },
                publishImmediateDml: {
                    used: 0,
                    limit: 0
                },
                dmlRows: {
                    used: 0,
                    limit: 0
                },
                cpuTime: {
                    used: 0,
                    limit: 0
                },
                heapSize: {
                    used: 0,
                    limit: 0
                },
                callouts: {
                    used: 0,
                    limit: 0
                },
                emailInvocations: {
                    used: 0,
                    limit: 0
                },
                futureCalls: {
                    used: 0,
                    limit: 0
                },
                queueableJobsAddedToQueue: {
                    used: 0,
                    limit: 0
                },
                mobileApexPushCalls: {
                    used: 0,
                    limit: 0
                }
            };
            for (const line of lines) {
                const match = line.match(/^(.+?):\s*([\d,]+)\/([\d,]+)/);
                if (match) {
                    const key = LimitUsageForNSLine.limitsKeys.get(match[1].trim());
                    if (key) {
                        const used = parseInt(match[2].replace(/,/g, ""), 10);
                        const limit = parseInt(match[3].replace(/,/g, ""), 10);
                        if (key) limits[key] = {
                            used,
                            limit
                        };
                    }
                }
            }
            parser.governorLimits.byNamespace.set(this.namespace, limits);
            parser.governorLimits.snapshots.push({
                timestamp: this.timestamp,
                namespace: this.namespace,
                limits
            });
        }
    };
    var NBANodeBegin = class extends DurationLogEvent {
        constructor(parser, parts) {
            super(parser, parts, ["NBA_NODE_END"], LOG_CATEGORY.Automation, "method");
            this.debugCategory = DEBUG_CATEGORY.NBA;
            this.debugLevel = LOG_LEVEL.Fine;
            this.text = parts.slice(2).join(" | ");
        }
    };
    var NBANodeDetail = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Fine;
            this.debugCategory = DEBUG_CATEGORY.NBA;
            this.text = parts.slice(2).join(" | ");
        }
    };
    var NBANodeEnd = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Fine;
            this.debugCategory = DEBUG_CATEGORY.NBA;
            this.isExit = true;
            this.text = parts.slice(2).join(" | ");
        }
    };
    var NBANodeError = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Error;
            this.debugCategory = DEBUG_CATEGORY.NBA;
            this.text = parts.slice(2).join(" | ");
        }
    };
    var NBAOfferInvalid = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Fine;
            this.debugCategory = DEBUG_CATEGORY.NBA;
            this.text = parts.slice(2).join(" | ");
        }
    };
    var NBAStrategyBegin = class extends DurationLogEvent {
        constructor(parser, parts) {
            super(parser, parts, ["NBA_STRATEGY_END"], LOG_CATEGORY.Automation, "method");
            this.debugCategory = DEBUG_CATEGORY.NBA;
            this.debugLevel = LOG_LEVEL.Fine;
            this.text = parts.slice(2).join(" | ");
        }
    };
    var NBAStrategyEnd = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Fine;
            this.debugCategory = DEBUG_CATEGORY.NBA;
            this.isExit = true;
            this.text = parts.slice(2).join(" | ");
        }
    };
    var NBAStrategyError = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Error;
            this.debugCategory = DEBUG_CATEGORY.NBA;
            this.text = parts.slice(2).join(" | ");
        }
    };
    var PushTraceFlagsLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Info;
            this.debugCategory = DEBUG_CATEGORY.System;
            this.lineNumber = this.parseLineNumber(parts[2]);
            this.text = parts[4] + ", line:" + this.lineNumber + " - " + parts[5];
        }
    };
    var PopTraceFlagsLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Info;
            this.debugCategory = DEBUG_CATEGORY.System;
            this.lineNumber = this.parseLineNumber(parts[2]);
            this.text = parts[4] + ", line:" + this.lineNumber + " - " + parts[5];
        }
    };
    var QueryMoreBeginLine = class extends DurationLogEvent {
        constructor(parser, parts) {
            super(parser, parts, ["QUERY_MORE_END"], LOG_CATEGORY.SOQL, "custom");
            this.debugCategory = DEBUG_CATEGORY.Database;
            this.debugLevel = LOG_LEVEL.Info;
            this.lineNumber = this.parseLineNumber(parts[2]);
            this.text = `line: ${this.lineNumber}`;
        }
    };
    var QueryMoreEndLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Info;
            this.debugCategory = DEBUG_CATEGORY.Database;
            this.isExit = true;
            this.lineNumber = this.parseLineNumber(parts[2]);
            this.text = `line: ${this.lineNumber}`;
        }
    };
    var QueryMoreIterationsLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Info;
            this.debugCategory = DEBUG_CATEGORY.Database;
            this.lineNumber = this.parseLineNumber(parts[2]);
            this.text = `line: ${this.lineNumber}, iterations:${parts[3]}`;
        }
    };
    var SavepointRollbackLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Info;
            this.debugCategory = DEBUG_CATEGORY.Database;
            this.lineNumber = this.parseLineNumber(parts[2]);
            this.text = `${parts[3]}, line: ${this.lineNumber}`;
        }
    };
    var SavePointSetLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Info;
            this.debugCategory = DEBUG_CATEGORY.Database;
            this.lineNumber = this.parseLineNumber(parts[2]);
            this.text = `${parts[3]}, line: ${this.lineNumber}`;
        }
    };
    var TotalEmailRecipientsQueuedLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Fine;
            this.debugCategory = DEBUG_CATEGORY.ApexProfiling;
            this.text = parts[2] || "";
        }
    };
    var StackFrameVariableListLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Fine;
            this.debugCategory = DEBUG_CATEGORY.ApexProfiling;
            this.acceptsText = true;
        }
    };
    var StaticVariableListLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Fine;
            this.debugCategory = DEBUG_CATEGORY.ApexProfiling;
            this.acceptsText = true;
        }
    };
    var SystemModeEnterLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Info;
            this.debugCategory = DEBUG_CATEGORY.System;
            this.text = parts[2] || "";
        }
    };
    var SystemModeExitLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Info;
            this.debugCategory = DEBUG_CATEGORY.System;
            this.text = parts[2] || "";
        }
    };
    var ExecutionStartedLine = class extends DurationLogEvent {
        constructor(parser, parts) {
            super(parser, parts, ["EXECUTION_FINISHED"], LOG_CATEGORY.Apex, "method");
            this.debugCategory = DEBUG_CATEGORY.ApexCode;
            this.debugLevel = LOG_LEVEL.Error;
            this.namespace = "default";
        }
    };
    var EnteringManagedPackageLine = class extends DurationLogEvent {
        constructor(parser, parts) {
            super(parser, parts, [], LOG_CATEGORY.Apex, "pkg");
            this.debugCategory = DEBUG_CATEGORY.ApexCode;
            this.debugLevel = LOG_LEVEL.Fine;
            const rawNs = parts[2] || "";
            const lastDot = rawNs.lastIndexOf(".");
            this.text = this.namespace = lastDot < 0 ? rawNs : rawNs.substring(lastDot + 1);
        }
        onAfter(parser, end) {
            if (end) this.exitStamp = end.timestamp;
        }
    };
    var EventSericePubBeginLine = class extends DurationLogEvent {
        constructor(parser, parts) {
            super(parser, parts, ["EVENT_SERVICE_PUB_END"], LOG_CATEGORY.Automation, "custom");
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Info;
            this.text = parts[2] || "";
        }
    };
    var EventSericePubEndLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Info;
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.isExit = true;
            this.text = parts[2] || "";
        }
    };
    var EventSericePubDetailLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Finer;
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.text = parts[2] + " " + parts[3] + " " + parts[4];
        }
    };
    var EventSericeSubBeginLine = class extends DurationLogEvent {
        constructor(parser, parts) {
            super(parser, parts, ["EVENT_SERVICE_SUB_END"], LOG_CATEGORY.Automation, "custom");
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Info;
            this.text = `${parts[2]} ${parts[3]}`;
        }
    };
    var EventSericeSubEndLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Info;
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.isExit = true;
            this.text = `${parts[2]} ${parts[3]}`;
        }
    };
    var EventSericeSubDetailLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Finer;
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.text = `${parts[2]} ${parts[3]} ${parts[4]} ${parts[6]} ${parts[6]}`;
        }
    };
    var FlowStartInterviewsBeginLine = class extends DurationLogEvent {
        constructor(parser, parts) {
            super(parser, parts, ["FLOW_START_INTERVIEWS_END"], LOG_CATEGORY.Automation, "custom");
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Info;
            this.text = "FLOW_START_INTERVIEWS : ";
        }
        onEnd(end, stack) {
            this.suffix = ` (${this.getFlowType(stack)})`;
            this.text += this.getFlowName();
        }
        getFlowType(stack) {
            let flowType;
            const len = stack.length - 2;
            for (let i = len; i >= 0; i--) {
                const elem = stack[i];
                if (elem instanceof CodeUnitStartedLine) {
                    flowType = elem.codeUnitType === "Flow" ? "Flow" : "Process Builder";
                    break;
                } else if (elem && elem.type === "FLOW_START_INTERVIEWS_BEGIN") {
                    flowType = "Flow";
                    break;
                }
            }
            return flowType || "";
        }
        getFlowName() {
            if (this.children.length) return this.children[0]?.text || "";
            return "";
        }
    };
    var FlowStartInterviewsErrorLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Error;
            this.acceptsText = true;
            this.text = `${parts[2]} - ${parts[4]}`;
        }
    };
    var FlowStartInterviewBeginLine = class extends DurationLogEvent {
        constructor(parser, parts) {
            super(parser, parts, ["FLOW_START_INTERVIEW_END"], LOG_CATEGORY.Automation, "custom");
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Info;
            this.text = parts[3] || "";
        }
    };
    var FlowStartInterviewLimitUsageLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Finer;
            this.text = parts[2] || "";
        }
    };
    var FlowStartScheduledRecordsLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Info;
            this.text = `${parts[2]} : ${parts[3]}`;
        }
    };
    var FlowCreateInterviewErrorLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Error;
            this.text = `${parts[2]} : ${parts[3]} : ${parts[4]} : ${parts[5]}`;
        }
    };
    var FlowElementBeginLine = class extends DurationLogEvent {
        constructor(parser, parts) {
            super(parser, parts, ["FLOW_ELEMENT_END"], LOG_CATEGORY.Automation, "custom");
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Fine;
            this.text = parts[3] + " " + parts[4];
        }
    };
    var FlowElementDeferredLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Fine;
            this.text = parts[2] + " " + parts[3];
        }
    };
    var FlowElementAssignmentLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Finer;
            this.acceptsText = true;
            this.text = parts[3] + " " + parts[4];
        }
    };
    var FlowWaitEventResumingDetailLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Finer;
            this.text = `${parts[2]} : ${parts[3]} : ${parts[4]} : ${parts[5]}`;
        }
    };
    var FlowWaitEventWaitingDetailLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Finer;
            this.text = `${parts[2]} : ${parts[3]} : ${parts[4]} : ${parts[5]} : ${parts[6]}`;
        }
    };
    var FlowWaitResumingDetailLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Finer;
            this.text = `${parts[2]} : ${parts[3]} : ${parts[4]}`;
        }
    };
    var FlowWaitWaitingDetailLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Finer;
            this.text = `${parts[2]} : ${parts[3]} : ${parts[4]} : ${parts[5]}`;
        }
    };
    var FlowInterviewFinishedLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Info;
            this.text = parts[3] || "";
        }
    };
    var FlowInterviewResumedLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Info;
            this.text = `${parts[2]} : ${parts[3]}`;
        }
    };
    var FlowInterviewPausedLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Info;
            this.text = `${parts[2]} : ${parts[3]} : ${parts[4]}`;
        }
    };
    var FlowElementErrorLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Error;
            this.acceptsText = true;
            this.text = parts[1] || "" + parts[2] + " " + parts[3] + " " + parts[4];
        }
    };
    var FlowElementFaultLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Warn;
            this.text = `${parts[2]} : ${parts[3]} : ${parts[4]}`;
        }
    };
    var FlowElementLimitUsageLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Finer;
            this.text = `${parts[2]}`;
        }
    };
    var FlowInterviewFinishedLimitUsageLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Finer;
            this.text = `${parts[2]}`;
        }
    };
    var FlowSubflowDetailLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Finer;
            this.text = `${parts[2]} : ${parts[3]} : ${parts[4]} : ${parts[5]}`;
        }
    };
    var FlowActionCallDetailLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Finer;
            this.text = parts[3] + " : " + parts[4] + " : " + parts[5] + " : " + parts[6];
        }
    };
    var FlowAssignmentDetailLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Finer;
            this.text = parts[3] + " : " + parts[4] + " : " + parts[5];
        }
    };
    var FlowLoopDetailLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Finer;
            this.text = parts[3] + " : " + parts[4];
        }
    };
    var FlowRuleDetailLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Finer;
            this.text = parts[3] + " : " + parts[4];
        }
    };
    var FlowBulkElementBeginLine = class extends DurationLogEvent {
        constructor(parser, parts) {
            super(parser, parts, ["FLOW_BULK_ELEMENT_END"], LOG_CATEGORY.Automation, "custom");
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Fine;
            this.text = `${parts[2]} - ${parts[3]}`;
        }
    };
    var FlowBulkElementDetailLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Finer;
            this.text = parts[2] + " : " + parts[3] + " : " + parts[4];
        }
    };
    var FlowBulkElementNotSupportedLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Info;
            this.text = `${parts[2]} : ${parts[3]} : ${parts[4]}`;
        }
    };
    var FlowBulkElementLimitUsageLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Finer;
            this.text = parts[2] || "";
        }
    };
    var PNInvalidAppLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Error;
            this.debugCategory = DEBUG_CATEGORY.ApexCode;
            this.text = `${parts[2]}.${parts[3]}`;
        }
    };
    var PNInvalidCertificateLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Error;
            this.debugCategory = DEBUG_CATEGORY.ApexCode;
            this.text = `${parts[2]}.${parts[3]}`;
        }
    };
    var PNInvalidNotificationLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Error;
            this.debugCategory = DEBUG_CATEGORY.ApexCode;
            this.text = `${parts[2]}.${parts[3]} : ${parts[4]} : ${parts[5]} : ${parts[6]} : ${parts[7]} : ${parts[8]}`;
        }
    };
    var PNNoDevicesLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Debug;
            this.debugCategory = DEBUG_CATEGORY.ApexCode;
            this.text = `${parts[2]}.${parts[3]}`;
        }
    };
    var PNSentLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Debug;
            this.debugCategory = DEBUG_CATEGORY.ApexCode;
            this.text = `${parts[2]}.${parts[3]} : ${parts[4]} : ${parts[5]} : ${parts[6]} : ${parts[7]}`;
        }
    };
    var SLAEndLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Info;
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.text = `${parts[2]} : ${parts[3]} : ${parts[4]} : ${parts[5]} : ${parts[6]}`;
        }
    };
    var SLAEvalMilestoneLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Info;
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.text = `${parts[2]}`;
        }
    };
    var SLAProcessCaseLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Info;
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.text = `${parts[2]}`;
        }
    };
    var TestingLimitsLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.ApexProfiling;
            this.debugLevel = LOG_LEVEL.Info;
            this.acceptsText = true;
        }
    };
    var ValidationRuleLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.Validation;
            this.debugLevel = LOG_LEVEL.Info;
            this.text = parts[3] || "";
        }
    };
    var ValidationErrorLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.Validation;
            this.debugLevel = LOG_LEVEL.Info;
            this.acceptsText = true;
            this.text = parts[2] || "";
        }
    };
    var ValidationFormulaLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.Validation;
            this.debugLevel = LOG_LEVEL.Info;
            this.acceptsText = true;
            const extra = parts.length > 3 ? " " + parts[3] : "";
            this.text = parts[2] + extra;
        }
    };
    var ValidationPassLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.Validation;
            this.debugLevel = LOG_LEVEL.Info;
            this.text = parts[3] || "";
        }
    };
    var WFFlowActionErrorLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Error;
            this.acceptsText = true;
            this.text = parts[1] + " " + parts[4];
        }
    };
    var WFFlowActionErrorDetailLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Error;
            this.acceptsText = true;
            this.text = parts[1] + " " + parts[2];
        }
    };
    var WFFieldUpdateLine = class extends DurationLogEvent {
        constructor(parser, parts) {
            super(parser, parts, ["WF_FIELD_UPDATE"], LOG_CATEGORY.Automation, "custom");
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Info;
            this.isExit = true;
            this.nextLineIsExit = true;
            this.text = " " + parts[2] + " " + parts[3] + " " + parts[4] + " " + parts[5] + " " + parts[6];
        }
    };
    var WFRuleEvalBeginLine = class extends DurationLogEvent {
        constructor(parser, parts) {
            super(parser, parts, ["WF_RULE_EVAL_END"], LOG_CATEGORY.Automation, "custom");
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Info;
            this.text = parts[2] || "";
        }
    };
    var WFRuleEvalValueLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Info;
            this.text = parts[2] || "";
        }
    };
    var WFRuleFilterLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Info;
            this.acceptsText = true;
            this.text = parts[2] || "";
        }
    };
    var WFCriteriaBeginLine = class extends DurationLogEvent {
        constructor(parser, parts) {
            super(parser, parts, ["WF_CRITERIA_END", "WF_RULE_NOT_EVALUATED"], LOG_CATEGORY.Automation, "custom");
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Info;
            this.text = "WF_CRITERIA : " + parts[5] + " : " + parts[3];
        }
    };
    var WFFormulaLine = class extends DurationLogEvent {
        constructor(parser, parts) {
            super(parser, parts, ["WF_FORMULA"], LOG_CATEGORY.Automation, "custom");
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Info;
            this.acceptsText = true;
            this.isExit = true;
            this.nextLineIsExit = true;
            this.text = parts[2] + " : " + parts[3];
        }
    };
    var WFActionLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Info;
            this.text = parts[2] || "";
        }
    };
    var WFActionsEndLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Info;
            this.text = parts[2] || "";
        }
    };
    var WFActionTaskLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Info;
            this.text = `${parts[2]} : ${parts[3]} : ${parts[4]} : ${parts[5]} : ${parts[6]} : ${parts[7]}`;
        }
    };
    var WFApprovalLine = class extends DurationLogEvent {
        constructor(parser, parts) {
            super(parser, parts, ["WF_APPROVAL"], LOG_CATEGORY.Automation, "custom");
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Info;
            this.isExit = true;
            this.nextLineIsExit = true;
            this.text = `${parts[2]} : ${parts[3]} : ${parts[4]}`;
        }
    };
    var WFApprovalRemoveLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Info;
            this.text = `${parts[2]}`;
        }
    };
    var WFApprovalSubmitLine = class extends DurationLogEvent {
        constructor(parser, parts) {
            super(parser, parts, ["WF_APPROVAL_SUBMIT"], LOG_CATEGORY.Automation, "custom");
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Info;
            this.isExit = true;
            this.nextLineIsExit = true;
            this.text = `${parts[2]}`;
        }
    };
    var WFApprovalSubmitterLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Info;
            this.text = `${parts[2]} : ${parts[3]} : ${parts[4]}`;
        }
    };
    var WFAssignLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Info;
            this.text = `${parts[2]} : ${parts[3]}`;
        }
    };
    var WFEmailAlertLine = class extends DurationLogEvent {
        constructor(parser, parts) {
            super(parser, parts, ["WF_EMAIL_ALERT"], LOG_CATEGORY.Automation, "custom");
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Info;
            this.isExit = true;
            this.nextLineIsExit = true;
            this.text = `${parts[2]} : ${parts[3]} : ${parts[4]}`;
        }
    };
    var WFEmailSentLine = class extends DurationLogEvent {
        constructor(parser, parts) {
            super(parser, parts, ["WF_EMAIL_SENT"], LOG_CATEGORY.Automation, "custom");
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Info;
            this.isExit = true;
            this.nextLineIsExit = true;
            this.text = `${parts[2]} : ${parts[3]} : ${parts[4]}`;
        }
    };
    var WFEnqueueActionsLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Info;
            this.text = parts[2] || "";
        }
    };
    var WFEscalationActionLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Info;
            this.text = `${parts[2]} : ${parts[3]}`;
        }
    };
    var WFEvalEntryCriteriaLine = class extends DurationLogEvent {
        constructor(parser, parts) {
            super(parser, parts, ["WF_EVAL_ENTRY_CRITERIA"], LOG_CATEGORY.Automation, "custom");
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Info;
            this.isExit = true;
            this.nextLineIsExit = true;
            this.text = `${parts[2]} : ${parts[3]} : ${parts[4]}`;
        }
    };
    var WFFlowActionDetailLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Fine;
            const optional = parts[4] ? ` : ${parts[4]} :${parts[5]}` : "";
            this.text = `${parts[2]} : ${parts[3]}` + optional;
        }
    };
    var WFNextApproverLine = class extends DurationLogEvent {
        constructor(parser, parts) {
            super(parser, parts, ["WF_NEXT_APPROVER"], LOG_CATEGORY.Automation, "custom");
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Info;
            this.isExit = true;
            this.nextLineIsExit = true;
            this.text = `${parts[2]} : ${parts[3]} : ${parts[4]}`;
        }
    };
    var WFOutboundMsgLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Info;
            this.text = `${parts[2]} : ${parts[3]} : ${parts[4]} : ${parts[5]}`;
        }
    };
    var WFProcessFoundLine = class extends DurationLogEvent {
        constructor(parser, parts) {
            super(parser, parts, ["WF_PROCESS_FOUND"], LOG_CATEGORY.Automation, "custom");
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Info;
            this.isExit = true;
            this.nextLineIsExit = true;
            this.text = `${parts[2]} : ${parts[3]}`;
        }
    };
    var WFProcessNode = class extends DurationLogEvent {
        constructor(parser, parts) {
            super(parser, parts, ["WF_PROCESS_NODE"], LOG_CATEGORY.Automation, "custom");
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Info;
            this.isExit = true;
            this.nextLineIsExit = true;
            this.text = parts[2] || "";
        }
    };
    var WFReassignRecordLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Info;
            this.text = `${parts[2]} : ${parts[3]}`;
        }
    };
    var WFResponseNotifyLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Info;
            this.text = `${parts[2]} : ${parts[3]} : ${parts[4]} : ${parts[5]}`;
        }
    };
    var WFRuleEntryOrderLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Info;
            this.text = parts[2] || "";
        }
    };
    var WFRuleInvocationLine = class extends DurationLogEvent {
        constructor(parser, parts) {
            super(parser, parts, ["WF_RULE_INVOCATION"], LOG_CATEGORY.Automation, "custom");
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Info;
            this.isExit = true;
            this.nextLineIsExit = true;
            this.text = parts[2] || "";
        }
    };
    var WFSoftRejectLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Info;
            this.text = parts[2] || "";
        }
    };
    var WFTimeTriggerLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Info;
            this.text = `${parts[2]} : ${parts[3]} : ${parts[4]} : ${parts[5]}`;
        }
    };
    var WFSpoolActionBeginLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugCategory = DEBUG_CATEGORY.Workflow;
            this.debugLevel = LOG_LEVEL.Info;
            this.text = parts[2] || "";
        }
    };
    var ExceptionThrownLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Info;
            this.debugCategory = DEBUG_CATEGORY.ApexCode;
            this.discontinuity = true;
            this.acceptsText = true;
            this.totalThrownCount = 1;
            this.lineNumber = this.parseLineNumber(parts[2]);
            this.text = parts[3] || "";
        }
        onAfter(parser, _next) {
            if (this.text.indexOf("System.LimitException") >= 0) {
                const isMultiLine = this.text.indexOf("\n");
                const len = isMultiLine < 0 ? 99 : isMultiLine;
                const truncateText = this.text.length > len;
                const summary = this.text.slice(0, len + 1) + (truncateText ? "…" : "");
                const message = truncateText ? this.text : "";
                parser.addLogIssue(this.timestamp, summary, message, "error");
            }
        }
    };
    var FatalErrorLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Error;
            this.debugCategory = DEBUG_CATEGORY.ApexCode;
            this.acceptsText = true;
            this.discontinuity = true;
            this.text = parts[2] || "";
        }
        onAfter(parser, _next) {
            const newLineIndex = this.text.indexOf("\n");
            const summary = newLineIndex > -1 ? this.text.slice(0, newLineIndex + 1) : this.text;
            const detailText = summary.length !== this.text.length ? this.text : "";
            parser.addLogIssue(this.timestamp, "FATAL ERROR! cause=" + summary, detailText, "error");
        }
    };
    var XDSDetailLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Finer;
            this.debugCategory = DEBUG_CATEGORY.Callout;
            this.text = parts[2] || "";
        }
    };
    var XDSResponseLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Info;
            this.debugCategory = DEBUG_CATEGORY.Callout;
            this.text = `${parts[2]} : ${parts[3]} : ${parts[4]} : ${parts[5]} : ${parts[6]}`;
        }
    };
    var XDSResponseDetailLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Finer;
            this.debugCategory = DEBUG_CATEGORY.Callout;
            this.text = parts[2] || "";
        }
    };
    var XDSResponseErrorLine = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Error;
            this.debugCategory = DEBUG_CATEGORY.Callout;
            this.text = parts[2] || "";
        }
    };
    var DuplicateDetectionBegin = class extends DurationLogEvent {
        constructor(parser, parts) {
            super(parser, parts, ["DUPLICATE_DETECTION_END"], LOG_CATEGORY.System, "custom");
            this.debugCategory = DEBUG_CATEGORY.System;
            this.debugLevel = LOG_LEVEL.Info;
        }
    };
    var DuplicateDetectionRule = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Info;
            this.debugCategory = DEBUG_CATEGORY.System;
            this.text = `${parts[3]} - ${parts[4]}`;
        }
    };
    /**
    * NOTE: These can be found in the org on the create new debug level page but are not found in the docs here
    * https://help.salesforce.com/s/articleView?id=sf.code_setting_debug_log_levels.htm
    */
    var BulkDMLEntry = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Info;
            this.debugCategory = DEBUG_CATEGORY.Database;
            this.text = parts[2] || "";
        }
    };
    /**
    * DUPLICATE_DETECTION_MATCH_INVOCATION_DETAILS|EntityType:Account|ActionTaken:Allow_[Alert,Report]|DuplicateRecordIds:
    */
    var DuplicateDetectionDetails = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Debug;
            this.debugCategory = DEBUG_CATEGORY.System;
            this.text = parts.slice(2).join(" | ");
        }
    };
    /**
    * DUPLICATE_DETECTION_MATCH_INVOCATION_SUMMARY|EntityType:Account|NumRecordsToBeSaved:200|NumRecordsToBeSavedWithDuplicates:0|NumDuplicateRecordsFound:0
    */
    var DuplicateDetectionSummary = class extends LogEvent {
        constructor(parser, parts) {
            super(parser, parts);
            this.debugLevel = LOG_LEVEL.Info;
            this.debugCategory = DEBUG_CATEGORY.System;
            this.text = parts.slice(2).join(" | ");
        }
    };
    var SessionCachePutBegin = class extends DurationLogEvent {
        constructor(parser, parts) {
            super(parser, parts, ["SESSION_CACHE_PUT_END"], LOG_CATEGORY.Apex, "method");
            this.debugCategory = DEBUG_CATEGORY.ApexCode;
            this.debugLevel = LOG_LEVEL.Info;
        }
    };
    var SessionCacheGetBegin = class extends DurationLogEvent {
        constructor(parser, parts) {
            super(parser, parts, ["SESSION_CACHE_GET_END"], LOG_CATEGORY.Apex, "method");
            this.debugCategory = DEBUG_CATEGORY.ApexCode;
            this.debugLevel = LOG_LEVEL.Info;
        }
    };
    var SessionCacheRemoveBegin = class extends DurationLogEvent {
        constructor(parser, parts) {
            super(parser, parts, ["SESSION_CACHE_REMOVE_END"], LOG_CATEGORY.Apex, "method");
            this.debugCategory = DEBUG_CATEGORY.ApexCode;
            this.debugLevel = LOG_LEVEL.Info;
        }
    };
    var OrgCachePutBegin = class extends DurationLogEvent {
        constructor(parser, parts) {
            super(parser, parts, ["ORG_CACHE_PUT_END"], LOG_CATEGORY.Apex, "method");
            this.debugCategory = DEBUG_CATEGORY.ApexCode;
            this.debugLevel = LOG_LEVEL.Info;
        }
    };
    var OrgCacheGetBegin = class extends DurationLogEvent {
        constructor(parser, parts) {
            super(parser, parts, ["ORG_CACHE_GET_END"], LOG_CATEGORY.Apex, "method");
            this.debugCategory = DEBUG_CATEGORY.ApexCode;
            this.debugLevel = LOG_LEVEL.Info;
        }
    };
    var OrgCacheRemoveBegin = class extends DurationLogEvent {
        constructor(parser, parts) {
            super(parser, parts, ["ORG_CACHE_REMOVE_END"], LOG_CATEGORY.Apex, "method");
            this.debugCategory = DEBUG_CATEGORY.ApexCode;
            this.debugLevel = LOG_LEVEL.Info;
        }
    };
    var VFSerializeContinuationStateBegin = class extends DurationLogEvent {
        constructor(parser, parts) {
            super(parser, parts, ["VF_SERIALIZE_CONTINUATION_STATE_END"], LOG_CATEGORY.Apex, "method");
            this.debugCategory = DEBUG_CATEGORY.Visualforce;
            this.debugLevel = LOG_LEVEL.Info;
        }
    };
    var VFDeserializeContinuationStateBegin = class extends DurationLogEvent {
        constructor(parser, parts) {
            super(parser, parts, ["VF_SERIALIZE_CONTINUATION_STATE_END"], LOG_CATEGORY.Apex, "method");
            this.debugCategory = DEBUG_CATEGORY.Visualforce;
            this.debugLevel = LOG_LEVEL.Info;
        }
    };
    var MatchEngineBegin = class extends DurationLogEvent {
        constructor(parser, parts) {
            super(parser, parts, ["MATCH_ENGINE_END"], LOG_CATEGORY.System, "method");
            this.debugCategory = DEBUG_CATEGORY.System;
            this.debugLevel = LOG_LEVEL.Info;
        }
    };
    var CursorCreateBegin = class extends DurationLogEvent {
        constructor(parser, parts) {
            super(parser, parts, ["CURSOR_CREATE_END"], LOG_CATEGORY.SOQL, "method");
            this.debugCategory = DEBUG_CATEGORY.Database;
            this.debugLevel = LOG_LEVEL.Info;
        }
    };
    var FormulaEvaluateBegin = class extends DurationLogEvent {
        constructor(parser, parts) {
            super(parser, parts, ["FORMULA_EVALUATE_END"], LOG_CATEGORY.Apex, "method");
            this.debugCategory = DEBUG_CATEGORY.ApexCode;
            this.debugLevel = LOG_LEVEL.Finer;
        }
    };
    var RlmConfiguratorBegin = class extends DurationLogEvent {
        constructor(parser, parts) {
            super(parser, parts, ["RLM_CONFIGURATOR_END"], LOG_CATEGORY.System, "method");
            this.debugCategory = DEBUG_CATEGORY.System;
            this.debugLevel = LOG_LEVEL.Fine;
        }
    };
    var RlmPricingBegin = class extends DurationLogEvent {
        constructor(parser, parts) {
            super(parser, parts, ["RLM_PRICING_END"], LOG_CATEGORY.System, "method");
            this.debugCategory = DEBUG_CATEGORY.System;
            this.debugLevel = LOG_LEVEL.Fine;
        }
    };

    //#endregion
    //#region apex-log-parser/src/LogLineMapping.ts
    function getLogEventClass(eventName) {
        if (!eventName) return null;
        switch (eventName) {
            case "METHOD_ENTRY": return MethodEntryLine;
            case "METHOD_EXIT": return MethodExitLine;
            case "CONSTRUCTOR_ENTRY": return ConstructorEntryLine;
            case "CONSTRUCTOR_EXIT": return ConstructorExitLine;
            default: break;
        }
        const logType = lineTypeMap.get(eventName);
        if (logType) return logType;
        else if (basicLogEvents.has(eventName)) return BasicLogLine;
        else if (basicExitLogEvents.has(eventName)) return BasicExitLine;
        return null;
    }
    const lineTypeMap = new Map([
        ["BULK_DML_RETRY", BulkDMLEntry],
        ["BULK_HEAP_ALLOCATE", BulkHeapAllocateLine],
        ["CALLOUT_REQUEST", CalloutRequestLine],
        ["CALLOUT_RESPONSE", CalloutResponseLine],
        ["NAMED_CREDENTIAL_REQUEST", NamedCredentialRequestLine],
        ["NAMED_CREDENTIAL_RESPONSE", NamedCredentialResponseLine],
        ["NAMED_CREDENTIAL_RESPONSE_DETAIL", NamedCredentialResponseDetailLine],
        ["CONSTRUCTOR_ENTRY", ConstructorEntryLine],
        ["CONSTRUCTOR_EXIT", ConstructorExitLine],
        ["EMAIL_QUEUE", EmailQueueLine],
        ["METHOD_ENTRY", MethodEntryLine],
        ["METHOD_EXIT", MethodExitLine],
        ["SYSTEM_CONSTRUCTOR_ENTRY", SystemConstructorEntryLine],
        ["SYSTEM_CONSTRUCTOR_EXIT", SystemConstructorExitLine],
        ["SYSTEM_METHOD_ENTRY", SystemMethodEntryLine],
        ["SYSTEM_METHOD_EXIT", SystemMethodExitLine],
        ["CODE_UNIT_STARTED", CodeUnitStartedLine],
        ["CODE_UNIT_FINISHED", CodeUnitFinishedLine],
        ["VF_APEX_CALL_START", VFApexCallStartLine],
        ["VF_APEX_CALL_END", VFApexCallEndLine],
        ["VF_DESERIALIZE_VIEWSTATE_BEGIN", VFDeserializeViewstateBeginLine],
        ["VF_EVALUATE_FORMULA_BEGIN", VFFormulaStartLine],
        ["VF_EVALUATE_FORMULA_END", VFFormulaEndLine],
        ["VF_SERIALIZE_CONTINUATION_STATE_BEGIN", VFSerializeContinuationStateBegin],
        ["VF_DESERIALIZE_CONTINUATION_STATE_BEGIN", VFDeserializeContinuationStateBegin],
        ["VF_SERIALIZE_VIEWSTATE_BEGIN", VFSeralizeViewStateStartLine],
        ["VF_PAGE_MESSAGE", VFPageMessageLine],
        ["DML_BEGIN", DMLBeginLine],
        ["DML_END", DMLEndLine],
        ["IDEAS_QUERY_EXECUTE", IdeasQueryExecuteLine],
        ["SOQL_EXECUTE_BEGIN", SOQLExecuteBeginLine],
        ["SOQL_EXECUTE_END", SOQLExecuteEndLine],
        ["SOQL_EXECUTE_EXPLAIN", SOQLExecuteExplainLine],
        ["SOSL_EXECUTE_BEGIN", SOSLExecuteBeginLine],
        ["SOSL_EXECUTE_END", SOSLExecuteEndLine],
        ["HEAP_ALLOCATE", HeapAllocateLine],
        ["HEAP_DEALLOCATE", HeapDeallocateLine],
        ["STATEMENT_EXECUTE", StatementExecuteLine],
        ["VARIABLE_SCOPE_BEGIN", VariableScopeBeginLine],
        ["VARIABLE_ASSIGNMENT", VariableAssignmentLine],
        ["USER_INFO", UserInfoLine],
        ["USER_DEBUG", UserDebugLine],
        ["CUMULATIVE_LIMIT_USAGE", CumulativeLimitUsageLine],
        ["CUMULATIVE_PROFILING", CumulativeProfilingLine],
        ["CUMULATIVE_PROFILING_BEGIN", CumulativeProfilingBeginLine],
        ["LIMIT_USAGE", LimitUsageLine],
        ["LIMIT_USAGE_FOR_NS", LimitUsageForNSLine],
        ["NBA_NODE_BEGIN", NBANodeBegin],
        ["NBA_NODE_DETAIL", NBANodeDetail],
        ["NBA_NODE_END", NBANodeEnd],
        ["NBA_NODE_ERROR", NBANodeError],
        ["NBA_OFFER_INVALID", NBAOfferInvalid],
        ["NBA_STRATEGY_BEGIN", NBAStrategyBegin],
        ["NBA_STRATEGY_END", NBAStrategyEnd],
        ["NBA_STRATEGY_ERROR", NBAStrategyError],
        ["POP_TRACE_FLAGS", PopTraceFlagsLine],
        ["PUSH_TRACE_FLAGS", PushTraceFlagsLine],
        ["QUERY_MORE_BEGIN", QueryMoreBeginLine],
        ["QUERY_MORE_END", QueryMoreEndLine],
        ["QUERY_MORE_ITERATIONS", QueryMoreIterationsLine],
        ["TOTAL_EMAIL_RECIPIENTS_QUEUED", TotalEmailRecipientsQueuedLine],
        ["SAVEPOINT_ROLLBACK", SavepointRollbackLine],
        ["SAVEPOINT_SET", SavePointSetLine],
        ["STACK_FRAME_VARIABLE_LIST", StackFrameVariableListLine],
        ["STATIC_VARIABLE_LIST", StaticVariableListLine],
        ["SYSTEM_MODE_ENTER", SystemModeEnterLine],
        ["SYSTEM_MODE_EXIT", SystemModeExitLine],
        ["EXECUTION_STARTED", ExecutionStartedLine],
        ["ENTERING_MANAGED_PKG", EnteringManagedPackageLine],
        ["EVENT_SERVICE_PUB_BEGIN", EventSericePubBeginLine],
        ["EVENT_SERVICE_PUB_END", EventSericePubEndLine],
        ["EVENT_SERVICE_PUB_DETAIL", EventSericePubDetailLine],
        ["EVENT_SERVICE_SUB_BEGIN", EventSericeSubBeginLine],
        ["EVENT_SERVICE_SUB_DETAIL", EventSericeSubDetailLine],
        ["EVENT_SERVICE_SUB_END", EventSericeSubEndLine],
        ["FLOW_START_INTERVIEWS_BEGIN", FlowStartInterviewsBeginLine],
        ["FLOW_START_INTERVIEWS_ERROR", FlowStartInterviewsErrorLine],
        ["FLOW_START_INTERVIEW_BEGIN", FlowStartInterviewBeginLine],
        ["FLOW_START_INTERVIEW_LIMIT_USAGE", FlowStartInterviewLimitUsageLine],
        ["FLOW_START_SCHEDULED_RECORDS", FlowStartScheduledRecordsLine],
        ["FLOW_CREATE_INTERVIEW_ERROR", FlowCreateInterviewErrorLine],
        ["FLOW_ELEMENT_BEGIN", FlowElementBeginLine],
        ["FLOW_ELEMENT_DEFERRED", FlowElementDeferredLine],
        ["FLOW_ELEMENT_ERROR", FlowElementErrorLine],
        ["FLOW_ELEMENT_FAULT", FlowElementFaultLine],
        ["FLOW_ELEMENT_LIMIT_USAGE", FlowElementLimitUsageLine],
        ["FLOW_INTERVIEW_FINISHED_LIMIT_USAGE", FlowInterviewFinishedLimitUsageLine],
        ["FLOW_SUBFLOW_DETAIL", FlowSubflowDetailLine],
        ["FLOW_VALUE_ASSIGNMENT", FlowElementAssignmentLine],
        ["FLOW_WAIT_EVENT_RESUMING_DETAIL", FlowWaitEventResumingDetailLine],
        ["FLOW_WAIT_EVENT_WAITING_DETAIL", FlowWaitEventWaitingDetailLine],
        ["FLOW_WAIT_RESUMING_DETAIL", FlowWaitResumingDetailLine],
        ["FLOW_WAIT_WAITING_DETAIL", FlowWaitWaitingDetailLine],
        ["FLOW_INTERVIEW_FINISHED", FlowInterviewFinishedLine],
        ["FLOW_INTERVIEW_PAUSED", FlowInterviewPausedLine],
        ["FLOW_INTERVIEW_RESUMED", FlowInterviewResumedLine],
        ["FLOW_ACTIONCALL_DETAIL", FlowActionCallDetailLine],
        ["FLOW_ASSIGNMENT_DETAIL", FlowAssignmentDetailLine],
        ["FLOW_LOOP_DETAIL", FlowLoopDetailLine],
        ["FLOW_RULE_DETAIL", FlowRuleDetailLine],
        ["FLOW_BULK_ELEMENT_BEGIN", FlowBulkElementBeginLine],
        ["FLOW_BULK_ELEMENT_DETAIL", FlowBulkElementDetailLine],
        ["FLOW_BULK_ELEMENT_LIMIT_USAGE", FlowBulkElementLimitUsageLine],
        ["FLOW_BULK_ELEMENT_NOT_SUPPORTED", FlowBulkElementNotSupportedLine],
        ["CURSOR_CREATE_BEGIN", CursorCreateBegin],
        ["FORMULA_EVALUATE_BEGIN", FormulaEvaluateBegin],
        ["MATCH_ENGINE_BEGIN", MatchEngineBegin],
        ["ORG_CACHE_PUT_BEGIN", OrgCachePutBegin],
        ["ORG_CACHE_GET_BEGIN", OrgCacheGetBegin],
        ["ORG_CACHE_REMOVE_BEGIN", OrgCacheRemoveBegin],
        ["PUSH_NOTIFICATION_INVALID_APP", PNInvalidAppLine],
        ["PUSH_NOTIFICATION_INVALID_CERTIFICATE", PNInvalidCertificateLine],
        ["PUSH_NOTIFICATION_INVALID_NOTIFICATION", PNInvalidNotificationLine],
        ["PUSH_NOTIFICATION_NO_DEVICES", PNNoDevicesLine],
        ["PUSH_NOTIFICATION_SENT", PNSentLine],
        ["RLM_CONFIGURATOR_BEGIN", RlmConfiguratorBegin],
        ["RLM_PRICING_BEGIN", RlmPricingBegin],
        ["SESSION_CACHE_PUT_BEGIN", SessionCachePutBegin],
        ["SESSION_CACHE_GET_BEGIN", SessionCacheGetBegin],
        ["SESSION_CACHE_REMOVE_BEGIN", SessionCacheRemoveBegin],
        ["SLA_END", SLAEndLine],
        ["SLA_EVAL_MILESTONE", SLAEvalMilestoneLine],
        ["SLA_PROCESS_CASE", SLAProcessCaseLine],
        ["TESTING_LIMITS", TestingLimitsLine],
        ["VALIDATION_ERROR", ValidationErrorLine],
        ["VALIDATION_FORMULA", ValidationFormulaLine],
        ["VALIDATION_PASS", ValidationPassLine],
        ["VALIDATION_RULE", ValidationRuleLine],
        ["WF_FLOW_ACTION_ERROR", WFFlowActionErrorLine],
        ["WF_FLOW_ACTION_ERROR_DETAIL", WFFlowActionErrorDetailLine],
        ["WF_FIELD_UPDATE", WFFieldUpdateLine],
        ["WF_RULE_EVAL_BEGIN", WFRuleEvalBeginLine],
        ["WF_RULE_EVAL_VALUE", WFRuleEvalValueLine],
        ["WF_RULE_FILTER", WFRuleFilterLine],
        ["WF_CRITERIA_BEGIN", WFCriteriaBeginLine],
        ["WF_FORMULA", WFFormulaLine],
        ["WF_ACTION", WFActionLine],
        ["WF_ACTIONS_END", WFActionsEndLine],
        ["WF_ACTION_TASK", WFActionTaskLine],
        ["WF_APPROVAL", WFApprovalLine],
        ["WF_APPROVAL_REMOVE", WFApprovalRemoveLine],
        ["WF_APPROVAL_SUBMIT", WFApprovalSubmitLine],
        ["WF_APPROVAL_SUBMITTER", WFApprovalSubmitterLine],
        ["WF_ASSIGN", WFAssignLine],
        ["WF_EMAIL_ALERT", WFEmailAlertLine],
        ["WF_EMAIL_SENT", WFEmailSentLine],
        ["WF_ENQUEUE_ACTIONS", WFEnqueueActionsLine],
        ["WF_ESCALATION_ACTION", WFEscalationActionLine],
        ["WF_EVAL_ENTRY_CRITERIA", WFEvalEntryCriteriaLine],
        ["WF_FLOW_ACTION_DETAIL", WFFlowActionDetailLine],
        ["WF_NEXT_APPROVER", WFNextApproverLine],
        ["WF_OUTBOUND_MSG", WFOutboundMsgLine],
        ["WF_PROCESS_FOUND", WFProcessFoundLine],
        ["WF_PROCESS_NODE", WFProcessNode],
        ["WF_REASSIGN_RECORD", WFReassignRecordLine],
        ["WF_RESPONSE_NOTIFY", WFResponseNotifyLine],
        ["WF_RULE_ENTRY_ORDER", WFRuleEntryOrderLine],
        ["WF_RULE_INVOCATION", WFRuleInvocationLine],
        ["WF_SOFT_REJECT", WFSoftRejectLine],
        ["WF_SPOOL_ACTION_BEGIN", WFSpoolActionBeginLine],
        ["WF_TIME_TRIGGER", WFTimeTriggerLine],
        ["EXCEPTION_THROWN", ExceptionThrownLine],
        ["FATAL_ERROR", FatalErrorLine],
        ["XDS_DETAIL", XDSDetailLine],
        ["XDS_RESPONSE", XDSResponseLine],
        ["XDS_RESPONSE_DETAIL", XDSResponseDetailLine],
        ["XDS_RESPONSE_ERROR", XDSResponseErrorLine],
        ["DUPLICATE_DETECTION_BEGIN", DuplicateDetectionBegin],
        ["DUPLICATE_DETECTION_RULE_INVOCATION", DuplicateDetectionRule],
        ["DUPLICATE_DETECTION_MATCH_INVOCATION_DETAILS", DuplicateDetectionDetails],
        ["DUPLICATE_DETECTION_MATCH_INVOCATION_SUMMARY", DuplicateDetectionSummary]
    ]);
    const basicLogEvents = new Set([
        "ADD_SCREEN_POP_ACTION",
        "ADD_SKILL_REQUIREMENT_ACTION",
        "AE_PERSIST_VALIDATION",
        "APP_ANALYTICS_ERROR",
        "APP_ANALYTICS_FINE",
        "APP_ANALYTICS_WARN",
        "APP_CONTAINER_INITIATED",
        "ASSET_DIFF_DETAIL",
        "ASSET_DIFF_SUMMARY",
        "BULK_COUNTABLE_STATEMENT_EXECUTE",
        "CALLOUT_REQUEST_FINALIZE",
        "CALLOUT_REQUEST_PREPARE",
        "CURSOR_FETCH",
        "CURSOR_FETCH_PAGE",
        "DATA_ACCESS_EVALUATION",
        "DATAWEAVE_USER_DEBUG",
        "DUPLICATE_RULE_FILTER",
        "DUPLICATE_RULE_FILTER_INVOCATION",
        "DUPLICATE_RULE_FILTER_RESULT",
        "DUPLICATE_RULE_FILTER_VALUE",
        "END_CALL",
        "EXTERNAL_SERVICE_CALLBACK",
        "EXTERNAL_SERVICE_REQUEST",
        "EXTERNAL_SERVICE_RESPONSE",
        "FLOW_COLLECTION_PROCESSOR_DETAIL",
        "FLOW_CREATE_INTERVIEW_BEGIN",
        "FLOW_CREATE_INTERVIEW_END",
        "FLOW_SCHEDULED_PATH_QUEUED",
        "FLOW_SCREEN_DETAIL",
        "FOR_UPDATE_LOCKS_RELEASE",
        "FORMULA_BUILD",
        "FUNCTION_INVOCATION_REQUEST",
        "FUNCTION_INVOCATION_RESPONSE",
        "HEAP_DUMP",
        "INVOCABLE_ACTION_DETAIL",
        "INVOCABLE_ACTION_ERROR",
        "JSON_DIFF_DETAIL",
        "JSON_DIFF_SUMMARY",
        "MATCH_ENGINE_INVOCATION",
        "ORG_CACHE_CONTAINS",
        "ORG_CACHE_GET",
        "ORG_CACHE_GET_CAPACITY",
        "ORG_CACHE_GET_PARTITION",
        "ORG_CACHE_MEMORY_USAGE",
        "ORG_CACHE_PUT",
        "ORG_CACHE_REMOVE",
        "PLAY_PROMPT",
        "POLICY_RULE_DEFINITION_CONDITION_EVALUATION_RESPONSE",
        "POLICY_RULE_EVALUATION_REQUEST",
        "POLICY_RULE_EVALUATION_RESPONSE",
        "POLICY_RULE_EVALUATION_SKIPPED",
        "POLICY_RULE_EVALUATION_START",
        "PUSH_NOTIFICATION_INVALID_CONFIGURATION",
        "PUSH_NOTIFICATION_INVALID_PAYLOAD",
        "PUSH_NOTIFICATION_NOT_ENABLED",
        "QUERY_SQL_LOG",
        "REFERENCED_OBJECT_LIST",
        "RLM_CONFIGURATOR_DEPLOY",
        "RLM_CONFIGURATOR_STATS",
        "ROUTE_WORK_ACTION",
        "RULES_EXECUTION_DETAIL",
        "RULES_EXECUTION_SUMMARY",
        "SAVEPOINT_RELEASE",
        "SAVEPOINT_RESET",
        "SCHEDULED_FLOW_DETAIL",
        "SCRIPT_EXECUTION",
        "SESSION_CACHE_CONTAINS",
        "SESSION_CACHE_GET",
        "SESSION_CACHE_GET_CAPACITY",
        "SESSION_CACHE_GET_PARTITION",
        "SESSION_CACHE_MEMORY_USAGE",
        "SESSION_CACHE_PUT",
        "SESSION_CACHE_REMOVE",
        "SLA_CASE_MILESTONE",
        "SLA_NULL_START_DATE",
        "TEMPLATE_PROCESSING_ERROR",
        "TEMPLATED_ASSET",
        "TRANSFORMATION_SUMMARY",
        "USER_DEBUG_DEBUG",
        "USER_DEBUG_ERROR",
        "USER_DEBUG_FINE",
        "USER_DEBUG_FINER",
        "USER_DEBUG_FINEST",
        "USER_DEBUG_INFO",
        "USER_DEBUG_WARN",
        "USER_MODE_PERMSET_APPLIED",
        "VALIDATION_FAIL",
        "VARIABLE_SCOPE_END",
        "VF_APEX_CALL",
        "WAVE_APP_LIFECYCLE",
        "WF_APEX_ACTION",
        "WF_CHATTER_POST",
        "WF_ESCALATION_RULE",
        "WF_FLOW_ACTION_BEGIN",
        "WF_FLOW_ACTION_END",
        "WF_HARD_REJECT",
        "WF_KNOWLEDGE_ACTION",
        "WF_NO_PROCESS_FOUND",
        "WF_QUICK_CREATE",
        "WF_SEND_ACTION",
        "WF_TIME_TRIGGERS_BEGIN",
        "XDS_REQUEST_DETAIL"
    ]);
    const basicExitLogEvents = new Set([
        "CUMULATIVE_LIMIT_USAGE_END",
        "CUMULATIVE_PROFILING_END",
        "CURSOR_CREATE_END",
        "DUPLICATE_DETECTION_END",
        "EXECUTION_FINISHED",
        "FLOW_BULK_ELEMENT_END",
        "FLOW_ELEMENT_END",
        "FLOW_START_INTERVIEW_END",
        "FLOW_START_INTERVIEWS_END",
        "FORMULA_EVALUATE_END",
        "MATCH_ENGINE_END",
        "ORG_CACHE_GET_END",
        "ORG_CACHE_PUT_END",
        "ORG_CACHE_REMOVE_END",
        "RLM_CONFIGURATOR_END",
        "RLM_PRICING_END",
        "SESSION_CACHE_GET_END",
        "SESSION_CACHE_PUT_END",
        "SESSION_CACHE_REMOVE_END",
        "VF_DESERIALIZE_CONTINUATION_STATE_END",
        "VF_DESERIALIZE_VIEWSTATE_END",
        "VF_SERIALIZE_CONTINUATION_STATE_END",
        "VF_SERIALIZE_VIEWSTATE_END",
        "WF_CRITERIA_END",
        "WF_RULE_EVAL_END",
        "WF_RULE_NOT_EVALUATED"
    ]);

    //#endregion
    //#region apex-log-parser/src/ApexLogParser.ts
    const typePattern = /^[A-Z_]*$/;
    const settingsPattern = /^\d+\.\d+\sAPEX_CODE,\w+;APEX_PROFILING,.+$/m;
    /**
    * Takes string input of a log and returns the ApexLog class, which represents a log tree
    * @param {string} logData
    * @returns {ApexLog}
    */
    function parse(logData) {
        return new ApexLogParser().parse(logData);
    }
    /**
    * An Apex Log file can be parsed by passing the text.
    * You can either import the ApexLogParser class or import the parse method e.g.
    *
    * import ApexLogParser, { parse } from ./ApexLogParser.js
    * const apexLog = new ApexLogParser().parse(logText);
    * const apexLog = parse(logText);
    */
    var ApexLogParser = class {
        constructor() {
            this.logIssues = [];
            this.parsingErrors = [];
            this.maxSizeTimestamp = null;
            this.reasons = /* @__PURE__ */ new Set();
            this.lastTimestamp = 0;
            this.discontinuity = false;
            this.namespaces = /* @__PURE__ */ new Set();
            this.governorLimits = {
                soqlQueries: {
                    used: 0,
                    limit: 0
                },
                soslQueries: {
                    used: 0,
                    limit: 0
                },
                queryRows: {
                    used: 0,
                    limit: 0
                },
                dmlStatements: {
                    used: 0,
                    limit: 0
                },
                publishImmediateDml: {
                    used: 0,
                    limit: 0
                },
                dmlRows: {
                    used: 0,
                    limit: 0
                },
                cpuTime: {
                    used: 0,
                    limit: 0
                },
                heapSize: {
                    used: 0,
                    limit: 0
                },
                callouts: {
                    used: 0,
                    limit: 0
                },
                emailInvocations: {
                    used: 0,
                    limit: 0
                },
                futureCalls: {
                    used: 0,
                    limit: 0
                },
                queueableJobsAddedToQueue: {
                    used: 0,
                    limit: 0
                },
                mobileApexPushCalls: {
                    used: 0,
                    limit: 0
                },
                byNamespace: /* @__PURE__ */ new Map(),
                snapshots: []
            };
        }
        /**
        * Takes string input of a log and returns the ApexLog class, which represents a log tree
        * @param {string} debugLog
        * @returns {ApexLog}
        */
        parse(debugLog) {
            const lineGenerator = this.generateLogLines(debugLog);
            const apexLog = this.toLogTree(lineGenerator);
            apexLog.size = debugLog.length;
            apexLog.debugLevels = this.getDebugLevels(debugLog);
            apexLog.logIssues = this.logIssues;
            apexLog.parsingErrors = this.parsingErrors;
            apexLog.namespaces = Array.from(this.namespaces);
            apexLog.governorLimits = this.governorLimits;
            this.addGovernorLimits(apexLog);
            return apexLog;
        }
        addGovernorLimits(apexLog) {
            const totalLimits = apexLog.governorLimits;
            if (totalLimits) for (const limitsForNs of apexLog.governorLimits.byNamespace.values()) for (const [key, value] of Object.entries(limitsForNs)) {
                if (!value) continue;
                const currentLimit = totalLimits[key];
                currentLimit.limit = value.limit;
                currentLimit.used += value.used;
            }
        }
        parseLine(line, lastEntry) {
            const parts = line.split("|");
            const type = parts[1] ?? "";
            const metaCtor = getLogEventClass(type);
            if (metaCtor) {
                const entry = new metaCtor(this, parts);
                entry.logLine = line;
                lastEntry?.onAfter?.(this, entry);
                if (entry.namespace) this.namespaces.add(entry.namespace);
                return entry;
            }
            const hasType = !!(type && typePattern.test(type));
            if (!hasType && lastEntry?.acceptsText) lastEntry.text += "\n" + line;
            else if (hasType) {
                const message = `Unsupported log event name: ${type}`;
                if (!this.parsingErrors.includes(message)) this.parsingErrors.push(message);
            } else if (lastEntry && line.startsWith("*** Skipped")) this.addLogIssue(lastEntry.timestamp, "Skipped-Lines", `${line}. A section of the log has been skipped and the log has been truncated. Full details of this section of log can not be provided.`, "skip");
            else if (lastEntry && line.indexOf("MAXIMUM DEBUG LOG SIZE REACHED") !== -1) {
                this.addLogIssue(lastEntry.timestamp, "Max-Size-reached", "The maximum log size has been reached. Part of the log has been truncated.", "skip");
                this.maxSizeTimestamp = lastEntry.timestamp;
            } else if (!hasType && settingsPattern.test(line)) {} else this.parsingErrors.push(`Invalid log line: ${line}`);
            return null;
        }
        *generateLogLines(log) {
            let startIndex = log.search(/^\d{2}:\d{2}:\d{2}.\d{1} \(\d+\)\|EXECUTION_STARTED$/m);
            if (startIndex === -1) startIndex = 0;
            const hascrlf = log.indexOf("\r\n", startIndex) > -1;
            let lastEntry = null;
            let lfIndex = null;
            let eolIndex = lfIndex = log.indexOf("\n", startIndex);
            let crlfIndex = -1;
            while (eolIndex !== -1) {
                if (hascrlf && eolIndex > crlfIndex) {
                    crlfIndex = log.indexOf("\r", eolIndex - 1);
                    eolIndex = crlfIndex + 1 === eolIndex ? crlfIndex : lfIndex;
                }
                const line = log.slice(startIndex, eolIndex);
                if (line) {
                    const entry = this.parseLine(line, lastEntry);
                    if (entry) {
                        lastEntry = entry;
                        yield entry;
                    }
                }
                startIndex = lfIndex + 1;
                lfIndex = eolIndex = log.indexOf("\n", startIndex);
            }
            const line = log.slice(startIndex, log.length);
            if (line) {
                const entry = this.parseLine(line, lastEntry);
                if (entry) {
                    entry?.onAfter?.(this);
                    yield entry;
                }
            }
        }
        toLogTree(lineGenerator) {
            const rootMethod = new ApexLog(this);
            const stack = [];
            let line;
            const lineIter = new LineIterator(lineGenerator);
            while (line = lineIter.fetch()) {
                if (line.isParent) this.parseTree(line, lineIter, stack);
                line.parent = rootMethod;
                rootMethod.children.push(line);
            }
            rootMethod.setTimes();
            this.mergeManagedPackageEvents(rootMethod);
            this.aggregateTotals([rootMethod]);
            return rootMethod;
        }
        parseTree(currentLine, lineIter, stack) {
            this.lastTimestamp = currentLine.timestamp;
            currentLine.namespace ||= "default";
            if (currentLine.exitTypes.length) {
                const exitOnNextLine = currentLine.nextLineIsExit;
                let nextLine;
                stack.push(currentLine);
                while (nextLine = lineIter.peek()) {
                    this.discontinuity ||= nextLine.discontinuity;
                    if (!exitOnNextLine && !nextLine.nextLineIsExit && nextLine.isExit && !nextLine.exitTypes.length && this.endMethod(currentLine, nextLine, lineIter, stack)) {
                        currentLine.onEnd?.(nextLine, stack);
                        break;
                    } else if (exitOnNextLine && (nextLine.nextLineIsExit || nextLine.isExit || nextLine.exitTypes.length > 0)) {
                        currentLine.exitStamp = nextLine.timestamp;
                        currentLine.onEnd?.(nextLine, stack);
                        break;
                    } else if (this.discontinuity && this.maxSizeTimestamp && nextLine.timestamp > this.maxSizeTimestamp) {
                        currentLine.isTruncated = true;
                        break;
                    }
                    lineIter.fetch();
                    this.lastTimestamp = nextLine.timestamp;
                    nextLine.namespace ||= currentLine.namespace || "default";
                    nextLine.parent = currentLine;
                    currentLine.children.push(nextLine);
                    if (nextLine.isParent) this.parseTree(nextLine, lineIter, stack);
                }
                if (!nextLine || currentLine.isTruncated) {
                    currentLine.exitStamp = this.lastTimestamp ?? currentLine.timestamp;
                    this.addLogIssue(currentLine.exitStamp, "Unexpected-End", "An entry event was found without a corresponding exit event e.g a `METHOD_ENTRY` event without a `METHOD_EXIT`", "unexpected");
                    if (currentLine.isTruncated) {
                        this.updateLogIssue(currentLine.exitStamp, "Max-Size-reached", "The maximum log size has been reached. Part of the log has been truncated.", "skip");
                        this.maxSizeTimestamp = currentLine.exitStamp;
                    }
                    currentLine.isTruncated = true;
                }
                stack.pop();
                currentLine.recalculateDurations();
            }
        }
        isMatchingEnd(startMethod, endLine) {
            return !!(endLine.type && startMethod.exitTypes.includes(endLine.type) && (endLine.lineNumber === startMethod.lineNumber || !endLine.lineNumber || !startMethod.lineNumber));
        }
        endMethod(startMethod, endLine, lineIter, stack) {
            startMethod.exitStamp = endLine.timestamp;
            if (this.isMatchingEnd(startMethod, endLine)) {
                this.discontinuity = false;
                lineIter.fetch();
                return true;
            } else if (this.discontinuity) return true;
            else {
                if (stack.some((m) => this.isMatchingEnd(m, endLine))) return true;
                this.addLogIssue(endLine.timestamp, "Unexpected-Exit", "An exit event was found without a corresponding entry event e.g a `METHOD_EXIT` event without a `METHOD_ENTRY`", "unexpected");
                return false;
            }
        }
        flattenByDepth(nodes) {
            const result = /* @__PURE__ */ new Map();
            let currentDepth = 0;
            let currentNodes = nodes.filter((n) => n.children.length);
            let len = currentNodes.length;
            while (len) {
                result.set(currentDepth++, currentNodes);
                const children = [];
                while (len--) {
                    const node = currentNodes[len];
                    if (!node?.children) continue;
                    let i = node.children.length;
                    while (i--) {
                        const c = node.children[i];
                        if (c?.children.length) children.push(c);
                    }
                }
                currentNodes = children;
                len = currentNodes.length;
            }
            return result;
        }
        aggregateTotals(nodes) {
            if (!nodes.length) return;
            const nodesByDepth = this.flattenByDepth(nodes);
            let depth = nodesByDepth.size;
            while (depth--) {
                const nds = nodesByDepth.get(depth);
                if (!nds) continue;
                let i = nds.length;
                while (i--) {
                    const parent = nds[i];
                    if (!parent?.children) continue;
                    let j = parent.children.length;
                    while (j--) {
                        const child = parent.children[j];
                        if (!child) continue;
                        parent.dmlCount.total += child.dmlCount.total;
                        parent.soqlCount.total += child.soqlCount.total;
                        parent.soslCount.total += child.soslCount.total;
                        parent.dmlRowCount.total += child.dmlRowCount.total;
                        parent.soqlRowCount.total += child.soqlRowCount.total;
                        parent.soslRowCount.total += child.soslRowCount.total;
                        parent.duration.self -= child.duration.total;
                        parent.totalThrownCount += child.totalThrownCount;
                    }
                }
            }
            nodesByDepth.clear();
        }
        mergeManagedPackageEvents(root) {
            const stack = [root];
            while (stack.length) {
                const children = stack.pop().children;
                const len = children.length;
                let write = 0;
                let lastPkg = null;
                for (let i = 0; i < len; i++) {
                    const child = children[i];
                    if (!child) continue;
                    const isPkg = child.type === "ENTERING_MANAGED_PKG";
                    if (lastPkg && child.isParent) {
                        if (isPkg && child.namespace === lastPkg.namespace) {
                            lastPkg.exitStamp = child.exitStamp || child.timestamp;
                            continue;
                        } else if (!isPkg && child.exitStamp) {
                            lastPkg.recalculateDurations();
                            lastPkg = null;
                        }
                    }
                    if (isPkg) {
                        lastPkg?.recalculateDurations();
                        lastPkg = child;
                    }
                    if (child.isParent) stack.push(child);
                    children[write++] = child;
                }
                if (write < children.length) {
                    children.length = write;
                    lastPkg?.recalculateDurations();
                }
            }
        }
        addLogIssue(startTime, summary, description, type) {
            if (!this.reasons.has(summary)) {
                this.reasons.add(summary);
                this.logIssues.push({
                    startTime,
                    summary,
                    description,
                    type
                });
                this.logIssues.sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
            }
        }
        updateLogIssue(startTime, summary, description, type) {
            const elem = this.logIssues.findIndex((item) => {
                return item.summary === summary;
            });
            if (elem > -1) this.logIssues.splice(elem, 1);
            this.reasons.delete(summary);
            this.addLogIssue(startTime, summary, description, type);
        }
        getDebugLevels(log) {
            const match = log.match(settingsPattern);
            if (!match) return [];
            const settings = match[0];
            return settings.substring(settings.indexOf(" ") + 1).split(";").map((entry) => {
                const parts = entry.split(",");
                return new DebugLevel(parts[0] || "", parts[1] || "");
            });
        }
    };
    var DebugLevel = class {
        constructor(category, level) {
            this.logCategory = category;
            this.logLevel = level;
        }
    };
    var LineIterator = class {
        constructor(lineGenerator) {
            this.lineGenerator = lineGenerator;
            this.next = this.lineGenerator.next().value;
        }
        peek() {
            return this.next;
        }
        fetch() {
            const result = this.next;
            this.next = this.lineGenerator.next().value;
            return result;
        }
    };

    //#endregion
    //#region lana/src/stubs/fs.ts
    /**
    * Browser-safe fs stub.
    * Synchronous functions (openSync, readSync, closeSync) used by ApexLogLanguageDetector's
    * large-file fallback path return values that make isApexLogFile() always return false.
    * The primary detection path via isApexLogContent() (text document API) still works.
    * Other functions (existsSync, createReadStream) satisfy transitive imports that are never called.
    */
    function existsSync(_path) {
        return false;
    }
    function openSync(_path, _flags) {
        throw new Error("fs.openSync is not available in the browser");
    }
    function readSync(_fd, _buffer, _offset, _length, _position) {
        return 0;
    }
    function closeSync(_fd) {}

    //#endregion
    //#region lana/src/AppSettings.ts
    const appName = "Lana";

    //#endregion
    //#region lana/src/commands/Command.ts
    var Command = class Command {
        static {
            this.commandPrefix = "lana.";
        }
        constructor(name, title, run) {
            this.name = name;
            this.fullName = Command.commandPrefix + this.name;
            this.title = title;
            this.run = run;
        }
        register(c) {
            const command = commands.registerCommand(this.fullName, this.run);
            c.context.disposables.push(command);
            return this;
        }
    };

    //#endregion
    //#region lana/src/display/WebView.ts
    var WebView = class {
        static apply(name, title, resourceRoots) {
            return window$1.createWebviewPanel(name, title, -1, new WebViewOptions(resourceRoots));
        }
    };
    var WebViewOptions = class {
        constructor(resourceRoots) {
            this.enableCommandUris = true;
            this.enableScripts = true;
            this.retainContextWhenHidden = true;
            this.enableFindWidget = false;
            this.localResourceRoots = resourceRoots;
        }
    };

    //#endregion
    //#region lana/src/log-features/RawLogNavigation.ts
    /**
    * Handles navigation within raw Apex log files.
    * Provides utilities for jumping to specific locations by timestamp.
    */
    var RawLogNavigation = class {
        /**
        * Navigate to a specific line in a log file by timestamp.
        * Uses vscode.open command to support files >50MB (openTextDocument has 50MB limit).
        *
        * @param logPath - Path to the log file
        * @param timestamp - Nanosecond timestamp to find (from log event)
        */
        static async goToLineByTimestamp(logPath, timestamp) {
            try {
                const uri = Uri.file(logPath);
                const text = new TextDecoder().decode(await workspace.fs.readFile(uri));
                const index = text.indexOf(`(${timestamp})|`);
                if (index === -1) return;
                const lineNumber = text.substring(0, index).split("\n").length - 1;
                const lineStart = text.lastIndexOf("\n", index) + 1;
                let lineEnd = text.indexOf("\n", index);
                if (lineEnd === -1) lineEnd = text.length;
                let lineLength = lineEnd - lineStart;
                if (lineLength > 0 && text[lineEnd - 1] === "\r") lineLength--;
                await commands.executeCommand("vscode.open", uri, {
                    preview: false,
                    selection: new Selection(lineNumber, 0, lineNumber, lineLength)
                });
            } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                window$1.showErrorMessage(`Unable to navigate to log line: ${msg}`);
            }
        }
    };

    //#endregion
    //#region lana/src/workspace/AppConfig.ts
    function getConfig() {
        const config = workspace.getConfiguration("lana");
        const inspected = config.inspect("timeline.customThemes");
        const userThemes = {
            ...inspected?.globalValue || {},
            ...inspected?.workspaceValue || {}
        };
        const plainConfig = JSON.parse(JSON.stringify(config));
        plainConfig.timeline.customThemes = userThemes;
        return plainConfig;
    }
    function updateConfig(section, value) {
        return workspace.getConfiguration("lana").update(section, value, ConfigurationTarget.Global);
    }

    //#endregion
    //#region lana/src/commands/BrowserLogView.ts
    /**
    * Root path under which the log-viewer webview assets are served.
    * In sf-toolkit-web, these files are copied to:
    *   packages/vscode/assets/libs/extensions/lana/out/
    * and served at this URL path by Vite's dev server / production build.
    */
    const LANA_BROWSER_ASSETS_ROOT = "/libs/extensions/lana/dist";
    var BrowserLogView = class BrowserLogView {
        static {
            this.helpUrl = "https://certinia.github.io/debug-log-analyzer/";
        }
        static getCurrentView() {
            return BrowserLogView.currentPanel;
        }
        static getLogPath() {
            return BrowserLogView.currentLogPath;
        }
        static setPendingNavigation(timestamp) {
            BrowserLogView.pendingNavigationTimestamp = timestamp;
        }
        static async createView(context, beforeSendLog, logPath, logData) {
            const logName = logPath?.split("/").pop() ?? "Untitled";
            const panel = WebView.apply("logFile", `Log: ${logName}`, []);
            this.currentPanel = panel;
            this.currentLogPath = logPath;
            panel.webview.html = BrowserLogView.buildHtml();
            panel.onDidDispose(() => {
                this.currentPanel = void 0;
                this.currentLogPath = void 0;
            }, void 0, context.context.disposables);
            panel.webview.onDidReceiveMessage(async (msg) => {
                const { cmd, requestId, payload } = msg;
                switch (cmd) {
                    case "fetchLog":
                        await beforeSendLog;
                        await BrowserLogView.sendLog(requestId, panel, context, logPath, logData);
                        break;
                    case "openPath": {
                        const filePath = payload;
                        if (filePath) context.display.showFile(filePath);
                        break;
                    }
                    case "openHelp":
                        commands.executeCommand("vscode.open", Uri.parse(this.helpUrl));
                        break;
                    case "getConfig":
                        panel.webview.postMessage({
                            requestId,
                            cmd: "getConfig",
                            payload: getConfig()
                        });
                        break;
                    case "saveFile": {
                        const { fileContent, options } = payload;
                        if (fileContent && options?.defaultFileName) {
                            const defaultDir = workspace.workspaceFolders?.[0]?.uri ?? Uri.parse("/workspace");
                            const destinationFile = await window$1.showSaveDialog({ defaultUri: Uri.joinPath(defaultDir, options.defaultFileName) });
                            if (destinationFile) workspace.fs.writeFile(destinationFile, new TextEncoder().encode(fileContent)).then(void 0, (error) => {
                                const msg = error instanceof Error ? error.message : String(error);
                                window$1.showErrorMessage(`Unable to save file: ${msg}`);
                            });
                        }
                        break;
                    }
                    case "showError": {
                        const { text } = payload;
                        if (text) window$1.showErrorMessage(text);
                        break;
                    }
                    case "goToLogLine": {
                        const { timestamp } = payload;
                        if (timestamp && BrowserLogView.currentLogPath) RawLogNavigation.goToLineByTimestamp(BrowserLogView.currentLogPath, timestamp);
                        break;
                    }
                }
            }, void 0, []);
            return panel;
        }
        static buildHtml() {
            return `<!DOCTYPE html>
    <html lang="en">
    <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Log Viewer</title>
    <style>
        html {
        width: 100%;
        height: 100%;
        font-size: var(--vscode-editor-font-size);
        }
        body {
        color: var(--vscode-editor-foreground);
        font-family: monospace;
        font-weight: normal;
        font-size: var(--vscode-editor-font-size);
        height: 100%;
        display: flex;
        flex-direction: column;
        padding: 0px;
        }
        @font-face {
        font-family: 'codicon';
        font-display: block;
        src: url('${LANA_BROWSER_ASSETS_ROOT}/codicon.ttf') format('truetype');
        }
    </style>
    <script type="module" defer crossorigin="anonymous" src="${LANA_BROWSER_ASSETS_ROOT}/bundle.js"><\/script>
    </head>
    <body></body>
    </html>`;
        }
        static async sendLog(requestId, panel, context, logFilePath, logData) {
            let content = logData;
            if (!content && logFilePath) try {
                const uri = Uri.file(logFilePath);
                const bytes = await workspace.fs.readFile(uri);
                content = new TextDecoder().decode(bytes);
            } catch {
                context.display.showErrorMessage("Log file could not be found.", { modal: true });
                return;
            }
            const logName = logFilePath?.split("/").pop() ?? "";
            const navigateToTimestamp = BrowserLogView.pendingNavigationTimestamp;
            BrowserLogView.pendingNavigationTimestamp = void 0;
            panel.webview.postMessage({
                requestId,
                cmd: "fetchLog",
                payload: {
                    logName,
                    logUri: logFilePath ?? "",
                    logPath: logFilePath,
                    logData: content,
                    navigateToTimestamp
                }
            });
        }
    };

    //#endregion
    //#region lana/src/commands/ShowLogAnalysis.ts
    var ShowLogAnalysis = class ShowLogAnalysis {
        static getCommand(context) {
            return new Command("showLogAnalysis", "Log: Show Apex Log Analysis", (uri) => ShowLogAnalysis.safeCommand(context, uri));
        }
        static apply(context) {
            ShowLogAnalysis.getCommand(context).register(context);
            context.display.output(`Registered command '${appName}: Show Log'`);
        }
        static async safeCommand(context, uri) {
            try {
                return ShowLogAnalysis.command(context, uri);
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                context.display.showErrorMessage(`Error showing logfile: ${msg}`);
                return Promise.resolve();
            }
        }
        static async command(context, uri) {
            const filePath = uri?.fsPath || window$1?.activeTextEditor?.document.fileName || "";
            const fileContent = !existsSync(filePath) ? window$1?.activeTextEditor?.document.getText() : "";
            if (filePath || fileContent) BrowserLogView.createView(context, Promise.resolve(), filePath, fileContent);
            else {
                context.display.showErrorMessage("No file selected or the file is too large. Try again using the file explorer or text editor command.");
                throw new Error("No file selected or the file is too large. Try again using the file explorer or text editor command.");
            }
        }
    };

    //#endregion
    //#region \0polyfill-node.global.js
    var _polyfill_node_global_default = typeof _polyfill_node_global_default !== "undefined" ? _polyfill_node_global_default : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {};

    //#endregion
    //#region \0polyfill-node.buffer.js
    var lookup = [];
    var revLookup = [];
    var Arr = typeof Uint8Array !== "undefined" ? Uint8Array : Array;
    var inited = false;
    function init() {
        inited = true;
        var code = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        for (var i = 0, len = code.length; i < len; ++i) {
            lookup[i] = code[i];
            revLookup[code.charCodeAt(i)] = i;
        }
        revLookup["-".charCodeAt(0)] = 62;
        revLookup["_".charCodeAt(0)] = 63;
    }
    function toByteArray(b64) {
        if (!inited) init();
        var i;
        var j;
        var l;
        var tmp;
        var placeHolders;
        var arr;
        var len = b64.length;
        if (len % 4 > 0) throw new Error("Invalid string. Length must be a multiple of 4");
        placeHolders = b64[len - 2] === "=" ? 2 : b64[len - 1] === "=" ? 1 : 0;
        arr = new Arr(len * 3 / 4 - placeHolders);
        l = placeHolders > 0 ? len - 4 : len;
        var L = 0;
        for (i = 0, j = 0; i < l; i += 4, j += 3) {
            tmp = revLookup[b64.charCodeAt(i)] << 18 | revLookup[b64.charCodeAt(i + 1)] << 12 | revLookup[b64.charCodeAt(i + 2)] << 6 | revLookup[b64.charCodeAt(i + 3)];
            arr[L++] = tmp >> 16 & 255;
            arr[L++] = tmp >> 8 & 255;
            arr[L++] = tmp & 255;
        }
        if (placeHolders === 2) {
            tmp = revLookup[b64.charCodeAt(i)] << 2 | revLookup[b64.charCodeAt(i + 1)] >> 4;
            arr[L++] = tmp & 255;
        } else if (placeHolders === 1) {
            tmp = revLookup[b64.charCodeAt(i)] << 10 | revLookup[b64.charCodeAt(i + 1)] << 4 | revLookup[b64.charCodeAt(i + 2)] >> 2;
            arr[L++] = tmp >> 8 & 255;
            arr[L++] = tmp & 255;
        }
        return arr;
    }
    function tripletToBase64(num) {
        return lookup[num >> 18 & 63] + lookup[num >> 12 & 63] + lookup[num >> 6 & 63] + lookup[num & 63];
    }
    function encodeChunk(uint8, start, end) {
        var tmp;
        var output = [];
        for (var i = start; i < end; i += 3) {
            tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + uint8[i + 2];
            output.push(tripletToBase64(tmp));
        }
        return output.join("");
    }
    function fromByteArray(uint8) {
        if (!inited) init();
        var tmp;
        var len = uint8.length;
        var extraBytes = len % 3;
        var output = "";
        var parts = [];
        var maxChunkLength = 16383;
        for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) parts.push(encodeChunk(uint8, i, i + maxChunkLength > len2 ? len2 : i + maxChunkLength));
        if (extraBytes === 1) {
            tmp = uint8[len - 1];
            output += lookup[tmp >> 2];
            output += lookup[tmp << 4 & 63];
            output += "==";
        } else if (extraBytes === 2) {
            tmp = (uint8[len - 2] << 8) + uint8[len - 1];
            output += lookup[tmp >> 10];
            output += lookup[tmp >> 4 & 63];
            output += lookup[tmp << 2 & 63];
            output += "=";
        }
        parts.push(output);
        return parts.join("");
    }
    function read(buffer, offset, isLE, mLen, nBytes) {
        var e;
        var m;
        var eLen = nBytes * 8 - mLen - 1;
        var eMax = (1 << eLen) - 1;
        var eBias = eMax >> 1;
        var nBits = -7;
        var i = isLE ? nBytes - 1 : 0;
        var d = isLE ? -1 : 1;
        var s = buffer[offset + i];
        i += d;
        e = s & (1 << -nBits) - 1;
        s >>= -nBits;
        nBits += eLen;
        for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8);
        m = e & (1 << -nBits) - 1;
        e >>= -nBits;
        nBits += mLen;
        for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8);
        if (e === 0) e = 1 - eBias;
        else if (e === eMax) return m ? NaN : (s ? -1 : 1) * Infinity;
        else {
            m = m + Math.pow(2, mLen);
            e = e - eBias;
        }
        return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
    }
    function write(buffer, value, offset, isLE, mLen, nBytes) {
        var e;
        var m;
        var c;
        var eLen = nBytes * 8 - mLen - 1;
        var eMax = (1 << eLen) - 1;
        var eBias = eMax >> 1;
        var rt = mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0;
        var i = isLE ? 0 : nBytes - 1;
        var d = isLE ? 1 : -1;
        var s = value < 0 || value === 0 && 1 / value < 0 ? 1 : 0;
        value = Math.abs(value);
        if (isNaN(value) || value === Infinity) {
            m = isNaN(value) ? 1 : 0;
            e = eMax;
        } else {
            e = Math.floor(Math.log(value) / Math.LN2);
            if (value * (c = Math.pow(2, -e)) < 1) {
                e--;
                c *= 2;
            }
            if (e + eBias >= 1) value += rt / c;
            else value += rt * Math.pow(2, 1 - eBias);
            if (value * c >= 2) {
                e++;
                c /= 2;
            }
            if (e + eBias >= eMax) {
                m = 0;
                e = eMax;
            } else if (e + eBias >= 1) {
                m = (value * c - 1) * Math.pow(2, mLen);
                e = e + eBias;
            } else {
                m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
                e = 0;
            }
        }
        for (; mLen >= 8; buffer[offset + i] = m & 255, i += d, m /= 256, mLen -= 8);
        e = e << mLen | m;
        eLen += mLen;
        for (; eLen > 0; buffer[offset + i] = e & 255, i += d, e /= 256, eLen -= 8);
        buffer[offset + i - d] |= s * 128;
    }
    var toString = {}.toString;
    var isArray = Array.isArray || function(arr) {
        return toString.call(arr) == "[object Array]";
    };
    /*!
    * The buffer module from node.js, for the browser.
    *
    * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
    * @license  MIT
    */
    var INSPECT_MAX_BYTES = 50;
    /**
    * If `Buffer.TYPED_ARRAY_SUPPORT`:
    *   === true    Use Uint8Array implementation (fastest)
    *   === false   Use Object implementation (most compatible, even IE6)
    *
    * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
    * Opera 11.6+, iOS 4.2+.
    *
    * Due to various browser bugs, sometimes the Object implementation will be used even
    * when the browser supports typed arrays.
    *
    * Note:
    *
    *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
    *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
    *
    *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
    *
    *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
    *     incorrect length in some situations.

    * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
    * get the Object implementation, which is slower but behaves correctly.
    */
    Buffer$1.TYPED_ARRAY_SUPPORT = _polyfill_node_global_default.TYPED_ARRAY_SUPPORT !== void 0 ? _polyfill_node_global_default.TYPED_ARRAY_SUPPORT : true;
    var _kMaxLength = kMaxLength();
    function kMaxLength() {
        return Buffer$1.TYPED_ARRAY_SUPPORT ? 2147483647 : 1073741823;
    }
    function createBuffer(that, length) {
        if (kMaxLength() < length) throw new RangeError("Invalid typed array length");
        if (Buffer$1.TYPED_ARRAY_SUPPORT) {
            that = new Uint8Array(length);
            that.__proto__ = Buffer$1.prototype;
        } else {
            if (that === null) that = new Buffer$1(length);
            that.length = length;
        }
        return that;
    }
    /**
    * The Buffer constructor returns instances of `Uint8Array` that have their
    * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
    * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
    * and the `Uint8Array` methods. Square bracket notation works as expected -- it
    * returns a single octet.
    *
    * The `Uint8Array` prototype remains unmodified.
    */
    function Buffer$1(arg, encodingOrOffset, length) {
        if (!Buffer$1.TYPED_ARRAY_SUPPORT && !(this instanceof Buffer$1)) return new Buffer$1(arg, encodingOrOffset, length);
        if (typeof arg === "number") {
            if (typeof encodingOrOffset === "string") throw new Error("If encoding is specified then the first argument must be a string");
            return allocUnsafe(this, arg);
        }
        return from(this, arg, encodingOrOffset, length);
    }
    __name(Buffer$1, "Buffer");
    Buffer$1.poolSize = 8192;
    Buffer$1._augment = function(arr) {
        arr.__proto__ = Buffer$1.prototype;
        return arr;
    };
    function from(that, value, encodingOrOffset, length) {
        if (typeof value === "number") throw new TypeError("\"value\" argument must not be a number");
        if (typeof ArrayBuffer !== "undefined" && value instanceof ArrayBuffer) return fromArrayBuffer(that, value, encodingOrOffset, length);
        if (typeof value === "string") return fromString(that, value, encodingOrOffset);
        return fromObject(that, value);
    }
    /**
    * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
    * if value is a number.
    * Buffer.from(str[, encoding])
    * Buffer.from(array)
    * Buffer.from(buffer)
    * Buffer.from(arrayBuffer[, byteOffset[, length]])
    **/
    Buffer$1.from = function(value, encodingOrOffset, length) {
        return from(null, value, encodingOrOffset, length);
    };
    if (Buffer$1.TYPED_ARRAY_SUPPORT) {
        Buffer$1.prototype.__proto__ = Uint8Array.prototype;
        Buffer$1.__proto__ = Uint8Array;
        if (typeof Symbol !== "undefined" && Symbol.species && Buffer$1[Symbol.species] === Buffer$1);
    }
    function assertSize(size) {
        if (typeof size !== "number") throw new TypeError("\"size\" argument must be a number");
        else if (size < 0) throw new RangeError("\"size\" argument must not be negative");
    }
    function alloc(that, size, fill, encoding) {
        assertSize(size);
        if (size <= 0) return createBuffer(that, size);
        if (fill !== void 0) return typeof encoding === "string" ? createBuffer(that, size).fill(fill, encoding) : createBuffer(that, size).fill(fill);
        return createBuffer(that, size);
    }
    /**
    * Creates a new filled Buffer instance.
    * alloc(size[, fill[, encoding]])
    **/
    Buffer$1.alloc = function(size, fill, encoding) {
        return alloc(null, size, fill, encoding);
    };
    function allocUnsafe(that, size) {
        assertSize(size);
        that = createBuffer(that, size < 0 ? 0 : checked(size) | 0);
        if (!Buffer$1.TYPED_ARRAY_SUPPORT) for (var i = 0; i < size; ++i) that[i] = 0;
        return that;
    }
    /**
    * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
    * */
    Buffer$1.allocUnsafe = function(size) {
        return allocUnsafe(null, size);
    };
    /**
    * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
    */
    Buffer$1.allocUnsafeSlow = function(size) {
        return allocUnsafe(null, size);
    };
    function fromString(that, string, encoding) {
        if (typeof encoding !== "string" || encoding === "") encoding = "utf8";
        if (!Buffer$1.isEncoding(encoding)) throw new TypeError("\"encoding\" must be a valid string encoding");
        var length = byteLength(string, encoding) | 0;
        that = createBuffer(that, length);
        var actual = that.write(string, encoding);
        if (actual !== length) that = that.slice(0, actual);
        return that;
    }
    function fromArrayLike(that, array) {
        var length = array.length < 0 ? 0 : checked(array.length) | 0;
        that = createBuffer(that, length);
        for (var i = 0; i < length; i += 1) that[i] = array[i] & 255;
        return that;
    }
    function fromArrayBuffer(that, array, byteOffset, length) {
        array.byteLength;
        if (byteOffset < 0 || array.byteLength < byteOffset) throw new RangeError("'offset' is out of bounds");
        if (array.byteLength < byteOffset + (length || 0)) throw new RangeError("'length' is out of bounds");
        if (byteOffset === void 0 && length === void 0) array = new Uint8Array(array);
        else if (length === void 0) array = new Uint8Array(array, byteOffset);
        else array = new Uint8Array(array, byteOffset, length);
        if (Buffer$1.TYPED_ARRAY_SUPPORT) {
            that = array;
            that.__proto__ = Buffer$1.prototype;
        } else that = fromArrayLike(that, array);
        return that;
    }
    function fromObject(that, obj) {
        if (internalIsBuffer(obj)) {
            var len = checked(obj.length) | 0;
            that = createBuffer(that, len);
            if (that.length === 0) return that;
            obj.copy(that, 0, 0, len);
            return that;
        }
        if (obj) {
            if (typeof ArrayBuffer !== "undefined" && obj.buffer instanceof ArrayBuffer || "length" in obj) {
                if (typeof obj.length !== "number" || isnan(obj.length)) return createBuffer(that, 0);
                return fromArrayLike(that, obj);
            }
            if (obj.type === "Buffer" && isArray(obj.data)) return fromArrayLike(that, obj.data);
        }
        throw new TypeError("First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.");
    }
    function checked(length) {
        if (length >= kMaxLength()) throw new RangeError("Attempt to allocate Buffer larger than maximum size: 0x" + kMaxLength().toString(16) + " bytes");
        return length | 0;
    }
    Buffer$1.isBuffer = isBuffer;
    function internalIsBuffer(b) {
        return !!(b != null && b._isBuffer);
    }
    Buffer$1.compare = function compare(a, b) {
        if (!internalIsBuffer(a) || !internalIsBuffer(b)) throw new TypeError("Arguments must be Buffers");
        if (a === b) return 0;
        var x = a.length;
        var y = b.length;
        for (var i = 0, len = Math.min(x, y); i < len; ++i) if (a[i] !== b[i]) {
            x = a[i];
            y = b[i];
            break;
        }
        if (x < y) return -1;
        if (y < x) return 1;
        return 0;
    };
    Buffer$1.isEncoding = function isEncoding(encoding) {
        switch (String(encoding).toLowerCase()) {
            case "hex":
            case "utf8":
            case "utf-8":
            case "ascii":
            case "latin1":
            case "binary":
            case "base64":
            case "ucs2":
            case "ucs-2":
            case "utf16le":
            case "utf-16le": return true;
            default: return false;
        }
    };
    Buffer$1.concat = function concat(list, length) {
        if (!isArray(list)) throw new TypeError("\"list\" argument must be an Array of Buffers");
        if (list.length === 0) return Buffer$1.alloc(0);
        var i;
        if (length === void 0) {
            length = 0;
            for (i = 0; i < list.length; ++i) length += list[i].length;
        }
        var buffer = Buffer$1.allocUnsafe(length);
        var pos = 0;
        for (i = 0; i < list.length; ++i) {
            var buf = list[i];
            if (!internalIsBuffer(buf)) throw new TypeError("\"list\" argument must be an Array of Buffers");
            buf.copy(buffer, pos);
            pos += buf.length;
        }
        return buffer;
    };
    function byteLength(string, encoding) {
        if (internalIsBuffer(string)) return string.length;
        if (typeof ArrayBuffer !== "undefined" && typeof ArrayBuffer.isView === "function" && (ArrayBuffer.isView(string) || string instanceof ArrayBuffer)) return string.byteLength;
        if (typeof string !== "string") string = "" + string;
        var len = string.length;
        if (len === 0) return 0;
        var loweredCase = false;
        for (;;) switch (encoding) {
            case "ascii":
            case "latin1":
            case "binary": return len;
            case "utf8":
            case "utf-8":
            case void 0: return utf8ToBytes(string).length;
            case "ucs2":
            case "ucs-2":
            case "utf16le":
            case "utf-16le": return len * 2;
            case "hex": return len >>> 1;
            case "base64": return base64ToBytes(string).length;
            default:
                if (loweredCase) return utf8ToBytes(string).length;
                encoding = ("" + encoding).toLowerCase();
                loweredCase = true;
        }
    }
    Buffer$1.byteLength = byteLength;
    function slowToString(encoding, start, end) {
        var loweredCase = false;
        if (start === void 0 || start < 0) start = 0;
        if (start > this.length) return "";
        if (end === void 0 || end > this.length) end = this.length;
        if (end <= 0) return "";
        end >>>= 0;
        start >>>= 0;
        if (end <= start) return "";
        if (!encoding) encoding = "utf8";
        while (true) switch (encoding) {
            case "hex": return hexSlice(this, start, end);
            case "utf8":
            case "utf-8": return utf8Slice(this, start, end);
            case "ascii": return asciiSlice(this, start, end);
            case "latin1":
            case "binary": return latin1Slice(this, start, end);
            case "base64": return base64Slice(this, start, end);
            case "ucs2":
            case "ucs-2":
            case "utf16le":
            case "utf-16le": return utf16leSlice(this, start, end);
            default:
                if (loweredCase) throw new TypeError("Unknown encoding: " + encoding);
                encoding = (encoding + "").toLowerCase();
                loweredCase = true;
        }
    }
    Buffer$1.prototype._isBuffer = true;
    function swap(b, n, m) {
        var i = b[n];
        b[n] = b[m];
        b[m] = i;
    }
    Buffer$1.prototype.swap16 = function swap16() {
        var len = this.length;
        if (len % 2 !== 0) throw new RangeError("Buffer size must be a multiple of 16-bits");
        for (var i = 0; i < len; i += 2) swap(this, i, i + 1);
        return this;
    };
    Buffer$1.prototype.swap32 = function swap32() {
        var len = this.length;
        if (len % 4 !== 0) throw new RangeError("Buffer size must be a multiple of 32-bits");
        for (var i = 0; i < len; i += 4) {
            swap(this, i, i + 3);
            swap(this, i + 1, i + 2);
        }
        return this;
    };
    Buffer$1.prototype.swap64 = function swap64() {
        var len = this.length;
        if (len % 8 !== 0) throw new RangeError("Buffer size must be a multiple of 64-bits");
        for (var i = 0; i < len; i += 8) {
            swap(this, i, i + 7);
            swap(this, i + 1, i + 6);
            swap(this, i + 2, i + 5);
            swap(this, i + 3, i + 4);
        }
        return this;
    };
    Buffer$1.prototype.toString = function toString() {
        var length = this.length | 0;
        if (length === 0) return "";
        if (arguments.length === 0) return utf8Slice(this, 0, length);
        return slowToString.apply(this, arguments);
    };
    Buffer$1.prototype.equals = function equals(b) {
        if (!internalIsBuffer(b)) throw new TypeError("Argument must be a Buffer");
        if (this === b) return true;
        return Buffer$1.compare(this, b) === 0;
    };
    Buffer$1.prototype.inspect = function inspect() {
        var str = "";
        var max = 50;
        if (this.length > 0) {
            str = this.toString("hex", 0, max).match(/.{2}/g).join(" ");
            if (this.length > max) str += " ... ";
        }
        return "<Buffer " + str + ">";
    };
    Buffer$1.prototype.compare = function compare(target, start, end, thisStart, thisEnd) {
        if (!internalIsBuffer(target)) throw new TypeError("Argument must be a Buffer");
        if (start === void 0) start = 0;
        if (end === void 0) end = target ? target.length : 0;
        if (thisStart === void 0) thisStart = 0;
        if (thisEnd === void 0) thisEnd = this.length;
        if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) throw new RangeError("out of range index");
        if (thisStart >= thisEnd && start >= end) return 0;
        if (thisStart >= thisEnd) return -1;
        if (start >= end) return 1;
        start >>>= 0;
        end >>>= 0;
        thisStart >>>= 0;
        thisEnd >>>= 0;
        if (this === target) return 0;
        var x = thisEnd - thisStart;
        var y = end - start;
        var len = Math.min(x, y);
        var thisCopy = this.slice(thisStart, thisEnd);
        var targetCopy = target.slice(start, end);
        for (var i = 0; i < len; ++i) if (thisCopy[i] !== targetCopy[i]) {
            x = thisCopy[i];
            y = targetCopy[i];
            break;
        }
        if (x < y) return -1;
        if (y < x) return 1;
        return 0;
    };
    function bidirectionalIndexOf(buffer, val, byteOffset, encoding, dir) {
        if (buffer.length === 0) return -1;
        if (typeof byteOffset === "string") {
            encoding = byteOffset;
            byteOffset = 0;
        } else if (byteOffset > 2147483647) byteOffset = 2147483647;
        else if (byteOffset < -2147483648) byteOffset = -2147483648;
        byteOffset = +byteOffset;
        if (isNaN(byteOffset)) byteOffset = dir ? 0 : buffer.length - 1;
        if (byteOffset < 0) byteOffset = buffer.length + byteOffset;
        if (byteOffset >= buffer.length) if (dir) return -1;
        else byteOffset = buffer.length - 1;
        else if (byteOffset < 0) if (dir) byteOffset = 0;
        else return -1;
        if (typeof val === "string") val = Buffer$1.from(val, encoding);
        if (internalIsBuffer(val)) {
            if (val.length === 0) return -1;
            return arrayIndexOf(buffer, val, byteOffset, encoding, dir);
        } else if (typeof val === "number") {
            val = val & 255;
            if (Buffer$1.TYPED_ARRAY_SUPPORT && typeof Uint8Array.prototype.indexOf === "function") if (dir) return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset);
            else return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset);
            return arrayIndexOf(buffer, [val], byteOffset, encoding, dir);
        }
        throw new TypeError("val must be string, number or Buffer");
    }
    function arrayIndexOf(arr, val, byteOffset, encoding, dir) {
        var indexSize = 1;
        var arrLength = arr.length;
        var valLength = val.length;
        if (encoding !== void 0) {
            encoding = String(encoding).toLowerCase();
            if (encoding === "ucs2" || encoding === "ucs-2" || encoding === "utf16le" || encoding === "utf-16le") {
                if (arr.length < 2 || val.length < 2) return -1;
                indexSize = 2;
                arrLength /= 2;
                valLength /= 2;
                byteOffset /= 2;
            }
        }
        function read(buf, i) {
            if (indexSize === 1) return buf[i];
            else return buf.readUInt16BE(i * indexSize);
        }
        var i;
        if (dir) {
            var foundIndex = -1;
            for (i = byteOffset; i < arrLength; i++) if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
                if (foundIndex === -1) foundIndex = i;
                if (i - foundIndex + 1 === valLength) return foundIndex * indexSize;
            } else {
                if (foundIndex !== -1) i -= i - foundIndex;
                foundIndex = -1;
            }
        } else {
            if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength;
            for (i = byteOffset; i >= 0; i--) {
                var found = true;
                for (var j = 0; j < valLength; j++) if (read(arr, i + j) !== read(val, j)) {
                    found = false;
                    break;
                }
                if (found) return i;
            }
        }
        return -1;
    }
    Buffer$1.prototype.includes = function includes(val, byteOffset, encoding) {
        return this.indexOf(val, byteOffset, encoding) !== -1;
    };
    Buffer$1.prototype.indexOf = function indexOf(val, byteOffset, encoding) {
        return bidirectionalIndexOf(this, val, byteOffset, encoding, true);
    };
    Buffer$1.prototype.lastIndexOf = function lastIndexOf(val, byteOffset, encoding) {
        return bidirectionalIndexOf(this, val, byteOffset, encoding, false);
    };
    function hexWrite(buf, string, offset, length) {
        offset = Number(offset) || 0;
        var remaining = buf.length - offset;
        if (!length) length = remaining;
        else {
            length = Number(length);
            if (length > remaining) length = remaining;
        }
        var strLen = string.length;
        if (strLen % 2 !== 0) throw new TypeError("Invalid hex string");
        if (length > strLen / 2) length = strLen / 2;
        for (var i = 0; i < length; ++i) {
            var parsed = parseInt(string.substr(i * 2, 2), 16);
            if (isNaN(parsed)) return i;
            buf[offset + i] = parsed;
        }
        return i;
    }
    function utf8Write(buf, string, offset, length) {
        return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length);
    }
    function asciiWrite(buf, string, offset, length) {
        return blitBuffer(asciiToBytes(string), buf, offset, length);
    }
    function latin1Write(buf, string, offset, length) {
        return asciiWrite(buf, string, offset, length);
    }
    function base64Write(buf, string, offset, length) {
        return blitBuffer(base64ToBytes(string), buf, offset, length);
    }
    function ucs2Write(buf, string, offset, length) {
        return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length);
    }
    Buffer$1.prototype.write = function write(string, offset, length, encoding) {
        if (offset === void 0) {
            encoding = "utf8";
            length = this.length;
            offset = 0;
        } else if (length === void 0 && typeof offset === "string") {
            encoding = offset;
            length = this.length;
            offset = 0;
        } else if (isFinite(offset)) {
            offset = offset | 0;
            if (isFinite(length)) {
                length = length | 0;
                if (encoding === void 0) encoding = "utf8";
            } else {
                encoding = length;
                length = void 0;
            }
        } else throw new Error("Buffer.write(string, encoding, offset[, length]) is no longer supported");
        var remaining = this.length - offset;
        if (length === void 0 || length > remaining) length = remaining;
        if (string.length > 0 && (length < 0 || offset < 0) || offset > this.length) throw new RangeError("Attempt to write outside buffer bounds");
        if (!encoding) encoding = "utf8";
        var loweredCase = false;
        for (;;) switch (encoding) {
            case "hex": return hexWrite(this, string, offset, length);
            case "utf8":
            case "utf-8": return utf8Write(this, string, offset, length);
            case "ascii": return asciiWrite(this, string, offset, length);
            case "latin1":
            case "binary": return latin1Write(this, string, offset, length);
            case "base64": return base64Write(this, string, offset, length);
            case "ucs2":
            case "ucs-2":
            case "utf16le":
            case "utf-16le": return ucs2Write(this, string, offset, length);
            default:
                if (loweredCase) throw new TypeError("Unknown encoding: " + encoding);
                encoding = ("" + encoding).toLowerCase();
                loweredCase = true;
        }
    };
    Buffer$1.prototype.toJSON = function toJSON() {
        return {
            type: "Buffer",
            data: Array.prototype.slice.call(this._arr || this, 0)
        };
    };
    function base64Slice(buf, start, end) {
        if (start === 0 && end === buf.length) return fromByteArray(buf);
        else return fromByteArray(buf.slice(start, end));
    }
    function utf8Slice(buf, start, end) {
        end = Math.min(buf.length, end);
        var res = [];
        var i = start;
        while (i < end) {
            var firstByte = buf[i];
            var codePoint = null;
            var bytesPerSequence = firstByte > 239 ? 4 : firstByte > 223 ? 3 : firstByte > 191 ? 2 : 1;
            if (i + bytesPerSequence <= end) {
                var secondByte;
                var thirdByte;
                var fourthByte;
                var tempCodePoint;
                switch (bytesPerSequence) {
                    case 1:
                        if (firstByte < 128) codePoint = firstByte;
                        break;
                    case 2:
                        secondByte = buf[i + 1];
                        if ((secondByte & 192) === 128) {
                            tempCodePoint = (firstByte & 31) << 6 | secondByte & 63;
                            if (tempCodePoint > 127) codePoint = tempCodePoint;
                        }
                        break;
                    case 3:
                        secondByte = buf[i + 1];
                        thirdByte = buf[i + 2];
                        if ((secondByte & 192) === 128 && (thirdByte & 192) === 128) {
                            tempCodePoint = (firstByte & 15) << 12 | (secondByte & 63) << 6 | thirdByte & 63;
                            if (tempCodePoint > 2047 && (tempCodePoint < 55296 || tempCodePoint > 57343)) codePoint = tempCodePoint;
                        }
                        break;
                    case 4:
                        secondByte = buf[i + 1];
                        thirdByte = buf[i + 2];
                        fourthByte = buf[i + 3];
                        if ((secondByte & 192) === 128 && (thirdByte & 192) === 128 && (fourthByte & 192) === 128) {
                            tempCodePoint = (firstByte & 15) << 18 | (secondByte & 63) << 12 | (thirdByte & 63) << 6 | fourthByte & 63;
                            if (tempCodePoint > 65535 && tempCodePoint < 1114112) codePoint = tempCodePoint;
                        }
                }
            }
            if (codePoint === null) {
                codePoint = 65533;
                bytesPerSequence = 1;
            } else if (codePoint > 65535) {
                codePoint -= 65536;
                res.push(codePoint >>> 10 & 1023 | 55296);
                codePoint = 56320 | codePoint & 1023;
            }
            res.push(codePoint);
            i += bytesPerSequence;
        }
        return decodeCodePointsArray(res);
    }
    var MAX_ARGUMENTS_LENGTH = 4096;
    function decodeCodePointsArray(codePoints) {
        var len = codePoints.length;
        if (len <= MAX_ARGUMENTS_LENGTH) return String.fromCharCode.apply(String, codePoints);
        var res = "";
        var i = 0;
        while (i < len) res += String.fromCharCode.apply(String, codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH));
        return res;
    }
    function asciiSlice(buf, start, end) {
        var ret = "";
        end = Math.min(buf.length, end);
        for (var i = start; i < end; ++i) ret += String.fromCharCode(buf[i] & 127);
        return ret;
    }
    function latin1Slice(buf, start, end) {
        var ret = "";
        end = Math.min(buf.length, end);
        for (var i = start; i < end; ++i) ret += String.fromCharCode(buf[i]);
        return ret;
    }
    function hexSlice(buf, start, end) {
        var len = buf.length;
        if (!start || start < 0) start = 0;
        if (!end || end < 0 || end > len) end = len;
        var out = "";
        for (var i = start; i < end; ++i) out += toHex(buf[i]);
        return out;
    }
    function utf16leSlice(buf, start, end) {
        var bytes = buf.slice(start, end);
        var res = "";
        for (var i = 0; i < bytes.length; i += 2) res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256);
        return res;
    }
    Buffer$1.prototype.slice = function slice(start, end) {
        var len = this.length;
        start = ~~start;
        end = end === void 0 ? len : ~~end;
        if (start < 0) {
            start += len;
            if (start < 0) start = 0;
        } else if (start > len) start = len;
        if (end < 0) {
            end += len;
            if (end < 0) end = 0;
        } else if (end > len) end = len;
        if (end < start) end = start;
        var newBuf;
        if (Buffer$1.TYPED_ARRAY_SUPPORT) {
            newBuf = this.subarray(start, end);
            newBuf.__proto__ = Buffer$1.prototype;
        } else {
            var sliceLen = end - start;
            newBuf = new Buffer$1(sliceLen, void 0);
            for (var i = 0; i < sliceLen; ++i) newBuf[i] = this[i + start];
        }
        return newBuf;
    };
    function checkOffset(offset, ext, length) {
        if (offset % 1 !== 0 || offset < 0) throw new RangeError("offset is not uint");
        if (offset + ext > length) throw new RangeError("Trying to access beyond buffer length");
    }
    Buffer$1.prototype.readUIntLE = function readUIntLE(offset, byteLength, noAssert) {
        offset = offset | 0;
        byteLength = byteLength | 0;
        if (!noAssert) checkOffset(offset, byteLength, this.length);
        var val = this[offset];
        var mul = 1;
        var i = 0;
        while (++i < byteLength && (mul *= 256)) val += this[offset + i] * mul;
        return val;
    };
    Buffer$1.prototype.readUIntBE = function readUIntBE(offset, byteLength, noAssert) {
        offset = offset | 0;
        byteLength = byteLength | 0;
        if (!noAssert) checkOffset(offset, byteLength, this.length);
        var val = this[offset + --byteLength];
        var mul = 1;
        while (byteLength > 0 && (mul *= 256)) val += this[offset + --byteLength] * mul;
        return val;
    };
    Buffer$1.prototype.readUInt8 = function readUInt8(offset, noAssert) {
        if (!noAssert) checkOffset(offset, 1, this.length);
        return this[offset];
    };
    Buffer$1.prototype.readUInt16LE = function readUInt16LE(offset, noAssert) {
        if (!noAssert) checkOffset(offset, 2, this.length);
        return this[offset] | this[offset + 1] << 8;
    };
    Buffer$1.prototype.readUInt16BE = function readUInt16BE(offset, noAssert) {
        if (!noAssert) checkOffset(offset, 2, this.length);
        return this[offset] << 8 | this[offset + 1];
    };
    Buffer$1.prototype.readUInt32LE = function readUInt32LE(offset, noAssert) {
        if (!noAssert) checkOffset(offset, 4, this.length);
        return (this[offset] | this[offset + 1] << 8 | this[offset + 2] << 16) + this[offset + 3] * 16777216;
    };
    Buffer$1.prototype.readUInt32BE = function readUInt32BE(offset, noAssert) {
        if (!noAssert) checkOffset(offset, 4, this.length);
        return this[offset] * 16777216 + (this[offset + 1] << 16 | this[offset + 2] << 8 | this[offset + 3]);
    };
    Buffer$1.prototype.readIntLE = function readIntLE(offset, byteLength, noAssert) {
        offset = offset | 0;
        byteLength = byteLength | 0;
        if (!noAssert) checkOffset(offset, byteLength, this.length);
        var val = this[offset];
        var mul = 1;
        var i = 0;
        while (++i < byteLength && (mul *= 256)) val += this[offset + i] * mul;
        mul *= 128;
        if (val >= mul) val -= Math.pow(2, 8 * byteLength);
        return val;
    };
    Buffer$1.prototype.readIntBE = function readIntBE(offset, byteLength, noAssert) {
        offset = offset | 0;
        byteLength = byteLength | 0;
        if (!noAssert) checkOffset(offset, byteLength, this.length);
        var i = byteLength;
        var mul = 1;
        var val = this[offset + --i];
        while (i > 0 && (mul *= 256)) val += this[offset + --i] * mul;
        mul *= 128;
        if (val >= mul) val -= Math.pow(2, 8 * byteLength);
        return val;
    };
    Buffer$1.prototype.readInt8 = function readInt8(offset, noAssert) {
        if (!noAssert) checkOffset(offset, 1, this.length);
        if (!(this[offset] & 128)) return this[offset];
        return (255 - this[offset] + 1) * -1;
    };
    Buffer$1.prototype.readInt16LE = function readInt16LE(offset, noAssert) {
        if (!noAssert) checkOffset(offset, 2, this.length);
        var val = this[offset] | this[offset + 1] << 8;
        return val & 32768 ? val | 4294901760 : val;
    };
    Buffer$1.prototype.readInt16BE = function readInt16BE(offset, noAssert) {
        if (!noAssert) checkOffset(offset, 2, this.length);
        var val = this[offset + 1] | this[offset] << 8;
        return val & 32768 ? val | 4294901760 : val;
    };
    Buffer$1.prototype.readInt32LE = function readInt32LE(offset, noAssert) {
        if (!noAssert) checkOffset(offset, 4, this.length);
        return this[offset] | this[offset + 1] << 8 | this[offset + 2] << 16 | this[offset + 3] << 24;
    };
    Buffer$1.prototype.readInt32BE = function readInt32BE(offset, noAssert) {
        if (!noAssert) checkOffset(offset, 4, this.length);
        return this[offset] << 24 | this[offset + 1] << 16 | this[offset + 2] << 8 | this[offset + 3];
    };
    Buffer$1.prototype.readFloatLE = function readFloatLE(offset, noAssert) {
        if (!noAssert) checkOffset(offset, 4, this.length);
        return read(this, offset, true, 23, 4);
    };
    Buffer$1.prototype.readFloatBE = function readFloatBE(offset, noAssert) {
        if (!noAssert) checkOffset(offset, 4, this.length);
        return read(this, offset, false, 23, 4);
    };
    Buffer$1.prototype.readDoubleLE = function readDoubleLE(offset, noAssert) {
        if (!noAssert) checkOffset(offset, 8, this.length);
        return read(this, offset, true, 52, 8);
    };
    Buffer$1.prototype.readDoubleBE = function readDoubleBE(offset, noAssert) {
        if (!noAssert) checkOffset(offset, 8, this.length);
        return read(this, offset, false, 52, 8);
    };
    function checkInt(buf, value, offset, ext, max, min) {
        if (!internalIsBuffer(buf)) throw new TypeError("\"buffer\" argument must be a Buffer instance");
        if (value > max || value < min) throw new RangeError("\"value\" argument is out of bounds");
        if (offset + ext > buf.length) throw new RangeError("Index out of range");
    }
    Buffer$1.prototype.writeUIntLE = function writeUIntLE(value, offset, byteLength, noAssert) {
        value = +value;
        offset = offset | 0;
        byteLength = byteLength | 0;
        if (!noAssert) {
            var maxBytes = Math.pow(2, 8 * byteLength) - 1;
            checkInt(this, value, offset, byteLength, maxBytes, 0);
        }
        var mul = 1;
        var i = 0;
        this[offset] = value & 255;
        while (++i < byteLength && (mul *= 256)) this[offset + i] = value / mul & 255;
        return offset + byteLength;
    };
    Buffer$1.prototype.writeUIntBE = function writeUIntBE(value, offset, byteLength, noAssert) {
        value = +value;
        offset = offset | 0;
        byteLength = byteLength | 0;
        if (!noAssert) {
            var maxBytes = Math.pow(2, 8 * byteLength) - 1;
            checkInt(this, value, offset, byteLength, maxBytes, 0);
        }
        var i = byteLength - 1;
        var mul = 1;
        this[offset + i] = value & 255;
        while (--i >= 0 && (mul *= 256)) this[offset + i] = value / mul & 255;
        return offset + byteLength;
    };
    Buffer$1.prototype.writeUInt8 = function writeUInt8(value, offset, noAssert) {
        value = +value;
        offset = offset | 0;
        if (!noAssert) checkInt(this, value, offset, 1, 255, 0);
        if (!Buffer$1.TYPED_ARRAY_SUPPORT) value = Math.floor(value);
        this[offset] = value & 255;
        return offset + 1;
    };
    function objectWriteUInt16(buf, value, offset, littleEndian) {
        if (value < 0) value = 65535 + value + 1;
        for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; ++i) buf[offset + i] = (value & 255 << 8 * (littleEndian ? i : 1 - i)) >>> (littleEndian ? i : 1 - i) * 8;
    }
    Buffer$1.prototype.writeUInt16LE = function writeUInt16LE(value, offset, noAssert) {
        value = +value;
        offset = offset | 0;
        if (!noAssert) checkInt(this, value, offset, 2, 65535, 0);
        if (Buffer$1.TYPED_ARRAY_SUPPORT) {
            this[offset] = value & 255;
            this[offset + 1] = value >>> 8;
        } else objectWriteUInt16(this, value, offset, true);
        return offset + 2;
    };
    Buffer$1.prototype.writeUInt16BE = function writeUInt16BE(value, offset, noAssert) {
        value = +value;
        offset = offset | 0;
        if (!noAssert) checkInt(this, value, offset, 2, 65535, 0);
        if (Buffer$1.TYPED_ARRAY_SUPPORT) {
            this[offset] = value >>> 8;
            this[offset + 1] = value & 255;
        } else objectWriteUInt16(this, value, offset, false);
        return offset + 2;
    };
    function objectWriteUInt32(buf, value, offset, littleEndian) {
        if (value < 0) value = 4294967295 + value + 1;
        for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; ++i) buf[offset + i] = value >>> (littleEndian ? i : 3 - i) * 8 & 255;
    }
    Buffer$1.prototype.writeUInt32LE = function writeUInt32LE(value, offset, noAssert) {
        value = +value;
        offset = offset | 0;
        if (!noAssert) checkInt(this, value, offset, 4, 4294967295, 0);
        if (Buffer$1.TYPED_ARRAY_SUPPORT) {
            this[offset + 3] = value >>> 24;
            this[offset + 2] = value >>> 16;
            this[offset + 1] = value >>> 8;
            this[offset] = value & 255;
        } else objectWriteUInt32(this, value, offset, true);
        return offset + 4;
    };
    Buffer$1.prototype.writeUInt32BE = function writeUInt32BE(value, offset, noAssert) {
        value = +value;
        offset = offset | 0;
        if (!noAssert) checkInt(this, value, offset, 4, 4294967295, 0);
        if (Buffer$1.TYPED_ARRAY_SUPPORT) {
            this[offset] = value >>> 24;
            this[offset + 1] = value >>> 16;
            this[offset + 2] = value >>> 8;
            this[offset + 3] = value & 255;
        } else objectWriteUInt32(this, value, offset, false);
        return offset + 4;
    };
    Buffer$1.prototype.writeIntLE = function writeIntLE(value, offset, byteLength, noAssert) {
        value = +value;
        offset = offset | 0;
        if (!noAssert) {
            var limit = Math.pow(2, 8 * byteLength - 1);
            checkInt(this, value, offset, byteLength, limit - 1, -limit);
        }
        var i = 0;
        var mul = 1;
        var sub = 0;
        this[offset] = value & 255;
        while (++i < byteLength && (mul *= 256)) {
            if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) sub = 1;
            this[offset + i] = (value / mul >> 0) - sub & 255;
        }
        return offset + byteLength;
    };
    Buffer$1.prototype.writeIntBE = function writeIntBE(value, offset, byteLength, noAssert) {
        value = +value;
        offset = offset | 0;
        if (!noAssert) {
            var limit = Math.pow(2, 8 * byteLength - 1);
            checkInt(this, value, offset, byteLength, limit - 1, -limit);
        }
        var i = byteLength - 1;
        var mul = 1;
        var sub = 0;
        this[offset + i] = value & 255;
        while (--i >= 0 && (mul *= 256)) {
            if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) sub = 1;
            this[offset + i] = (value / mul >> 0) - sub & 255;
        }
        return offset + byteLength;
    };
    Buffer$1.prototype.writeInt8 = function writeInt8(value, offset, noAssert) {
        value = +value;
        offset = offset | 0;
        if (!noAssert) checkInt(this, value, offset, 1, 127, -128);
        if (!Buffer$1.TYPED_ARRAY_SUPPORT) value = Math.floor(value);
        if (value < 0) value = 255 + value + 1;
        this[offset] = value & 255;
        return offset + 1;
    };
    Buffer$1.prototype.writeInt16LE = function writeInt16LE(value, offset, noAssert) {
        value = +value;
        offset = offset | 0;
        if (!noAssert) checkInt(this, value, offset, 2, 32767, -32768);
        if (Buffer$1.TYPED_ARRAY_SUPPORT) {
            this[offset] = value & 255;
            this[offset + 1] = value >>> 8;
        } else objectWriteUInt16(this, value, offset, true);
        return offset + 2;
    };
    Buffer$1.prototype.writeInt16BE = function writeInt16BE(value, offset, noAssert) {
        value = +value;
        offset = offset | 0;
        if (!noAssert) checkInt(this, value, offset, 2, 32767, -32768);
        if (Buffer$1.TYPED_ARRAY_SUPPORT) {
            this[offset] = value >>> 8;
            this[offset + 1] = value & 255;
        } else objectWriteUInt16(this, value, offset, false);
        return offset + 2;
    };
    Buffer$1.prototype.writeInt32LE = function writeInt32LE(value, offset, noAssert) {
        value = +value;
        offset = offset | 0;
        if (!noAssert) checkInt(this, value, offset, 4, 2147483647, -2147483648);
        if (Buffer$1.TYPED_ARRAY_SUPPORT) {
            this[offset] = value & 255;
            this[offset + 1] = value >>> 8;
            this[offset + 2] = value >>> 16;
            this[offset + 3] = value >>> 24;
        } else objectWriteUInt32(this, value, offset, true);
        return offset + 4;
    };
    Buffer$1.prototype.writeInt32BE = function writeInt32BE(value, offset, noAssert) {
        value = +value;
        offset = offset | 0;
        if (!noAssert) checkInt(this, value, offset, 4, 2147483647, -2147483648);
        if (value < 0) value = 4294967295 + value + 1;
        if (Buffer$1.TYPED_ARRAY_SUPPORT) {
            this[offset] = value >>> 24;
            this[offset + 1] = value >>> 16;
            this[offset + 2] = value >>> 8;
            this[offset + 3] = value & 255;
        } else objectWriteUInt32(this, value, offset, false);
        return offset + 4;
    };
    function checkIEEE754(buf, value, offset, ext, max, min) {
        if (offset + ext > buf.length) throw new RangeError("Index out of range");
        if (offset < 0) throw new RangeError("Index out of range");
    }
    function writeFloat(buf, value, offset, littleEndian, noAssert) {
        if (!noAssert) checkIEEE754(buf, value, offset, 4);
        write(buf, value, offset, littleEndian, 23, 4);
        return offset + 4;
    }
    Buffer$1.prototype.writeFloatLE = function writeFloatLE(value, offset, noAssert) {
        return writeFloat(this, value, offset, true, noAssert);
    };
    Buffer$1.prototype.writeFloatBE = function writeFloatBE(value, offset, noAssert) {
        return writeFloat(this, value, offset, false, noAssert);
    };
    function writeDouble(buf, value, offset, littleEndian, noAssert) {
        if (!noAssert) checkIEEE754(buf, value, offset, 8);
        write(buf, value, offset, littleEndian, 52, 8);
        return offset + 8;
    }
    Buffer$1.prototype.writeDoubleLE = function writeDoubleLE(value, offset, noAssert) {
        return writeDouble(this, value, offset, true, noAssert);
    };
    Buffer$1.prototype.writeDoubleBE = function writeDoubleBE(value, offset, noAssert) {
        return writeDouble(this, value, offset, false, noAssert);
    };
    Buffer$1.prototype.copy = function copy(target, targetStart, start, end) {
        if (!start) start = 0;
        if (!end && end !== 0) end = this.length;
        if (targetStart >= target.length) targetStart = target.length;
        if (!targetStart) targetStart = 0;
        if (end > 0 && end < start) end = start;
        if (end === start) return 0;
        if (target.length === 0 || this.length === 0) return 0;
        if (targetStart < 0) throw new RangeError("targetStart out of bounds");
        if (start < 0 || start >= this.length) throw new RangeError("sourceStart out of bounds");
        if (end < 0) throw new RangeError("sourceEnd out of bounds");
        if (end > this.length) end = this.length;
        if (target.length - targetStart < end - start) end = target.length - targetStart + start;
        var len = end - start;
        var i;
        if (this === target && start < targetStart && targetStart < end) for (i = len - 1; i >= 0; --i) target[i + targetStart] = this[i + start];
        else if (len < 1e3 || !Buffer$1.TYPED_ARRAY_SUPPORT) for (i = 0; i < len; ++i) target[i + targetStart] = this[i + start];
        else Uint8Array.prototype.set.call(target, this.subarray(start, start + len), targetStart);
        return len;
    };
    Buffer$1.prototype.fill = function fill(val, start, end, encoding) {
        if (typeof val === "string") {
            if (typeof start === "string") {
                encoding = start;
                start = 0;
                end = this.length;
            } else if (typeof end === "string") {
                encoding = end;
                end = this.length;
            }
            if (val.length === 1) {
                var code = val.charCodeAt(0);
                if (code < 256) val = code;
            }
            if (encoding !== void 0 && typeof encoding !== "string") throw new TypeError("encoding must be a string");
            if (typeof encoding === "string" && !Buffer$1.isEncoding(encoding)) throw new TypeError("Unknown encoding: " + encoding);
        } else if (typeof val === "number") val = val & 255;
        if (start < 0 || this.length < start || this.length < end) throw new RangeError("Out of range index");
        if (end <= start) return this;
        start = start >>> 0;
        end = end === void 0 ? this.length : end >>> 0;
        if (!val) val = 0;
        var i;
        if (typeof val === "number") for (i = start; i < end; ++i) this[i] = val;
        else {
            var bytes = internalIsBuffer(val) ? val : utf8ToBytes(new Buffer$1(val, encoding).toString());
            var len = bytes.length;
            for (i = 0; i < end - start; ++i) this[i + start] = bytes[i % len];
        }
        return this;
    };
    var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g;
    function base64clean(str) {
        str = stringtrim(str).replace(INVALID_BASE64_RE, "");
        if (str.length < 2) return "";
        while (str.length % 4 !== 0) str = str + "=";
        return str;
    }
    function stringtrim(str) {
        if (str.trim) return str.trim();
        return str.replace(/^\s+|\s+$/g, "");
    }
    function toHex(n) {
        if (n < 16) return "0" + n.toString(16);
        return n.toString(16);
    }
    function utf8ToBytes(string, units) {
        units = units || Infinity;
        var codePoint;
        var length = string.length;
        var leadSurrogate = null;
        var bytes = [];
        for (var i = 0; i < length; ++i) {
            codePoint = string.charCodeAt(i);
            if (codePoint > 55295 && codePoint < 57344) {
                if (!leadSurrogate) {
                    if (codePoint > 56319) {
                        if ((units -= 3) > -1) bytes.push(239, 191, 189);
                        continue;
                    } else if (i + 1 === length) {
                        if ((units -= 3) > -1) bytes.push(239, 191, 189);
                        continue;
                    }
                    leadSurrogate = codePoint;
                    continue;
                }
                if (codePoint < 56320) {
                    if ((units -= 3) > -1) bytes.push(239, 191, 189);
                    leadSurrogate = codePoint;
                    continue;
                }
                codePoint = (leadSurrogate - 55296 << 10 | codePoint - 56320) + 65536;
            } else if (leadSurrogate) {
                if ((units -= 3) > -1) bytes.push(239, 191, 189);
            }
            leadSurrogate = null;
            if (codePoint < 128) {
                if ((units -= 1) < 0) break;
                bytes.push(codePoint);
            } else if (codePoint < 2048) {
                if ((units -= 2) < 0) break;
                bytes.push(codePoint >> 6 | 192, codePoint & 63 | 128);
            } else if (codePoint < 65536) {
                if ((units -= 3) < 0) break;
                bytes.push(codePoint >> 12 | 224, codePoint >> 6 & 63 | 128, codePoint & 63 | 128);
            } else if (codePoint < 1114112) {
                if ((units -= 4) < 0) break;
                bytes.push(codePoint >> 18 | 240, codePoint >> 12 & 63 | 128, codePoint >> 6 & 63 | 128, codePoint & 63 | 128);
            } else throw new Error("Invalid code point");
        }
        return bytes;
    }
    function asciiToBytes(str) {
        var byteArray = [];
        for (var i = 0; i < str.length; ++i) byteArray.push(str.charCodeAt(i) & 255);
        return byteArray;
    }
    function utf16leToBytes(str, units) {
        var c;
        var hi;
        var lo;
        var byteArray = [];
        for (var i = 0; i < str.length; ++i) {
            if ((units -= 2) < 0) break;
            c = str.charCodeAt(i);
            hi = c >> 8;
            lo = c % 256;
            byteArray.push(lo);
            byteArray.push(hi);
        }
        return byteArray;
    }
    function base64ToBytes(str) {
        return toByteArray(base64clean(str));
    }
    function blitBuffer(src, dst, offset, length) {
        for (var i = 0; i < length; ++i) {
            if (i + offset >= dst.length || i >= src.length) break;
            dst[i + offset] = src[i];
        }
        return i;
    }
    function isnan(val) {
        return val !== val;
    }
    function isBuffer(obj) {
        return obj != null && (!!obj._isBuffer || isFastBuffer(obj) || isSlowBuffer(obj));
    }
    function isFastBuffer(obj) {
        return !!obj.constructor && typeof obj.constructor.isBuffer === "function" && obj.constructor.isBuffer(obj);
    }
    function isSlowBuffer(obj) {
        return typeof obj.readFloatLE === "function" && typeof obj.slice === "function" && isFastBuffer(obj.slice(0, 0));
    }

    //#endregion
    //#region lana/src/stubs/path.ts
    function basename(p, ext) {
        const base = p.split("/").pop() ?? "";
        return ext && base.endsWith(ext) ? base.slice(0, -ext.length) : base;
    }
    function extname(p) {
        const base = basename(p);
        const i = base.lastIndexOf(".");
        return i > 0 ? base.slice(i) : "";
    }

    //#endregion
    //#region lana/src/language/ApexLogLanguageDetector.ts
    const APEXLOG_HEADER = /^(\d\d\.\d.+?)?APEX_CODE,\w.+$/;
    const EXECUTION_STARTED = /^\d{2}:\d{2}:\d{2}\.\d{1,} \(\d+\)\|EXECUTION_STARTED$/;
    const USER_INFO = /^\d{2}:\d{2}:\d{2}\.\d{1,} \(\d+\)\|USER_INFO\|/;
    const DETECT_EXTENSIONS = new Set([".log", ".txt"]);
    const MAX_LINES_TO_CHECK = 100;
    function isApexLogContent(doc) {
        if (doc.lineCount === 0) return false;
        const linesToCheck = Math.min(MAX_LINES_TO_CHECK, doc.lineCount);
        for (let i = 0; i < linesToCheck; i++) {
            const text = doc.lineAt(i).text;
            if (APEXLOG_HEADER.test(text) || EXECUTION_STARTED.test(text) || USER_INFO.test(text)) return true;
        }
        return false;
    }
    function isApexLogFile(fsPath) {
        let fd;
        try {
            fd = openSync(fsPath, "r");
        } catch {
            return false;
        }
        try {
            const buf = Buffer$1.alloc(4096);
            const bytesRead = readSync(fd, buf, 0, 4096, 0);
            const lines = buf.toString("utf8", 0, bytesRead).split(/\r?\n/);
            const linesToCheck = Math.min(MAX_LINES_TO_CHECK, lines.length);
            for (let i = 0; i < linesToCheck; i++) {
                const line = lines[i] ?? "";
                if (APEXLOG_HEADER.test(line) || EXECUTION_STARTED.test(line) || USER_INFO.test(line)) return true;
            }
            return false;
        } finally {
            /* @__PURE__ */ closeSync(fd);
        }
    }
    function hasDetectExtension(uri) {
        return DETECT_EXTENSIONS.has(extname(uri.fsPath).toLowerCase());
    }
    function getActiveTabUri() {
        const activeTab = window$1.tabGroups.activeTabGroup.activeTab;
        if (activeTab?.input instanceof TabInputText) return activeTab.input.uri;
    }
    function updateContextKey() {
        const editor = window$1.activeTextEditor;
        if (editor && editor.document.uri.scheme === "file") {
            const doc = editor.document;
            if (hasDetectExtension(doc.uri)) {
                const detected = isApexLogContent(doc);
                commands.executeCommand("setContext", "lana.isApexLog", detected);
                return;
            }
            commands.executeCommand("setContext", "lana.isApexLog", false);
            return;
        }
        const tabUri = getActiveTabUri();
        if (tabUri && tabUri.scheme === "file" && hasDetectExtension(tabUri)) {
            const detected = isApexLogFile(tabUri.fsPath);
            commands.executeCommand("setContext", "lana.isApexLog", detected);
            return;
        }
        commands.executeCommand("setContext", "lana.isApexLog", false);
    }
    var ApexLogLanguageDetector = class {
        static apply(context) {
            for (const doc of workspace.textDocuments) detectAndSetLanguage(doc);
            context.context.disposables.push(workspace.onDidOpenTextDocument((doc) => {
                detectAndSetLanguage(doc);
            }));
            context.context.disposables.push(window$1.onDidChangeActiveTextEditor(() => {
                updateContextKey();
            }));
            context.context.disposables.push(window$1.tabGroups.onDidChangeTabs(() => {
                updateContextKey();
            }));
            updateContextKey();
        }
    };
    function detectAndSetLanguage(doc) {
        if (doc.languageId === "apexlog" || doc.uri.scheme !== "file") return;
        if (!hasDetectExtension(doc.uri)) return;
        if (isApexLogContent(doc)) languages.setTextDocumentLanguage(doc, "apexlog");
    }

    //#endregion
    //#region lana/src/codelenses/ShowAnalysisCodeLens.ts
    var ShowAnalysisCodeLens = class ShowAnalysisCodeLens {
        constructor(context) {
            this.context = context;
        }
        async provideCodeLenses(document) {
            if (!isApexLogContent(document)) return [];
            const topOfDocument = new Range(0, 0, 0, 0);
            const command = ShowLogAnalysis.getCommand(this.context);
            return [new CodeLens(topOfDocument, {
                command: command.fullName,
                title: command.title
            })];
        }
        static apply(context) {
            const codeLensProviderDisposable = languages.registerCodeLensProvider([
                {
                    scheme: "file",
                    language: "apexlog"
                },
                {
                    scheme: "file",
                    pattern: "**/*.log"
                },
                {
                    scheme: "file",
                    pattern: "**/*.txt"
                }
            ], new ShowAnalysisCodeLens(context));
            context.context.disposables.push(codeLensProviderDisposable);
        }
    };

    //#endregion
    //#region lana/src/commands/ShowInLogAnalysis.ts
    var ShowInLogAnalysis = class ShowInLogAnalysis {
        static apply(context) {
            new Command("showInLogAnalysis", "Log: Show in Log Analysis", (args) => ShowInLogAnalysis.execute(context, args)).register(context);
        }
        static async execute(context, args) {
            const { timestamp, filePath } = args;
            if (!timestamp) return;
            let panel = BrowserLogView.getCurrentView();
            const logPath = BrowserLogView.getLogPath();
            if (!panel) {
                const activeEditor = window$1.activeTextEditor;
                const logFilePath = filePath ?? activeEditor?.document.uri.fsPath;
                if (!logFilePath) {
                    context.display.showInformationMessage("No active Apex log file.");
                    return;
                }
                BrowserLogView.setPendingNavigation(timestamp);
                panel = await BrowserLogView.createView(context, Promise.resolve(), logFilePath);
                return;
            } else {
                panel.reveal();
                const activeEditor = window$1.activeTextEditor;
                if (logPath && activeEditor && activeEditor.document.uri.fsPath !== logPath) {
                    BrowserLogView.setPendingNavigation(timestamp);
                    await BrowserLogView.createView(context, Promise.resolve(), activeEditor.document.uri.fsPath);
                    return;
                }
            }
            panel.webview.postMessage({
                cmd: "navigateToTimeline",
                payload: { timestamp }
            });
        }
    };

    //#endregion
    //#region lana/src/commands/SwitchTimelineTheme.ts
    var SwitchTimelineTheme = class SwitchTimelineTheme {
        static getCommand(context) {
            return new Command("switchTimelineTheme", "Log: Timeline Theme", (uri) => SwitchTimelineTheme.safeCommand(context, uri));
        }
        static apply(context) {
            SwitchTimelineTheme.getCommand(context).register(context);
            context.display.output(`Registered command '${appName}: Timeline Theme'`);
        }
        static async safeCommand(context, uri) {
            try {
                return SwitchTimelineTheme.command(context, uri);
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                context.display.showErrorMessage(`Error changing timeline theme: ${msg}`);
                return Promise.resolve();
            }
        }
        static async command(_context, _uri) {
            const config = getConfig();
            const items = THEMES.map((label) => ({
                label,
                description: label === DEFAULT_THEME ? "default" : ""
            }));
            const builtInThemesNames = new Set(THEMES);
            for (const customThemeName of Object.keys(config.timeline.customThemes ?? {})) if (!builtInThemesNames.has(customThemeName)) items.push({
                label: customThemeName,
                description: "custom"
            });
            items.sort((a, b) => a.label.localeCompare(b.label));
            const pick = window$1.createQuickPick();
            pick.items = items;
            pick.placeholder = "Select Timeline Theme...";
            let activeTheme = config.timeline.activeTheme || DEFAULT_THEME;
            const activeItem = items.find((item) => item.label === activeTheme);
            if (activeItem) pick.activeItems = [activeItem];
            let selectedTheme = activeTheme;
            pick.onDidChangeActive(async (selection) => {
                selectedTheme = selection[0]?.label ?? "";
                SwitchTimelineTheme.switchTheme(selectedTheme);
            });
            pick.onDidAccept(async () => {
                if (selectedTheme) {
                    activeTheme = selectedTheme;
                    await updateConfig("timeline.activeTheme", selectedTheme);
                    pick.hide();
                }
            });
            pick.onDidHide(() => {
                pick.dispose();
                if (selectedTheme !== activeTheme) SwitchTimelineTheme.switchTheme(activeTheme);
            });
            pick.show();
        }
        static switchTheme(activeTheme) {
            const currentView = BrowserLogView.getCurrentView();
            if (currentView) currentView.webview.postMessage({
                cmd: "switchTimelineTheme",
                payload: { activeTheme }
            });
        }
    };
    const THEMES = [
        "50 Shades of Green Bright",
        "50 Shades of Green",
        "Botanical Twilight",
        "Catppuccin",
        "Chrome",
        "Dracula",
        "Dusty Aurora",
        "Firefox",
        "Flame",
        "Forest Floor",
        "Garish",
        "Material",
        "Modern",
        "Monokai Pro",
        "Nord",
        "Nord Forest",
        "Okabe-Ito",
        "Salesforce",
        "Solarized"
    ].sort();
    const DEFAULT_THEME = "50 Shades of Green";

    //#endregion
    //#region lana/src/log-utils.ts
    /** Regex to extract nanosecond timestamp from log line. Format: "HH:MM:SS.d (nanoseconds)|EVENT_TYPE" */
    const TIMESTAMP_REGEX = /^\d{2}:\d{2}:\d{2}\.\d+\s*\((\d+)\)\|/;
    /** Format nanoseconds as human-readable duration (e.g., "1.23s", "45.67ms", "2m 30.00s") */
    function formatDuration(nanoseconds) {
        const milliseconds = nanoseconds / 1e6;
        const seconds = milliseconds / 1e3;
        if (seconds >= 60) return `${Math.floor(seconds / 60)}m ${(seconds % 60).toFixed(2)}s`;
        else if (seconds >= 1) return `${seconds.toFixed(2)}s`;
        else return `${milliseconds.toFixed(2)}ms`;
    }
    /** Build metric parts for hover/decoration display from a LogEvent */
    function buildMetricParts(event) {
        const parts = [];
        const totalDuration = formatDuration(event.duration.total);
        if (event.duration.self !== event.duration.total) parts.push(`**${totalDuration}** (self: ${formatDuration(event.duration.self)})`);
        else parts.push(`**${totalDuration}**`);
        if (event.soqlCount.total > 0) {
            const selfPart = event.soqlCount.self > 0 ? ` (self: ${event.soqlCount.self})` : "";
            parts.push(`${event.soqlCount.total} SOQL${selfPart}`);
        }
        if (event.soqlRowCount.total > 0) parts.push(`${event.soqlRowCount.total} rows`);
        if (event.dmlCount.total > 0) {
            const selfPart = event.dmlCount.self > 0 ? ` (self: ${event.dmlCount.self})` : "";
            parts.push(`${event.dmlCount.total} DML${selfPart}`);
        }
        if (event.dmlRowCount.total > 0) parts.push(`${event.dmlRowCount.total} DML rows`);
        if (event.totalThrownCount > 0) parts.push(`\u26a0\ufe0f ${event.totalThrownCount} thrown`);
        return parts;
    }

    //#endregion
    //#region lana/src/decorations/LogTimingDecoration.ts
    const executionStartedRegex = /^\d{2}:\d{2}:\d{2}\.\d+\s*\((\d+)\)\|EXECUTION_STARTED/m;
    const decorationType = window$1.createTextEditorDecorationType({
        after: {
            margin: "0 0 0 2em",
            color: "#888888"
        },
        isWholeLine: true
    });
    var LogTimingDecoration = class LogTimingDecoration {
        static {
            this.instance = null;
        }
        constructor(context) {
            this.context = context;
        }
        static apply(context) {
            if (LogTimingDecoration.instance) return;
            LogTimingDecoration.instance = new LogTimingDecoration(context.context);
            LogTimingDecoration.instance.register();
        }
        register() {
            if (window$1.activeTextEditor) this.updateDecorations(window$1.activeTextEditor);
            this.context.disposables.push(window$1.onDidChangeActiveTextEditor((editor) => {
                if (editor) this.updateDecorations(editor);
            }));
            this.context.disposables.push(workspace.onDidChangeTextDocument((event) => {
                const editor = window$1.activeTextEditor;
                if (editor && event.document === editor.document) this.updateDecorations(editor);
            }));
            this.context.disposables.push(workspace.onDidOpenTextDocument((doc) => {
                const editor = window$1.activeTextEditor;
                if (editor && editor.document === doc) this.updateDecorations(editor);
            }));
        }
        updateDecorations(editor) {
            const document = editor.document;
            if (!isApexLogContent(document)) {
                editor.setDecorations(decorationType, []);
                return;
            }
            const duration = this.calculateLogDuration(document);
            if (duration === null) {
                editor.setDecorations(decorationType, []);
                return;
            }
            const formattedDuration = formatDuration(duration);
            const startLine = this.findFirstLogLine(document);
            if (startLine === null) {
                editor.setDecorations(decorationType, []);
                return;
            }
            const decoration = {
                range: document.lineAt(startLine).range,
                renderOptions: { after: { contentText: `⏱ ${formattedDuration}` } }
            };
            editor.setDecorations(decorationType, [decoration]);
        }
        findFirstLogLine(doc) {
            const limit = Math.min(1e3, doc.lineCount);
            for (let i = 0; i < limit; i++) {
                const text = doc.lineAt(i).text;
                if (APEXLOG_HEADER.test(text) || TIMESTAMP_REGEX.test(text)) return i;
            }
            return null;
        }
        calculateLogDuration(document) {
            const startTs = this.findTimestamp(document, false, executionStartedRegex);
            const endTs = this.findTimestamp(document, true, TIMESTAMP_REGEX);
            return startTs && endTs && endTs > startTs ? endTs - startTs : null;
        }
        findTimestamp(doc, fromEnd, pattern) {
            const limit = Math.min(1e3, doc.lineCount);
            const start = fromEnd ? doc.lineCount - 1 : 0;
            const step = fromEnd ? -1 : 1;
            for (let i = 0; i < limit; i++) {
                const match = doc.lineAt(start + i * step).text.match(pattern);
                if (match?.[1]) return parseInt(match[1], 10);
            }
            return null;
        }
    };

    //#endregion
    //#region lana/src/decorations/RawLogLineDecoration.ts
    const cursorLineDecorationType = window$1.createTextEditorDecorationType({ after: {
        margin: "0 0 0 2em",
        color: "#888888"
    } });
    var RawLogLineDecoration = class RawLogLineDecoration {
        static {
            this.instance = null;
        }
        constructor(context) {
            this.debounceTimeout = null;
            this.context = context;
        }
        static apply(context) {
            if (RawLogLineDecoration.instance) return;
            RawLogLineDecoration.instance = new RawLogLineDecoration(context.context);
            RawLogLineDecoration.instance.register();
        }
        register() {
            this.context.disposables.push(window$1.onDidChangeTextEditorSelection((event) => {
                this.handleSelectionChange(event);
            }));
            this.context.disposables.push(window$1.onDidChangeActiveTextEditor((editor) => {
                if (editor) this.clearDecorations(editor);
            }));
        }
        handleSelectionChange(event) {
            if (this.debounceTimeout) clearTimeout(this.debounceTimeout);
            this.debounceTimeout = setTimeout(() => {
                this.updateDecoration(event.textEditor);
            }, 100);
        }
        async updateDecoration(editor) {
            const document = editor.document;
            if (!isApexLogContent(document)) {
                this.clearDecorations(editor);
                return;
            }
            const selection = editor.selection;
            const line = document.lineAt(selection.active.line);
            const match = line.text.match(TIMESTAMP_REGEX);
            if (!match?.[1]) {
                this.clearDecorations(editor);
                return;
            }
            const timestamp = parseInt(match[1], 10);
            const filePath = document.uri.fsPath;
            const apexLog = await LogEventCache.getApexLog(filePath);
            if (!apexLog) {
                this.clearDecorations(editor);
                return;
            }
            const result = LogEventCache.findEventByTimestamp(apexLog, timestamp);
            if (!result) {
                this.clearDecorations(editor);
                return;
            }
            const { event } = result;
            const durationText = this.formatDurationText(event.duration.total, event.duration.self);
            const endOfLine = line.range.end;
            const decoration = {
                range: new Range(endOfLine, endOfLine),
                hoverMessage: this.buildHoverMessage(event, timestamp, filePath),
                renderOptions: { after: { contentText: durationText } }
            };
            editor.setDecorations(cursorLineDecorationType, [decoration]);
        }
        clearDecorations(editor) {
            editor.setDecorations(cursorLineDecorationType, []);
        }
        buildHoverMessage(event, timestamp, filePath) {
            const commandUri = `command:lana.showInLogAnalysis?${encodeURIComponent(JSON.stringify({
                timestamp,
                filePath
            }))}`;
            const metricParts = buildMetricParts(event);
            const parts = [];
            if (metricParts.length > 0) {
                parts.push(metricParts.join(" · "));
                parts.push("---");
            }
            parts.push(`[Show in Log Analysis](${commandUri})`);
            const markdown = new MarkdownString(parts.join("\n\n"), true);
            markdown.isTrusted = true;
            return markdown;
        }
        formatDurationText(totalNs, selfNs) {
            const total = formatDuration(totalNs);
            if (selfNs !== totalNs && selfNs > 0) return `${total} (self: ${formatDuration(selfNs)})`;
            return total;
        }
    };

    //#endregion
    //#region lana/src/display/Display.ts
    var Display = class {
        constructor() {
            this.outputChannel = window$1.createOutputChannel(appName);
        }
        output(message, showChannel = false) {
            if (showChannel) this.outputChannel.show(true);
            this.outputChannel.appendLine(message);
        }
        showInformationMessage(s) {
            window$1.showInformationMessage(s);
        }
        showErrorMessage(s, options = {}) {
            window$1.showErrorMessage(s, options);
        }
        showFile(path, options = {}) {
            commands.executeCommand("vscode.open", Uri.file(path.trim()), options);
        }
    };

    //#endregion
    //#region lana/src/folding/RawLogFoldingProvider.ts
    var RawLogFoldingProvider = class RawLogFoldingProvider {
        async provideFoldingRanges(document, _context) {
            const filePath = document.uri.fsPath;
            const apexLog = await LogEventCache.getApexLog(filePath);
            if (!apexLog) return [];
            const timestampToLine = this.buildTimestampMap(document);
            const ranges = [];
            this.collectFoldingRanges(apexLog.children, timestampToLine, ranges);
            return ranges;
        }
        buildTimestampMap(document) {
            const map = /* @__PURE__ */ new Map();
            for (let i = 0; i < document.lineCount; i++) {
                const match = document.lineAt(i).text.match(TIMESTAMP_REGEX);
                if (match?.[1]) {
                    const timestamp = parseInt(match[1], 10);
                    if (!map.has(timestamp)) map.set(timestamp, i);
                }
            }
            return map;
        }
        collectFoldingRanges(events, timestampToLine, ranges) {
            for (const event of events) {
                if (event.exitStamp !== null && event.exitStamp !== event.timestamp) {
                    const startLine = timestampToLine.get(event.timestamp);
                    const endLine = timestampToLine.get(event.exitStamp);
                    if (startLine !== void 0 && endLine !== void 0 && endLine > startLine) ranges.push(new FoldingRange(startLine, endLine, FoldingRangeKind.Region));
                }
                if (event.children.length > 0) this.collectFoldingRanges(event.children, timestampToLine, ranges);
            }
        }
        static apply(context) {
            const disposable = languages.registerFoldingRangeProvider([{
                scheme: "file",
                language: "apexlog"
            }], new RawLogFoldingProvider());
            context.context.disposables.push(disposable);
        }
    };

    //#endregion
    //#region lana/src/workspace/VSWorkspace.ts
    var VSWorkspace = class {
        constructor(workspaceFolder) {
            this.workspaceFolder = workspaceFolder;
        }
        path() {
            return this.workspaceFolder.uri.fsPath;
        }
        name() {
            return this.workspaceFolder.name;
        }
    };

    //#endregion
    //#region lana/src/cache/LogEventCache.ts
    var LogEventCache = class LogEventCache {
        static {
            this.MAX_CACHE_SIZE = 10;
        }
        static {
            this.cache = /* @__PURE__ */ new Map();
        }
        static async getApexLog(filePath) {
            const cached = LogEventCache.cache.get(filePath);
            if (cached) {
                LogEventCache.cache.delete(filePath);
                LogEventCache.cache.set(filePath, cached);
                return cached;
            }
            try {
                const apexLog = parse(await readFile(filePath, "utf-8"));
                if (LogEventCache.cache.size >= LogEventCache.MAX_CACHE_SIZE) {
                    const oldest = LogEventCache.cache.keys().next().value;
                    if (oldest) LogEventCache.cache.delete(oldest);
                }
                LogEventCache.cache.set(filePath, apexLog);
                return apexLog;
            } catch {
                return null;
            }
        }
        static findEventByTimestamp(apexLog, timestamp) {
            return LogEventCache.searchEvents(apexLog.children, timestamp, 0);
        }
        static clearCache(filePath) {
            LogEventCache.cache.delete(filePath);
        }
        static apply(context) {
            context.context.disposables.push(workspace.onDidCloseTextDocument((doc) => {
                if (doc.languageId === "apexlog") LogEventCache.clearCache(doc.uri.fsPath);
            }));
        }
        static searchEvents(events, timestamp, depth) {
            let start = 0;
            let end = events.length - 1;
            while (start <= end) {
                const mid = Math.floor((start + end) / 2);
                const event = events[mid];
                if (!event) break;
                const endTime = event.exitStamp ?? event.timestamp;
                if (timestamp === event.timestamp) return {
                    event,
                    depth
                };
                if (timestamp >= event.timestamp && timestamp <= endTime) return (event.children.length > 0 ? LogEventCache.searchEvents(event.children, timestamp, depth + 1) : null) ?? {
                    event,
                    depth
                };
                if (timestamp > endTime) start = mid + 1;
                else end = mid - 1;
            }
            return null;
        }
    };

    //#endregion
    //#region lana/src/commands/BrowserShowLogAnalysis.ts
    /**
    * Browser-safe variant of ShowLogAnalysis.
    * Replaces the Node.js existsSync check with reading content from the active text editor document,
    * since the virtual filesystem in the browser does not support synchronous fs access.
    */
    var BrowserShowLogAnalysis = class BrowserShowLogAnalysis {
        static getCommand(context) {
            return new Command("showLogAnalysis", "Log: Show Apex Log Analysis", (uri) => BrowserShowLogAnalysis.safeCommand(context, uri));
        }
        static apply(context) {
            console.log('BrowserShowLogAnalysis.apply', context);
            BrowserShowLogAnalysis.getCommand(context).register(context);
            context.display.output(`Registered command '${appName}: Show Log'`);
        }
        static async safeCommand(context, uri) {
            try {
                return BrowserShowLogAnalysis.command(context, uri);
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                context.display.showErrorMessage(`Error showing logfile: ${msg}`);
                return Promise.resolve();
            }
        }
        static async command(context, uri) {
            const activeDocument = window$1?.activeTextEditor?.document;
            const filePath = uri?.path || activeDocument?.uri.path || "";
            const fileContent = activeDocument?.getText() ?? "";
            if (filePath || fileContent) BrowserLogView.createView(context, Promise.resolve(), filePath, fileContent);
            else {
                context.display.showErrorMessage("No file selected or the file is too large. Try again using the file explorer or text editor command.");
                throw new Error("No file selected or the file is too large. Try again using the file explorer or text editor command.");
            }
        }
    };

    //#endregion
    //#region lana/src/BrowserContext.ts
    /**
    * Browser-only bootstrap: same as Context but without Node.js-only features.
    * Excluded: RetrieveLogFile (requires @salesforce/core), OpenFileInPackage (requires @apexdevtools/apex-ls).
    * The browser build aliases LogView → BrowserLogView via the rollup/rolldown build config.
    */
    var BrowserContext = class {
        constructor(context, display) {
            this.workspaces = [];
            this.context = context;
            this.display = display;
            if (workspace.workspaceFolders) this.workspaces = workspace.workspaceFolders.map((folder) => {
                return new VSWorkspace(folder);
            });
            ApexLogLanguageDetector.apply(this);
            LogEventCache.apply(this);
            BrowserShowLogAnalysis.apply(this);
            ShowInLogAnalysis.apply(this);
            SwitchTimelineTheme.apply(this);
            ShowAnalysisCodeLens.apply(this);
            LogTimingDecoration.apply(this);
            RawLogLineDecoration.apply(this);
            RawLogFoldingProvider.apply(this);
        }
    };

    //#endregion
    //#region lana/src/browser.ts
    let context = null;
    function activate(extensionContext) {
        context = new BrowserContext(extensionContext, new Display());
    }
    function deactivate() {
        context = null;
    }

    //#endregion
    return { 
        activate, 
        context, 
        deactivate 
    };
}