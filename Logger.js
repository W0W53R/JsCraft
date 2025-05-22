(function(){
    class Log {
        constructor(type, message) {
            this.type = type;
            this.message = message;
            this.timestamp = new Date().toISOString();
        }
    }
    class Logger {
        constructor() {
            this.logs = {};
            this.blockedLogType = [];
        }

        log(type, ...message) {
            const timestamp = new Date().toISOString();
            this.logs[type] = this.logs[type] || [];
            this.logs[type].push(new Log(type, message.join(" ")));
            if (this.blockedLogType.includes(type)) {
                return;
            }
            console.log(`[${timestamp}] [${type}]`, ...message);
        }

        getLogs(type) {
            return this.logs[type] || [];
        }

        addBlockedLog(logtype) {
            this.blockedLogType.push(logtype);
        }
    }
    window.Logger = new Logger();
})()