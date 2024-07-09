import { api } from "lwc";
import { decodeError,isNotUndefinedOrNull,isUndefinedOrNull } from 'shared/utils';
import ToolkitElement from 'core/toolkitElement';
import xterm from 'xterm';
import { theme } from './theme';
export default class Pmd extends ToolkitElement {
    terminal;
    currCommand = '';
    @api pmdPath;
    @api
    get projectPath(){
        return this._projectPath;
    }
    set projectPath(value){
        this._projectPath = value;
    }

    connectedCallback(){
        //console.log('xterm',xterm);
        setTimeout(() => {
            //this.createTerminal();
        },300);
    }

    disconnectedCallbak(){
        this.terminal.destroy();
        this.terminal = new Terminal({
            fontFamily:
            "FiraCode, SFMono-Regular, Consolas, 'Liberation Mono', Menlo, Courier, monospace",
            fontSize: 13,
            lineHeight: 1.3,
            theme: theme
        });
        this.terminal.write('$'); // this.projectPath + '\r\n' 
    }

    renderedCallback() {
        if (!this.isReady) {
            this.isReady = true;
            //this.createTerminal();
        }
    }


    /** Events **/
    
    handleBasicRun = () => {
        this.runSfdxAnalyzer();
    }

    /** Methods  **/
    
    createTerminal = () => {
        const terminalTheme = {
            background: "#151515",
            foreground: theme.colors["neutral-fg-high"],
            cursor: theme.colors["neutral-fg-high"],
            cursorAccent: theme.colors["neutral-fg-high"],
            brightGreen: "#85CEA8",
            brightMagenta: theme.colors["accent-secondary-base"],
            magenta: "#7660B9",
            green: "#319382",
            yellow: theme.colors["informative-warning-base"],
            brightYellow: theme.colors["informative-warning-base"],
            red: theme.colors["informative-error-base"],
            // Not red and cyan but style the colors used in the prompt header.
            brightRed: "#808080",
            brightCyan: theme.colors["accent-primary-base"],
        }
        this.terminal = new xterm.Terminal({
            cursorStyle:'block',
            cursorBlink:true,
            fontFamily:
            "FiraCode, SFMono-Regular, Consolas, 'Liberation Mono', Menlo, Courier, monospace",
            theme: terminalTheme,
            fontSize: 13,
            lineHeight: 1.3,
        });
        this.terminal.attachCustomKeyEventHandler((arg) => {
            if((arg.ctrlKey || arg.metaKey) && arg.code === "KeyV" && arg.type === "keydown") {
                navigator.clipboard.readText()
                .then(text => {
                    this.currCommand = text;
                    this.terminal.write(text);
                })
            };
            return true;
        });
        this.terminal.open(this.refs.container);
        this.terminal.write('$'); // this.projectPathDisplayed + '\r\n' + 

        this.terminal.onKey(({ key, domEvent }) => {
            const fileManipulation = new Set(['cp', 'mkdir', 'touch', 'rm', 'rmdir', 'mv']);
            switch (domEvent.keyCode) {
                
                //When a user hits enter, clean up the input for execution of the command within node child_process
                case 13:
                    let output;
                    let command = this.currCommand;
                    let newPath;
                    //Check for cd to be handled on the front-end without communication with spawn
                    if (command.split(' ')[0] === 'cd' && command.split(' ').length === 2) {
                        newPath = path.join(this.projectPath, command.split(' ')[1]);
                        this.projectPath = newPath
                        greeting = newPath;
                        this.terminal.write('\r\n' + greeting + '\r\n');
                        this.terminal.write('$');
                        //Check for cd with other options, strip the cd command away and run the rest of the command in spawn
                    } else {
                        if (command.split(' ')[0] === 'cd' && command.split(' ').length > 2) {
                            newPath = path.join(this.projectPath, command.split(' ')[1]);
                            this.projectPath = newPath;
                            greeting = newPath;
                            command = command.split(' ').slice(2).join(' ');
                        }
                        this.runTerminal(this.projectPath, command);
                    }
                    //Clear state for the next command
                    this.currCommand = ''
                    break;
                    //When a backspace is hit, write it, then delete the latest char from the curr Command
                case 8:
                    this.terminal.write('\b \b');
                    this.currCommand = this.currCommand.slice(0, -1);
                    break;
                default:
                    //console.log('key',key);
                    //Disable left and right keys from changing state, only allow them to change how the terminal looks
                    if (domEvent.keyCode === 37) {
                        this.terminal.write(key);
                        this.cursorIndex = this.cursorIndex - 1;
                    } else if (domEvent.keyCode === 39) {
                        this.terminal.write(key);
                        this.cursorIndex = this.cursorIndex + 1;
                    } else {
                        this.terminal.write(key);
                        this.currCommand = this.currCommand + key;
                        this.cursorIndex = this.cursorIndex + 1;
                    }
            }
        })
    }

    runTerminal = async (path,command) => {
        const listenerName = 'sfdx-run-shell';
        await window.electron.ipcRenderer.invoke('code-runShell',{
            alias:this.connector.configuration.alias,
            targetPath:this.projectPath,
            listenerName,
            command:command,
        });
        window.electron.listener_on(listenerName,(res) => {
            const {action,data,error} = res;
            //console.log('response',res);
            
            if(action === 'message' || action === 'error'){
                this.terminal.write('\r\n' + data.toString().replace(/(\r\n|\n|\r)/gm," ") + ' \r\n');
            }else if(action === 'exit'){
                this.terminal.write('\r\n'); //  + this.projectPathDisplayed + '\r\n'
                this.terminal.write('$');
                window.electron.listener_off(listenerName);
            }else if(action === 'error'){
                //this.terminal.write(data.toString() + '\r\n');
                //window.electron.listener_off(listenerName);
                //throw decodeError(error);
            }
            
        })
    }

    handleCopy = () => {
        navigator.clipboard.writeText(this.sfdxScannerCommand);
    }

    handlePlay = () => {

    }

    runSfdxAnalyzer = async () => {
        const listenerName = 'sfdx-code-analyzer';
        const {error, result} = await window.electron.ipcRenderer.invoke('code-runSfdxAnalyzer',{
            alias:this.connector.configuration.alias,
            listenerName,
            command:this.sfdxScannerCommand,
        });
        if (error) {
            throw decodeError(error);
        }
        //console.info('runSfdxAnalyzer',result);
        window.electron.listener_on(listenerName,(value) => {
            //console.log('value',value);
            if(value.action === 'done'){
                window.electron.listener_off(listenerName)
            }else if(value.action === 'error'){
                throw decodeError(value.error);
            }
            this.isLoading = false;
        })
    }


    /** Getters **/
    
    get sfdxScannerCommand(){
        return `sfdx scanner:run --target "force-app/main/default" --category "security,Error Prone,Design" -f html `;
    }

    get installPMDLabel(){
        return this.isPmdInstalled?'PMD Already Installed':'Install PMD in your project';
    }

    get isPmdInstalled(){
        return isNotUndefinedOrNull(this.pmdPath);
    }

    get projectPathDisplayed(){
        return (this.projectPath || []).split('/').shift();
    }


    get isButtonDisabled(){
        return isUndefinedOrNull(this.projectPath) || this.isPmdInstalled;
    }

}