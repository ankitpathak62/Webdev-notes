"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.InterruptFlag = exports.MongoshInterruptedError = void 0;
const errors_1 = require("@mongosh/errors");
const kUncatchable = Symbol.for('@@mongosh.uncatchable');
class MongoshInterruptedError extends errors_1.MongoshBaseError {
    constructor() {
        super('MongoshInterruptedError', 'execution was interrupted');
        this[_a] = true;
    }
}
exports.MongoshInterruptedError = MongoshInterruptedError;
_a = kUncatchable;
class InterruptFlag {
    constructor() {
        this.interrupted = false;
        this.onInterruptListeners = new Set();
    }
    isSet() {
        return this.interrupted;
    }
    checkpoint() {
        if (this.interrupted) {
            throw new MongoshInterruptedError();
        }
    }
    asPromise() {
        if (this.interrupted) {
            const promise = Promise.reject(new MongoshInterruptedError());
            promise.catch(() => {
            });
            return {
                destroy: () => { },
                promise,
            };
        }
        let destroy;
        const promise = new Promise((_, reject) => {
            destroy = () => {
                this.onInterruptListeners.delete(reject);
                reject(null);
            };
            this.onInterruptListeners.add(reject);
        });
        promise.catch(() => {
        });
        return {
            destroy: destroy,
            promise,
        };
    }
    async set() {
        this.interrupted = true;
        const err = new MongoshInterruptedError();
        for (const listener of [...this.onInterruptListeners]) {
            try {
                await listener(err);
            }
            catch (_b) {
            }
        }
    }
    reset() {
        this.interrupted = false;
    }
    async withOverrideInterruptBehavior(fn, onInterrupt) {
        const watcher = this.asPromise();
        let listener;
        const onInterruptFinishPromise = new Promise((resolve) => {
            listener = async () => {
                const interruptHandlerResult = onInterrupt();
                resolve(interruptHandlerResult);
                return interruptHandlerResult;
            };
        });
        this.onInterruptListeners.add(listener);
        try {
            this.checkpoint();
            const resultPromise = fn(watcher);
            resultPromise.catch(() => {
            });
            return await Promise.race([resultPromise, watcher.promise]);
        }
        catch (err) {
            if (this.interrupted) {
                await onInterruptFinishPromise;
            }
            throw err;
        }
        finally {
            watcher.destroy();
            this.onInterruptListeners.delete(listener);
        }
    }
}
exports.InterruptFlag = InterruptFlag;
//# sourceMappingURL=interruptor.js.map