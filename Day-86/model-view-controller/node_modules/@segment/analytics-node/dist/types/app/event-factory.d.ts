import { EventFactory } from '@segment/analytics-core';
import { SegmentEvent } from './types';
export interface NodeEventFactory {
    alias(...args: Parameters<EventFactory['alias']>): SegmentEvent;
    group(...args: Parameters<EventFactory['group']>): SegmentEvent;
    identify(...args: Parameters<EventFactory['identify']>): SegmentEvent;
    track(...args: Parameters<EventFactory['track']>): SegmentEvent;
    page(...args: Parameters<EventFactory['page']>): SegmentEvent;
    screen(...args: Parameters<EventFactory['screen']>): SegmentEvent;
}
export declare class NodeEventFactory extends EventFactory {
    constructor();
}
//# sourceMappingURL=event-factory.d.ts.map