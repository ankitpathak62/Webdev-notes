import { MongoshBaseError } from '@mongosh/errors';
declare const kUncatchable: unique symbol;
export declare class MongoshInterruptedError extends MongoshBaseError {
    [kUncatchable]: boolean;
    constructor();
}
export interface InterruptWatcher {
    destroy: () => void;
    promise: Promise<never>;
}
export declare class InterruptFlag {
    private interrupted;
    private onInterruptListeners;
    isSet(): boolean;
    checkpoint(): void;
    asPromise(): InterruptWatcher;
    set(): Promise<void>;
    reset(): void;
    withOverrideInterruptBehavior<Action extends (watcher: InterruptWatcher) => any, OnInterrupt extends () => Promise<void> | void>(fn: Action, onInterrupt: OnInterrupt): Promise<ReturnType<Action>>;
}
export {};
