
class Logger {
    constructor() {
        this.isProduction = process.env.NODE_ENV === 'production';
        this.colors = {
            reset: '\x1b[0m',
            blue: '\x1b[34m',
            green: '\x1b[32m',
            yellow: '\x1b[33m',
            red: '\x1b[31m',
            magenta: '\x1b[35m',
        };
    }

    log(...args) {
        if (!this.isProduction) {
            //const [firstMessage, ...rest] = args;
            console.log(...args);
        }
    }

    info(...args) {
        if (!this.isProduction) {
            //const [firstMessage, ...rest] = args;
            console.log(`${this.colors.blue}INFO:`,...args);
        }
    }

    success(...args) {
        if (!this.isProduction) {
            //const [firstMessage, ...rest] = args;
            console.log(`${this.colors.green}SUCCESS:`,...args);
        }
    }

    warn(...args) {
        if (!this.isProduction) {
            //const [firstMessage, ...rest] = args;
            console.log(`${this.colors.yellow}WARNING:`,...args);
        }
    }

    error(...args) {
        if (!this.isProduction) {
            //const [firstMessage, ...rest] = args;
            console.log(`${this.colors.red}ERROR:`,...args);
        }
    }

    debug(...args) {
        if (!this.isProduction) {
            //const [firstMessage, ...rest] = args;
            console.log(`${this.colors.magenta}DEBUG:`,...args);
        }
    }
}

export default new Logger();
