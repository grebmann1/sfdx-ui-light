"use strict";
(self["webpackChunkmonaco_languageclient_lwc"] = self["webpackChunkmonaco_languageclient_lwc"] || []).push([["lib_vscode_terminalBackend_js"],{

/***/ "./lib/vscode/terminalBackend.js"
/*!***************************************!*\
  !*** ./lib/vscode/terminalBackend.js ***!
  \***************************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   BrowserTerminalBackend: () => (/* binding */ BrowserTerminalBackend)
/* harmony export */ });
/* harmony import */ var _codingame_monaco_vscode_api_vscode_vs_base_common_event__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @codingame/monaco-vscode-api/vscode/vs/base/common/event */ "./node_modules/@codingame/monaco-vscode-api/vscode/src/vs/base/common/event.js");
/* harmony import */ var _codingame_monaco_vscode_terminal_service_override__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @codingame/monaco-vscode-terminal-service-override */ "./node_modules/@codingame/monaco-vscode-terminal-service-override/index.js");


class BrowserTerminalProcess extends _codingame_monaco_vscode_terminal_service_override__WEBPACK_IMPORTED_MODULE_1__.SimpleTerminalProcess {
    _onData = new _codingame_monaco_vscode_api_vscode_vs_base_common_event__WEBPACK_IMPORTED_MODULE_0__.Emitter();
    onProcessData = this._onData.event;
    _onExit = new _codingame_monaco_vscode_api_vscode_vs_base_common_event__WEBPACK_IMPORTED_MODULE_0__.Emitter();
    onProcessExit = this._onExit.event;
    _onDidChangeProperty = new _codingame_monaco_vscode_api_vscode_vs_base_common_event__WEBPACK_IMPORTED_MODULE_0__.Emitter();
    onDidChangeProperty = this._onDidChangeProperty.event;
    _buffer = [];
    _closed = false;
    constructor(id, pid, cwd) {
        super(id, pid, cwd, _codingame_monaco_vscode_api_vscode_vs_base_common_event__WEBPACK_IMPORTED_MODULE_0__.Event.None);
    }
    sendSignal(_signal) {
        // No-op for browser backend
    }
    clearBuffer() {
        // No-op; xterm buffer is managed in the frontend.
    }
    async start() {
        // Minimal "shell" to prove terminal wiring works.
        queueMicrotask(() => {
            this._onData.fire('\x1b[1mBrowser terminal\x1b[0m\r\n$ ');
        });
        return { injectedArgs: [] };
    }
    shutdown(_immediate) {
        if (this._closed)
            return;
        this._closed = true;
        this._onExit.fire(0);
        this._onExit.dispose();
        this._onDidChangeProperty.dispose();
    }
    input(data) {
        if (this._closed)
            return;
        // Echo input; on Enter, "execute" and show a new prompt.
        for (const ch of data) {
            if (ch === '\r' || ch === '\n') {
                const line = this._buffer.join('');
                this._buffer.length = 0;
                this._onData.fire('\r\n');
                if (line.trim().length > 0) {
                    this._onData.fire(`(echo) ${line}\r\n`);
                }
                this._onData.fire('$ ');
            }
            else if (ch === '\u007f') {
                // backspace
                if (this._buffer.length > 0) {
                    this._buffer.pop();
                    this._onData.fire('\b \b');
                }
            }
            else {
                this._buffer.push(ch);
                this._onData.fire(ch);
            }
        }
    }
    resize(_cols, _rows) {
        // No-op for browser backend
    }
}
class BrowserTerminalBackend extends _codingame_monaco_vscode_terminal_service_override__WEBPACK_IMPORTED_MODULE_1__.SimpleTerminalBackend {
    _nextId = 1;
    getDefaultSystemShell = async () => {
        return 'browser';
    };
    createProcess = async (shellLaunchConfig, cwd, cols, rows, _unicodeVersion, _env, _options, shouldPersist) => {
        if (typeof shellLaunchConfig.customPtyImplementation === 'function') {
            const custom = shellLaunchConfig.customPtyImplementation(this._nextId++, cols, rows);
            custom.shouldPersist = shouldPersist;
            return custom;
        }
        const id = this._nextId++;
        const pid = 10000 + id;
        const proc = new BrowserTerminalProcess(id, pid, cwd || '/');
        proc.shouldPersist = shouldPersist;
        return proc;
    };
}
//# sourceMappingURL=terminalBackend.js.map

/***/ }

}]);