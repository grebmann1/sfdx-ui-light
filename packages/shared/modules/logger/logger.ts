class Logger {
    isProduction: boolean;
    colors: {
        reset: string;
        blue: string;
        green: string;
        yellow: string;
        red: string;
        magenta: string;
        cyan?: string;
    };

    constructor() {
        this.isProduction = process.env.NODE_ENV === 'production';
        this.colors = {
            reset: '\x1b[0m',
            blue: '\x1b[34m',
            green: '\x1b[32m',
            yellow: '\x1b[33m',
            red: '\x1b[31m',
            magenta: '\x1b[35m',
            cyan: '\x1b[36m',
        };
    }

    log(...args: unknown[]): void {
        if (!this.isProduction) {
            //const [firstMessage, ...rest] = args;
            console.log(...args);
        }
    }

    info(...args: unknown[]): void {
        if (!this.isProduction) {
            //const [firstMessage, ...rest] = args;
            console.log(`${this.colors.blue}INFO:`, ...args);
        }
    }

    success(...args: unknown[]): void {
        if (!this.isProduction) {
            //const [firstMessage, ...rest] = args;
            console.log(`${this.colors.green}SUCCESS:`, ...args);
        }
    }

    agent(...args: unknown[]): void {
        if (!this.isProduction) {
            //const [firstMessage, ...rest] = args;
            console.log(`${this.colors.cyan}[AGENT]:`, ...args);
        }
    }

    warn(...args: unknown[]): void {
        if (!this.isProduction) {
            //const [firstMessage, ...rest] = args;
            console.log(`${this.colors.yellow}WARNING:`, ...args);
        }
    }

    error(...args: unknown[]): void {
        if (!this.isProduction) {
            //const [firstMessage, ...rest] = args;
            console.log(`${this.colors.red}ERROR:`, ...args);
        }
    }

    debug(...args: unknown[]): void {
        if (!this.isProduction) {
            //const [firstMessage, ...rest] = args;
            console.log(`${this.colors.magenta}DEBUG:`, ...args);
        }
    }
}

export default new Logger();
