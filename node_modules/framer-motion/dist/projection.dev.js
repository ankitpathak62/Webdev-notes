(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.Projection = {}));
})(this, (function (exports) { 'use strict';

    const noop = (any) => any;

    const MotionGlobalConfig = {
        skipAnimations: false,
        useManualTiming: false,
    };

    class Queue {
        constructor() {
            this.order = [];
            this.scheduled = new Set();
        }
        add(process) {
            if (!this.scheduled.has(process)) {
                this.scheduled.add(process);
                this.order.push(process);
                return true;
            }
        }
        remove(process) {
            const index = this.order.indexOf(process);
            if (index !== -1) {
                this.order.splice(index, 1);
                this.scheduled.delete(process);
            }
        }
        clear() {
            this.order.length = 0;
            this.scheduled.clear();
        }
    }
    function createRenderStep(runNextFrame) {
        /**
         * We create and reuse two queues, one to queue jobs for the current frame
         * and one for the next. We reuse to avoid triggering GC after x frames.
         */
        let thisFrame = new Queue();
        let nextFrame = new Queue();
        let numToRun = 0;
        /**
         * Track whether we're currently processing jobs in this step. This way
         * we can decide whether to schedule new jobs for this frame or next.
         */
        let isProcessing = false;
        let flushNextFrame = false;
        /**
         * A set of processes which were marked keepAlive when scheduled.
         */
        const toKeepAlive = new WeakSet();
        const step = {
            /**
             * Schedule a process to run on the next frame.
             */
            schedule: (callback, keepAlive = false, immediate = false) => {
                const addToCurrentFrame = immediate && isProcessing;
                const queue = addToCurrentFrame ? thisFrame : nextFrame;
                if (keepAlive)
                    toKeepAlive.add(callback);
                if (queue.add(callback) && addToCurrentFrame && isProcessing) {
                    // If we're adding it to the currently running queue, update its measured size
                    numToRun = thisFrame.order.length;
                }
                return callback;
            },
            /**
             * Cancel the provided callback from running on the next frame.
             */
            cancel: (callback) => {
                nextFrame.remove(callback);
                toKeepAlive.delete(callback);
            },
            /**
             * Execute all schedule callbacks.
             */
            process: (frameData) => {
                /**
                 * If we're already processing we've probably been triggered by a flushSync
                 * inside an existing process. Instead of executing, mark flushNextFrame
                 * as true and ensure we flush the following frame at the end of this one.
                 */
                if (isProcessing) {
                    flushNextFrame = true;
                    return;
                }
                isProcessing = true;
                [thisFrame, nextFrame] = [nextFrame, thisFrame];
                // Clear the next frame queue
                nextFrame.clear();
                // Execute this frame
                numToRun = thisFrame.order.length;
                if (numToRun) {
                    for (let i = 0; i < numToRun; i++) {
                        const callback = thisFrame.order[i];
                        if (toKeepAlive.has(callback)) {
                            step.schedule(callback);
                            runNextFrame();
                        }
                        callback(frameData);
                    }
                }
                isProcessing = false;
                if (flushNextFrame) {
                    flushNextFrame = false;
                    step.process(frameData);
                }
            },
        };
        return step;
    }

    const stepsOrder = [
        "read", // Read
        "resolveKeyframes", // Write/Read/Write/Read
        "update", // Compute
        "preRender", // Compute
        "render", // Write
        "postRender", // Compute
    ];
    const maxElapsed = 40;
    function createRenderBatcher(scheduleNextBatch, allowKeepAlive) {
        let runNextFrame = false;
        let useDefaultElapsed = true;
        const state = {
            delta: 0,
            timestamp: 0,
            isProcessing: false,
        };
        const steps = stepsOrder.reduce((acc, key) => {
            acc[key] = createRenderStep(() => (runNextFrame = true));
            return acc;
        }, {});
        const processStep = (stepId) => {
            steps[stepId].process(state);
        };
        const processBatch = () => {
            const timestamp = performance.now();
            runNextFrame = false;
            state.delta = useDefaultElapsed
                ? 1000 / 60
                : Math.max(Math.min(timestamp - state.timestamp, maxElapsed), 1);
            state.timestamp = timestamp;
            state.isProcessing = true;
            stepsOrder.forEach(processStep);
            state.isProcessing = false;
            if (runNextFrame && allowKeepAlive) {
                useDefaultElapsed = false;
                scheduleNextBatch(processBatch);
            }
        };
        const wake = () => {
            runNextFrame = true;
            useDefaultElapsed = true;
            if (!state.isProcessing) {
                scheduleNextBatch(processBatch);
            }
        };
        const schedule = stepsOrder.reduce((acc, key) => {
            const step = steps[key];
            acc[key] = (process, keepAlive = false, immediate = false) => {
                if (!runNextFrame)
                    wake();
                return step.schedule(process, keepAlive, immediate);
            };
            return acc;
        }, {});
        const cancel = (process) => stepsOrder.forEach((key) => steps[key].cancel(process));
        return { schedule, cancel, state, steps };
    }

    const { schedule: frame, cancel: cancelFrame, state: frameData, steps, } = createRenderBatcher(typeof requestAnimationFrame !== "undefined" ? requestAnimationFrame : noop, true);

    function addUniqueItem(arr, item) {
        if (arr.indexOf(item) === -1)
            arr.push(item);
    }
    function removeItem(arr, item) {
        const index = arr.indexOf(item);
        if (index > -1)
            arr.splice(index, 1);
    }

    class SubscriptionManager {
        constructor() {
            this.subscriptions = [];
        }
        add(handler) {
            addUniqueItem(this.subscriptions, handler);
            return () => removeItem(this.subscriptions, handler);
        }
        notify(a, b, c) {
            const numSubscriptions = this.subscriptions.length;
            if (!numSubscriptions)
                return;
            if (numSubscriptions === 1) {
                /**
                 * If there's only a single handler we can just call it without invoking a loop.
                 */
                this.subscriptions[0](a, b, c);
            }
            else {
                for (let i = 0; i < numSubscriptions; i++) {
                    /**
                     * Check whether the handler exists before firing as it's possible
                     * the subscriptions were modified during this loop running.
                     */
                    const handler = this.subscriptions[i];
                    handler && handler(a, b, c);
                }
            }
        }
        getSize() {
            return this.subscriptions.length;
        }
        clear() {
            this.subscriptions.length = 0;
        }
    }

    // Accepts an easing function and returns a new one that outputs mirrored values for
    // the second half of the animation. Turns easeIn into easeInOut.
    const mirrorEasing = (easing) => (p) => p <= 0.5 ? easing(2 * p) / 2 : (2 - easing(2 * (1 - p))) / 2;

    // Accepts an easing function and returns a new one that outputs reversed values.
    // Turns easeIn into easeOut.
    const reverseEasing = (easing) => (p) => 1 - easing(1 - p);

    const circIn = (p) => 1 - Math.sin(Math.acos(p));
    const circOut = reverseEasing(circIn);
    const circInOut = mirrorEasing(circIn);

    /*
      Progress within given range

      Given a lower limit and an upper limit, we return the progress
      (expressed as a number 0-1) represented by the given value, and
      limit that progress to within 0-1.

      @param [number]: Lower limit
      @param [number]: Upper limit
      @param [number]: Value to find progress within given range
      @return [number]: Progress of value within range as expressed 0-1
    */
    const progress = (from, to, value) => {
        const toFromDifference = to - from;
        return toFromDifference === 0 ? 1 : (value - from) / toFromDifference;
    };

    /*
      Value in range from progress

      Given a lower limit and an upper limit, we return the value within
      that range as expressed by progress (usually a number from 0 to 1)

      So progress = 0.5 would change

      from -------- to

      to

      from ---- to

      E.g. from = 10, to = 20, progress = 0.5 => 15

      @param [number]: Lower limit of range
      @param [number]: Upper limit of range
      @param [number]: The progress between lower and upper limits expressed 0-1
      @return [number]: Value as calculated from progress within range (not limited within range)
    */
    const mixNumber$1 = (from, to, progress) => {
        return from + (to - from) * progress;
    };

    /**
     * TODO: When we move from string as a source of truth to data models
     * everything in this folder should probably be referred to as models vs types
     */
    // If this number is a decimal, make it just five decimal places
    // to avoid exponents
    const sanitize = (v) => Math.round(v * 100000) / 100000;
    const floatRegex = /-?(?:\d+(?:\.\d+)?|\.\d+)/gu;
    const colorRegex = /(?:#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\))/giu;
    const singleColorRegex = /^(?:#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\))$/iu;
    function isString(v) {
        return typeof v === "string";
    }

    const createUnitType = (unit) => ({
        test: (v) => isString(v) && v.endsWith(unit) && v.split(" ").length === 1,
        parse: parseFloat,
        transform: (v) => `${v}${unit}`,
    });
    const degrees = createUnitType("deg");
    const percent = createUnitType("%");
    const px = createUnitType("px");
    const vh = createUnitType("vh");
    const vw = createUnitType("vw");
    const progressPercentage = {
        ...percent,
        parse: (v) => percent.parse(v) / 100,
        transform: (v) => percent.transform(v * 100),
    };

    const borders = ["TopLeft", "TopRight", "BottomLeft", "BottomRight"];
    const numBorders = borders.length;
    const asNumber = (value) => typeof value === "string" ? parseFloat(value) : value;
    const isPx = (value) => typeof value === "number" || px.test(value);
    function mixValues(target, follow, lead, progress, shouldCrossfadeOpacity, isOnlyMember) {
        if (shouldCrossfadeOpacity) {
            target.opacity = mixNumber$1(0, 
            // TODO Reinstate this if only child
            lead.opacity !== undefined ? lead.opacity : 1, easeCrossfadeIn(progress));
            target.opacityExit = mixNumber$1(follow.opacity !== undefined ? follow.opacity : 1, 0, easeCrossfadeOut(progress));
        }
        else if (isOnlyMember) {
            target.opacity = mixNumber$1(follow.opacity !== undefined ? follow.opacity : 1, lead.opacity !== undefined ? lead.opacity : 1, progress);
        }
        /**
         * Mix border radius
         */
        for (let i = 0; i < numBorders; i++) {
            const borderLabel = `border${borders[i]}Radius`;
            let followRadius = getRadius(follow, borderLabel);
            let leadRadius = getRadius(lead, borderLabel);
            if (followRadius === undefined && leadRadius === undefined)
                continue;
            followRadius || (followRadius = 0);
            leadRadius || (leadRadius = 0);
            const canMix = followRadius === 0 ||
                leadRadius === 0 ||
                isPx(followRadius) === isPx(leadRadius);
            if (canMix) {
                target[borderLabel] = Math.max(mixNumber$1(asNumber(followRadius), asNumber(leadRadius), progress), 0);
                if (percent.test(leadRadius) || percent.test(followRadius)) {
                    target[borderLabel] += "%";
                }
            }
            else {
                target[borderLabel] = leadRadius;
            }
        }
        /**
         * Mix rotation
         */
        if (follow.rotate || lead.rotate) {
            target.rotate = mixNumber$1(follow.rotate || 0, lead.rotate || 0, progress);
        }
    }
    function getRadius(values, radiusName) {
        return values[radiusName] !== undefined
            ? values[radiusName]
            : values.borderRadius;
    }
    // /**
    //  * We only want to mix the background color if there's a follow element
    //  * that we're not crossfading opacity between. For instance with switch
    //  * AnimateSharedLayout animations, this helps the illusion of a continuous
    //  * element being animated but also cuts down on the number of paints triggered
    //  * for elements where opacity is doing that work for us.
    //  */
    // if (
    //     !hasFollowElement &&
    //     latestLeadValues.backgroundColor &&
    //     latestFollowValues.backgroundColor
    // ) {
    //     /**
    //      * This isn't ideal performance-wise as mixColor is creating a new function every frame.
    //      * We could probably create a mixer that runs at the start of the animation but
    //      * the idea behind the crossfader is that it runs dynamically between two potentially
    //      * changing targets (ie opacity or borderRadius may be animating independently via variants)
    //      */
    //     leadState.backgroundColor = followState.backgroundColor = mixColor(
    //         latestFollowValues.backgroundColor as string,
    //         latestLeadValues.backgroundColor as string
    //     )(p)
    // }
    const easeCrossfadeIn = compress(0, 0.5, circOut);
    const easeCrossfadeOut = compress(0.5, 0.95, noop);
    function compress(min, max, easing) {
        return (p) => {
            // Could replace ifs with clamp
            if (p < min)
                return 0;
            if (p > max)
                return 1;
            return easing(progress(min, max, p));
        };
    }

    /**
     * Reset an axis to the provided origin box.
     *
     * This is a mutative operation.
     */
    function copyAxisInto(axis, originAxis) {
        axis.min = originAxis.min;
        axis.max = originAxis.max;
    }
    /**
     * Reset a box to the provided origin box.
     *
     * This is a mutative operation.
     */
    function copyBoxInto(box, originBox) {
        copyAxisInto(box.x, originBox.x);
        copyAxisInto(box.y, originBox.y);
    }

    function isIdentityScale(scale) {
        return scale === undefined || scale === 1;
    }
    function hasScale({ scale, scaleX, scaleY }) {
        return (!isIdentityScale(scale) ||
            !isIdentityScale(scaleX) ||
            !isIdentityScale(scaleY));
    }
    function hasTransform(values) {
        return (hasScale(values) ||
            has2DTranslate(values) ||
            values.z ||
            values.rotate ||
            values.rotateX ||
            values.rotateY ||
            values.skewX ||
            values.skewY);
    }
    function has2DTranslate(values) {
        return is2DTranslate(values.x) || is2DTranslate(values.y);
    }
    function is2DTranslate(value) {
        return value && value !== "0%";
    }

    /**
     * Scales a point based on a factor and an originPoint
     */
    function scalePoint(point, scale, originPoint) {
        const distanceFromOrigin = point - originPoint;
        const scaled = scale * distanceFromOrigin;
        return originPoint + scaled;
    }
    /**
     * Applies a translate/scale delta to a point
     */
    function applyPointDelta(point, translate, scale, originPoint, boxScale) {
        if (boxScale !== undefined) {
            point = scalePoint(point, boxScale, originPoint);
        }
        return scalePoint(point, scale, originPoint) + translate;
    }
    /**
     * Applies a translate/scale delta to an axis
     */
    function applyAxisDelta(axis, translate = 0, scale = 1, originPoint, boxScale) {
        axis.min = applyPointDelta(axis.min, translate, scale, originPoint, boxScale);
        axis.max = applyPointDelta(axis.max, translate, scale, originPoint, boxScale);
    }
    /**
     * Applies a translate/scale delta to a box
     */
    function applyBoxDelta(box, { x, y }) {
        applyAxisDelta(box.x, x.translate, x.scale, x.originPoint);
        applyAxisDelta(box.y, y.translate, y.scale, y.originPoint);
    }
    /**
     * Apply a tree of deltas to a box. We do this to calculate the effect of all the transforms
     * in a tree upon our box before then calculating how to project it into our desired viewport-relative box
     *
     * This is the final nested loop within updateLayoutDelta for future refactoring
     */
    function applyTreeDeltas(box, treeScale, treePath, isSharedTransition = false) {
        const treeLength = treePath.length;
        if (!treeLength)
            return;
        // Reset the treeScale
        treeScale.x = treeScale.y = 1;
        let node;
        let delta;
        for (let i = 0; i < treeLength; i++) {
            node = treePath[i];
            delta = node.projectionDelta;
            /**
             * TODO: Prefer to remove this, but currently we have motion components with
             * display: contents in Framer.
             */
            const instance = node.instance;
            if (instance &&
                instance.style &&
                instance.style.display === "contents") {
                continue;
            }
            if (isSharedTransition &&
                node.options.layoutScroll &&
                node.scroll &&
                node !== node.root) {
                transformBox(box, {
                    x: -node.scroll.offset.x,
                    y: -node.scroll.offset.y,
                });
            }
            if (delta) {
                // Incoporate each ancestor's scale into a culmulative treeScale for this component
                treeScale.x *= delta.x.scale;
                treeScale.y *= delta.y.scale;
                // Apply each ancestor's calculated delta into this component's recorded layout box
                applyBoxDelta(box, delta);
            }
            if (isSharedTransition && hasTransform(node.latestValues)) {
                transformBox(box, node.latestValues);
            }
        }
        /**
         * Snap tree scale back to 1 if it's within a non-perceivable threshold.
         * This will help reduce useless scales getting rendered.
         */
        treeScale.x = snapToDefault(treeScale.x);
        treeScale.y = snapToDefault(treeScale.y);
    }
    function snapToDefault(scale) {
        if (Number.isInteger(scale))
            return scale;
        return scale > 1.0000000000001 || scale < 0.999999999999 ? scale : 1;
    }
    function translateAxis(axis, distance) {
        axis.min = axis.min + distance;
        axis.max = axis.max + distance;
    }
    /**
     * Apply a transform to an axis from the latest resolved motion values.
     * This function basically acts as a bridge between a flat motion value map
     * and applyAxisDelta
     */
    function transformAxis(axis, transforms, [key, scaleKey, originKey]) {
        const axisOrigin = transforms[originKey] !== undefined ? transforms[originKey] : 0.5;
        const originPoint = mixNumber$1(axis.min, axis.max, axisOrigin);
        // Apply the axis delta to the final axis
        applyAxisDelta(axis, transforms[key], transforms[scaleKey], originPoint, transforms.scale);
    }
    /**
     * The names of the motion values we want to apply as translation, scale and origin.
     */
    const xKeys$1 = ["x", "scaleX", "originX"];
    const yKeys$1 = ["y", "scaleY", "originY"];
    /**
     * Apply a transform to a box from the latest resolved motion values.
     */
    function transformBox(box, transform) {
        transformAxis(box.x, transform, xKeys$1);
        transformAxis(box.y, transform, yKeys$1);
    }

    function calcLength(axis) {
        return axis.max - axis.min;
    }
    function isNear(value, target = 0, maxDistance = 0.01) {
        return Math.abs(value - target) <= maxDistance;
    }
    function calcAxisDelta(delta, source, target, origin = 0.5) {
        delta.origin = origin;
        delta.originPoint = mixNumber$1(source.min, source.max, delta.origin);
        delta.scale = calcLength(target) / calcLength(source);
        if (isNear(delta.scale, 1, 0.0001) || isNaN(delta.scale))
            delta.scale = 1;
        delta.translate =
            mixNumber$1(target.min, target.max, delta.origin) - delta.originPoint;
        if (isNear(delta.translate) || isNaN(delta.translate))
            delta.translate = 0;
    }
    function calcBoxDelta(delta, source, target, origin) {
        calcAxisDelta(delta.x, source.x, target.x, origin ? origin.originX : undefined);
        calcAxisDelta(delta.y, source.y, target.y, origin ? origin.originY : undefined);
    }
    function calcRelativeAxis(target, relative, parent) {
        target.min = parent.min + relative.min;
        target.max = target.min + calcLength(relative);
    }
    function calcRelativeBox(target, relative, parent) {
        calcRelativeAxis(target.x, relative.x, parent.x);
        calcRelativeAxis(target.y, relative.y, parent.y);
    }
    function calcRelativeAxisPosition(target, layout, parent) {
        target.min = layout.min - parent.min;
        target.max = target.min + calcLength(layout);
    }
    function calcRelativePosition(target, layout, parent) {
        calcRelativeAxisPosition(target.x, layout.x, parent.x);
        calcRelativeAxisPosition(target.y, layout.y, parent.y);
    }

    /**
     * Remove a delta from a point. This is essentially the steps of applyPointDelta in reverse
     */
    function removePointDelta(point, translate, scale, originPoint, boxScale) {
        point -= translate;
        point = scalePoint(point, 1 / scale, originPoint);
        if (boxScale !== undefined) {
            point = scalePoint(point, 1 / boxScale, originPoint);
        }
        return point;
    }
    /**
     * Remove a delta from an axis. This is essentially the steps of applyAxisDelta in reverse
     */
    function removeAxisDelta(axis, translate = 0, scale = 1, origin = 0.5, boxScale, originAxis = axis, sourceAxis = axis) {
        if (percent.test(translate)) {
            translate = parseFloat(translate);
            const relativeProgress = mixNumber$1(sourceAxis.min, sourceAxis.max, translate / 100);
            translate = relativeProgress - sourceAxis.min;
        }
        if (typeof translate !== "number")
            return;
        let originPoint = mixNumber$1(originAxis.min, originAxis.max, origin);
        if (axis === originAxis)
            originPoint -= translate;
        axis.min = removePointDelta(axis.min, translate, scale, originPoint, boxScale);
        axis.max = removePointDelta(axis.max, translate, scale, originPoint, boxScale);
    }
    /**
     * Remove a transforms from an axis. This is essentially the steps of applyAxisTransforms in reverse
     * and acts as a bridge between motion values and removeAxisDelta
     */
    function removeAxisTransforms(axis, transforms, [key, scaleKey, originKey], origin, sourceAxis) {
        removeAxisDelta(axis, transforms[key], transforms[scaleKey], transforms[originKey], transforms.scale, origin, sourceAxis);
    }
    /**
     * The names of the motion values we want to apply as translation, scale and origin.
     */
    const xKeys = ["x", "scaleX", "originX"];
    const yKeys = ["y", "scaleY", "originY"];
    /**
     * Remove a transforms from an box. This is essentially the steps of applyAxisBox in reverse
     * and acts as a bridge between motion values and removeAxisDelta
     */
    function removeBoxTransforms(box, transforms, originBox, sourceBox) {
        removeAxisTransforms(box.x, transforms, xKeys, originBox ? originBox.x : undefined, sourceBox ? sourceBox.x : undefined);
        removeAxisTransforms(box.y, transforms, yKeys, originBox ? originBox.y : undefined, sourceBox ? sourceBox.y : undefined);
    }

    const createAxisDelta = () => ({
        translate: 0,
        scale: 1,
        origin: 0,
        originPoint: 0,
    });
    const createDelta = () => ({
        x: createAxisDelta(),
        y: createAxisDelta(),
    });
    const createAxis = () => ({ min: 0, max: 0 });
    const createBox = () => ({
        x: createAxis(),
        y: createAxis(),
    });

    /**
     * Decide whether a transition is defined on a given Transition.
     * This filters out orchestration options and returns true
     * if any options are left.
     */
    function isTransitionDefined({ when, delay: _delay, delayChildren, staggerChildren, staggerDirection, repeat, repeatType, repeatDelay, from, elapsed, ...transition }) {
        return !!Object.keys(transition).length;
    }
    function getValueTransition(transition, key) {
        return (transition[key] ||
            transition["default"] ||
            transition);
    }

    function isAxisDeltaZero(delta) {
        return delta.translate === 0 && delta.scale === 1;
    }
    function isDeltaZero(delta) {
        return isAxisDeltaZero(delta.x) && isAxisDeltaZero(delta.y);
    }
    function boxEquals(a, b) {
        return (a.x.min === b.x.min &&
            a.x.max === b.x.max &&
            a.y.min === b.y.min &&
            a.y.max === b.y.max);
    }
    function boxEqualsRounded(a, b) {
        return (Math.round(a.x.min) === Math.round(b.x.min) &&
            Math.round(a.x.max) === Math.round(b.x.max) &&
            Math.round(a.y.min) === Math.round(b.y.min) &&
            Math.round(a.y.max) === Math.round(b.y.max));
    }
    function aspectRatio(box) {
        return calcLength(box.x) / calcLength(box.y);
    }

    class NodeStack {
        constructor() {
            this.members = [];
        }
        add(node) {
            addUniqueItem(this.members, node);
            node.scheduleRender();
        }
        remove(node) {
            removeItem(this.members, node);
            if (node === this.prevLead) {
                this.prevLead = undefined;
            }
            if (node === this.lead) {
                const prevLead = this.members[this.members.length - 1];
                if (prevLead) {
                    this.promote(prevLead);
                }
            }
        }
        relegate(node) {
            const indexOfNode = this.members.findIndex((member) => node === member);
            if (indexOfNode === 0)
                return false;
            /**
             * Find the next projection node that is present
             */
            let prevLead;
            for (let i = indexOfNode; i >= 0; i--) {
                const member = this.members[i];
                if (member.isPresent !== false) {
                    prevLead = member;
                    break;
                }
            }
            if (prevLead) {
                this.promote(prevLead);
                return true;
            }
            else {
                return false;
            }
        }
        promote(node, preserveFollowOpacity) {
            const prevLead = this.lead;
            if (node === prevLead)
                return;
            this.prevLead = prevLead;
            this.lead = node;
            node.show();
            if (prevLead) {
                prevLead.instance && prevLead.scheduleRender();
                node.scheduleRender();
                node.resumeFrom = prevLead;
                if (preserveFollowOpacity) {
                    node.resumeFrom.preserveOpacity = true;
                }
                if (prevLead.snapshot) {
                    node.snapshot = prevLead.snapshot;
                    node.snapshot.latestValues =
                        prevLead.animationValues || prevLead.latestValues;
                }
                if (node.root && node.root.isUpdating) {
                    node.isLayoutDirty = true;
                }
                const { crossfade } = node.options;
                if (crossfade === false) {
                    prevLead.hide();
                }
                /**
                 * TODO:
                 *   - Test border radius when previous node was deleted
                 *   - boxShadow mixing
                 *   - Shared between element A in scrolled container and element B (scroll stays the same or changes)
                 *   - Shared between element A in transformed container and element B (transform stays the same or changes)
                 *   - Shared between element A in scrolled page and element B (scroll stays the same or changes)
                 * ---
                 *   - Crossfade opacity of root nodes
                 *   - layoutId changes after animation
                 *   - layoutId changes mid animation
                 */
            }
        }
        exitAnimationComplete() {
            this.members.forEach((node) => {
                const { options, resumingFrom } = node;
                options.onExitComplete && options.onExitComplete();
                if (resumingFrom) {
                    resumingFrom.options.onExitComplete &&
                        resumingFrom.options.onExitComplete();
                }
            });
        }
        scheduleRender() {
            this.members.forEach((node) => {
                node.instance && node.scheduleRender(false);
            });
        }
        /**
         * Clear any leads that have been removed this render to prevent them from being
         * used in future animations and to prevent memory leaks
         */
        removeLeadSnapshot() {
            if (this.lead && this.lead.snapshot) {
                this.lead.snapshot = undefined;
            }
        }
    }

    const scaleCorrectors = {};
    function addScaleCorrector(correctors) {
        Object.assign(scaleCorrectors, correctors);
    }

    function buildProjectionTransform(delta, treeScale, latestTransform) {
        let transform = "";
        /**
         * The translations we use to calculate are always relative to the viewport coordinate space.
         * But when we apply scales, we also scale the coordinate space of an element and its children.
         * For instance if we have a treeScale (the culmination of all parent scales) of 0.5 and we need
         * to move an element 100 pixels, we actually need to move it 200 in within that scaled space.
         */
        const xTranslate = delta.x.translate / treeScale.x;
        const yTranslate = delta.y.translate / treeScale.y;
        const zTranslate = (latestTransform === null || latestTransform === void 0 ? void 0 : latestTransform.z) || 0;
        if (xTranslate || yTranslate || zTranslate) {
            transform = `translate3d(${xTranslate}px, ${yTranslate}px, ${zTranslate}px) `;
        }
        /**
         * Apply scale correction for the tree transform.
         * This will apply scale to the screen-orientated axes.
         */
        if (treeScale.x !== 1 || treeScale.y !== 1) {
            transform += `scale(${1 / treeScale.x}, ${1 / treeScale.y}) `;
        }
        if (latestTransform) {
            const { transformPerspective, rotate, rotateX, rotateY, skewX, skewY } = latestTransform;
            if (transformPerspective)
                transform = `perspective(${transformPerspective}px) ${transform}`;
            if (rotate)
                transform += `rotate(${rotate}deg) `;
            if (rotateX)
                transform += `rotateX(${rotateX}deg) `;
            if (rotateY)
                transform += `rotateY(${rotateY}deg) `;
            if (skewX)
                transform += `skewX(${skewX}deg) `;
            if (skewY)
                transform += `skewY(${skewY}deg) `;
        }
        /**
         * Apply scale to match the size of the element to the size we want it.
         * This will apply scale to the element-orientated axes.
         */
        const elementScaleX = delta.x.scale * treeScale.x;
        const elementScaleY = delta.y.scale * treeScale.y;
        if (elementScaleX !== 1 || elementScaleY !== 1) {
            transform += `scale(${elementScaleX}, ${elementScaleY})`;
        }
        return transform || "none";
    }

    function eachAxis(callback) {
        return [callback("x"), callback("y")];
    }

    const compareByDepth = (a, b) => a.depth - b.depth;

    class FlatTree {
        constructor() {
            this.children = [];
            this.isDirty = false;
        }
        add(child) {
            addUniqueItem(this.children, child);
            this.isDirty = true;
        }
        remove(child) {
            removeItem(this.children, child);
            this.isDirty = true;
        }
        forEach(callback) {
            this.isDirty && this.children.sort(compareByDepth);
            this.isDirty = false;
            this.children.forEach(callback);
        }
    }

    const isCustomValue = (v) => {
        return Boolean(v && typeof v === "object" && v.mix && v.toValue);
    };

    const isMotionValue = (value) => Boolean(value && value.getVelocity);

    /**
     * If the provided value is a MotionValue, this returns the actual value, otherwise just the value itself
     *
     * TODO: Remove and move to library
     */
    function resolveMotionValue(value) {
        const unwrappedValue = isMotionValue(value) ? value.get() : value;
        return isCustomValue(unwrappedValue)
            ? unwrappedValue.toValue()
            : unwrappedValue;
    }

    /**
     * This should only ever be modified on the client otherwise it'll
     * persist through server requests. If we need instanced states we
     * could lazy-init via root.
     */
    const globalProjectionState = {
        /**
         * Global flag as to whether the tree has animated since the last time
         * we resized the window
         */
        hasAnimatedSinceResize: true,
        /**
         * We set this to true once, on the first update. Any nodes added to the tree beyond that
         * update will be given a `data-projection-id` attribute.
         */
        hasEverUpdated: false,
    };

    let now;
    function clearTime() {
        now = undefined;
    }
    /**
     * An eventloop-synchronous alternative to performance.now().
     *
     * Ensures that time measurements remain consistent within a synchronous context.
     * Usually calling performance.now() twice within the same synchronous context
     * will return different values which isn't useful for animations when we're usually
     * trying to sync animations to the same frame.
     */
    const time = {
        now: () => {
            if (now === undefined) {
                time.set(frameData.isProcessing || MotionGlobalConfig.useManualTiming
                    ? frameData.timestamp
                    : performance.now());
            }
            return now;
        },
        set: (newTime) => {
            now = newTime;
            queueMicrotask(clearTime);
        },
    };

    /**
     * Timeout defined in ms
     */
    function delay(callback, timeout) {
        const start = time.now();
        const checkElapsed = ({ timestamp }) => {
            const elapsed = timestamp - start;
            if (elapsed >= timeout) {
                cancelFrame(checkElapsed);
                callback(elapsed - timeout);
            }
        };
        frame.read(checkElapsed, true);
        return () => cancelFrame(checkElapsed);
    }

    function record(data) {
        if (window.MotionDebug) {
            window.MotionDebug.record(data);
        }
    }

    /*
      Convert velocity into velocity per second

      @param [number]: Unit per frame
      @param [number]: Frame duration in ms
    */
    function velocityPerSecond(velocity, frameDuration) {
        return frameDuration ? velocity * (1000 / frameDuration) : 0;
    }

    const warned = new Set();
    function warnOnce(condition, message, element) {
        if (condition || warned.has(message))
            return;
        console.warn(message);
        if (element)
            console.warn(element);
        warned.add(message);
    }

    /**
     * Maximum time between the value of two frames, beyond which we
     * assume the velocity has since been 0.
     */
    const MAX_VELOCITY_DELTA = 30;
    const isFloat = (value) => {
        return !isNaN(parseFloat(value));
    };
    /**
     * `MotionValue` is used to track the state and velocity of motion values.
     *
     * @public
     */
    class MotionValue {
        /**
         * @param init - The initiating value
         * @param config - Optional configuration options
         *
         * -  `transformer`: A function to transform incoming values with.
         *
         * @internal
         */
        constructor(init, options = {}) {
            /**
             * This will be replaced by the build step with the latest version number.
             * When MotionValues are provided to motion components, warn if versions are mixed.
             */
            this.version = "11.2.4";
            /**
             * Tracks whether this value can output a velocity. Currently this is only true
             * if the value is numerical, but we might be able to widen the scope here and support
             * other value types.
             *
             * @internal
             */
            this.canTrackVelocity = null;
            /**
             * An object containing a SubscriptionManager for each active event.
             */
            this.events = {};
            this.updateAndNotify = (v, render = true) => {
                const currentTime = time.now();
                /**
                 * If we're updating the value during another frame or eventloop
                 * than the previous frame, then the we set the previous frame value
                 * to current.
                 */
                if (this.updatedAt !== currentTime) {
                    this.setPrevFrameValue();
                }
                this.prev = this.current;
                this.setCurrent(v);
                // Update update subscribers
                if (this.current !== this.prev && this.events.change) {
                    this.events.change.notify(this.current);
                }
                // Update render subscribers
                if (render && this.events.renderRequest) {
                    this.events.renderRequest.notify(this.current);
                }
            };
            this.hasAnimated = false;
            this.setCurrent(init);
            this.owner = options.owner;
        }
        setCurrent(current) {
            this.current = current;
            this.updatedAt = time.now();
            if (this.canTrackVelocity === null && current !== undefined) {
                this.canTrackVelocity = isFloat(this.current);
            }
        }
        setPrevFrameValue(prevFrameValue = this.current) {
            this.prevFrameValue = prevFrameValue;
            this.prevUpdatedAt = this.updatedAt;
        }
        /**
         * Adds a function that will be notified when the `MotionValue` is updated.
         *
         * It returns a function that, when called, will cancel the subscription.
         *
         * When calling `onChange` inside a React component, it should be wrapped with the
         * `useEffect` hook. As it returns an unsubscribe function, this should be returned
         * from the `useEffect` function to ensure you don't add duplicate subscribers..
         *
         * ```jsx
         * export const MyComponent = () => {
         *   const x = useMotionValue(0)
         *   const y = useMotionValue(0)
         *   const opacity = useMotionValue(1)
         *
         *   useEffect(() => {
         *     function updateOpacity() {
         *       const maxXY = Math.max(x.get(), y.get())
         *       const newOpacity = transform(maxXY, [0, 100], [1, 0])
         *       opacity.set(newOpacity)
         *     }
         *
         *     const unsubscribeX = x.on("change", updateOpacity)
         *     const unsubscribeY = y.on("change", updateOpacity)
         *
         *     return () => {
         *       unsubscribeX()
         *       unsubscribeY()
         *     }
         *   }, [])
         *
         *   return <motion.div style={{ x }} />
         * }
         * ```
         *
         * @param subscriber - A function that receives the latest value.
         * @returns A function that, when called, will cancel this subscription.
         *
         * @deprecated
         */
        onChange(subscription) {
            {
                warnOnce(false, `value.onChange(callback) is deprecated. Switch to value.on("change", callback).`);
            }
            return this.on("change", subscription);
        }
        on(eventName, callback) {
            if (!this.events[eventName]) {
                this.events[eventName] = new SubscriptionManager();
            }
            const unsubscribe = this.events[eventName].add(callback);
            if (eventName === "change") {
                return () => {
                    unsubscribe();
                    /**
                     * If we have no more change listeners by the start
                     * of the next frame, stop active animations.
                     */
                    frame.read(() => {
                        if (!this.events.change.getSize()) {
                            this.stop();
                        }
                    });
                };
            }
            return unsubscribe;
        }
        clearListeners() {
            for (const eventManagers in this.events) {
                this.events[eventManagers].clear();
            }
        }
        /**
         * Attaches a passive effect to the `MotionValue`.
         *
         * @internal
         */
        attach(passiveEffect, stopPassiveEffect) {
            this.passiveEffect = passiveEffect;
            this.stopPassiveEffect = stopPassiveEffect;
        }
        /**
         * Sets the state of the `MotionValue`.
         *
         * @remarks
         *
         * ```jsx
         * const x = useMotionValue(0)
         * x.set(10)
         * ```
         *
         * @param latest - Latest value to set.
         * @param render - Whether to notify render subscribers. Defaults to `true`
         *
         * @public
         */
        set(v, render = true) {
            if (!render || !this.passiveEffect) {
                this.updateAndNotify(v, render);
            }
            else {
                this.passiveEffect(v, this.updateAndNotify);
            }
        }
        setWithVelocity(prev, current, delta) {
            this.set(current);
            this.prev = undefined;
            this.prevFrameValue = prev;
            this.prevUpdatedAt = this.updatedAt - delta;
        }
        /**
         * Set the state of the `MotionValue`, stopping any active animations,
         * effects, and resets velocity to `0`.
         */
        jump(v, endAnimation = true) {
            this.updateAndNotify(v);
            this.prev = v;
            this.prevUpdatedAt = this.prevFrameValue = undefined;
            endAnimation && this.stop();
            if (this.stopPassiveEffect)
                this.stopPassiveEffect();
        }
        /**
         * Returns the latest state of `MotionValue`
         *
         * @returns - The latest state of `MotionValue`
         *
         * @public
         */
        get() {
            return this.current;
        }
        /**
         * @public
         */
        getPrevious() {
            return this.prev;
        }
        /**
         * Returns the latest velocity of `MotionValue`
         *
         * @returns - The latest velocity of `MotionValue`. Returns `0` if the state is non-numerical.
         *
         * @public
         */
        getVelocity() {
            const currentTime = time.now();
            if (!this.canTrackVelocity ||
                this.prevFrameValue === undefined ||
                currentTime - this.updatedAt > MAX_VELOCITY_DELTA) {
                return 0;
            }
            const delta = Math.min(this.updatedAt - this.prevUpdatedAt, MAX_VELOCITY_DELTA);
            // Casts because of parseFloat's poor typing
            return velocityPerSecond(parseFloat(this.current) -
                parseFloat(this.prevFrameValue), delta);
        }
        /**
         * Registers a new animation to control this `MotionValue`. Only one
         * animation can drive a `MotionValue` at one time.
         *
         * ```jsx
         * value.start()
         * ```
         *
         * @param animation - A function that starts the provided animation
         *
         * @internal
         */
        start(startAnimation) {
            this.stop();
            return new Promise((resolve) => {
                this.hasAnimated = true;
                this.animation = startAnimation(resolve);
                if (this.events.animationStart) {
                    this.events.animationStart.notify();
                }
            }).then(() => {
                if (this.events.animationComplete) {
                    this.events.animationComplete.notify();
                }
                this.clearAnimation();
            });
        }
        /**
         * Stop the currently active animation.
         *
         * @public
         */
        stop() {
            if (this.animation) {
                this.animation.stop();
                if (this.events.animationCancel) {
                    this.events.animationCancel.notify();
                }
            }
            this.clearAnimation();
        }
        /**
         * Returns `true` if this value is currently animating.
         *
         * @public
         */
        isAnimating() {
            return !!this.animation;
        }
        clearAnimation() {
            delete this.animation;
        }
        /**
         * Destroy and clean up subscribers to this `MotionValue`.
         *
         * The `MotionValue` hooks like `useMotionValue` and `useTransform` automatically
         * handle the lifecycle of the returned `MotionValue`, so this method is only necessary if you've manually
         * created a `MotionValue` via the `motionValue` function.
         *
         * @public
         */
        destroy() {
            this.clearListeners();
            this.stop();
            if (this.stopPassiveEffect) {
                this.stopPassiveEffect();
            }
        }
    }
    function motionValue(init, options) {
        return new MotionValue(init, options);
    }

    let warning = noop;
    let invariant = noop;
    {
        warning = (check, message) => {
            if (!check && typeof console !== "undefined") {
                console.warn(message);
            }
        };
        invariant = (check, message) => {
            if (!check) {
                throw new Error(message);
            }
        };
    }

    const visualElementStore = new WeakMap();

    function memo(callback) {
        let result;
        return () => {
            if (result === undefined)
                result = callback();
            return result;
        };
    }

    /**
     * Generate a list of every possible transform key.
     */
    const transformPropOrder = [
        "transformPerspective",
        "x",
        "y",
        "z",
        "translateX",
        "translateY",
        "translateZ",
        "scale",
        "scaleX",
        "scaleY",
        "rotate",
        "rotateX",
        "rotateY",
        "rotateZ",
        "skew",
        "skewX",
        "skewY",
    ];
    /**
     * A quick lookup for transform props.
     */
    const transformProps = new Set(transformPropOrder);

    /**
     * Converts seconds to milliseconds
     *
     * @param seconds - Time in seconds.
     * @return milliseconds - Converted time in milliseconds.
     */
    const secondsToMilliseconds = (seconds) => seconds * 1000;
    const millisecondsToSeconds = (milliseconds) => milliseconds / 1000;

    const underDampedSpring = {
        type: "spring",
        stiffness: 500,
        damping: 25,
        restSpeed: 10,
    };
    const criticallyDampedSpring = (target) => ({
        type: "spring",
        stiffness: 550,
        damping: target === 0 ? 2 * Math.sqrt(550) : 30,
        restSpeed: 10,
    });
    const keyframesTransition = {
        type: "keyframes",
        duration: 0.8,
    };
    /**
     * Default easing curve is a slightly shallower version of
     * the default browser easing curve.
     */
    const ease = {
        type: "keyframes",
        ease: [0.25, 0.1, 0.35, 1],
        duration: 0.3,
    };
    const getDefaultTransition = (valueKey, { keyframes }) => {
        if (keyframes.length > 2) {
            return keyframesTransition;
        }
        else if (transformProps.has(valueKey)) {
            return valueKey.startsWith("scale")
                ? criticallyDampedSpring(keyframes[1])
                : underDampedSpring;
        }
        return ease;
    };

    const isNotNull = (value) => value !== null;
    function getFinalKeyframe(keyframes, { repeat, repeatType = "loop" }, finalKeyframe) {
        const resolvedKeyframes = keyframes.filter(isNotNull);
        const index = repeat && repeatType !== "loop" && repeat % 2 === 1
            ? 0
            : resolvedKeyframes.length - 1;
        return !index || finalKeyframe === undefined
            ? resolvedKeyframes[index]
            : finalKeyframe;
    }

    /**
     * Check if the value is a zero value string like "0px" or "0%"
     */
    const isZeroValueString = (v) => /^0[^.\s]+$/u.test(v);

    function isNone(value) {
        if (typeof value === "number") {
            return value === 0;
        }
        else if (value !== null) {
            return value === "none" || value === "0" || isZeroValueString(value);
        }
        else {
            return true;
        }
    }

    /**
     * Check if value is a numerical string, ie a string that is purely a number eg "100" or "-100.1"
     */
    const isNumericalString = (v) => /^-?(?:\d+(?:\.\d+)?|\.\d+)$/u.test(v);

    const checkStringStartsWith = (token) => (key) => typeof key === "string" && key.startsWith(token);
    const isCSSVariableName = checkStringStartsWith("--");
    const startsAsVariableToken = checkStringStartsWith("var(--");
    const isCSSVariableToken = (value) => {
        const startsWithToken = startsAsVariableToken(value);
        if (!startsWithToken)
            return false;
        // Ensure any comments are stripped from the value as this can harm performance of the regex.
        return singleCssVariableRegex.test(value.split("/*")[0].trim());
    };
    const singleCssVariableRegex = /var\(--(?:[\w-]+\s*|[\w-]+\s*,(?:\s*[^)(\s]|\s*\((?:[^)(]|\([^)(]*\))*\))+\s*)\)$/iu;

    /**
     * Parse Framer's special CSS variable format into a CSS token and a fallback.
     *
     * ```
     * `var(--foo, #fff)` => [`--foo`, '#fff']
     * ```
     *
     * @param current
     */
    const splitCSSVariableRegex = 
    // eslint-disable-next-line redos-detector/no-unsafe-regex -- false positive, as it can match a lot of words
    /^var\(--(?:([\w-]+)|([\w-]+), ?([a-zA-Z\d ()%#.,-]+))\)/u;
    function parseCSSVariable(current) {
        const match = splitCSSVariableRegex.exec(current);
        if (!match)
            return [,];
        const [, token1, token2, fallback] = match;
        return [`--${token1 !== null && token1 !== void 0 ? token1 : token2}`, fallback];
    }
    const maxDepth = 4;
    function getVariableValue(current, element, depth = 1) {
        invariant(depth <= maxDepth, `Max CSS variable fallback depth detected in property "${current}". This may indicate a circular fallback dependency.`);
        const [token, fallback] = parseCSSVariable(current);
        // No CSS variable detected
        if (!token)
            return;
        // Attempt to read this CSS variable off the element
        const resolved = window.getComputedStyle(element).getPropertyValue(token);
        if (resolved) {
            const trimmed = resolved.trim();
            return isNumericalString(trimmed) ? parseFloat(trimmed) : trimmed;
        }
        return isCSSVariableToken(fallback)
            ? getVariableValue(fallback, element, depth + 1)
            : fallback;
    }

    const clamp = (min, max, v) => {
        if (v > max)
            return max;
        if (v < min)
            return min;
        return v;
    };

    const number = {
        test: (v) => typeof v === "number",
        parse: parseFloat,
        transform: (v) => v,
    };
    const alpha = {
        ...number,
        transform: (v) => clamp(0, 1, v),
    };
    const scale = {
        ...number,
        default: 1,
    };

    const positionalKeys = new Set([
        "width",
        "height",
        "top",
        "left",
        "right",
        "bottom",
        "x",
        "y",
        "translateX",
        "translateY",
    ]);
    const isNumOrPxType = (v) => v === number || v === px;
    const getPosFromMatrix = (matrix, pos) => parseFloat(matrix.split(", ")[pos]);
    const getTranslateFromMatrix = (pos2, pos3) => (_bbox, { transform }) => {
        if (transform === "none" || !transform)
            return 0;
        const matrix3d = transform.match(/^matrix3d\((.+)\)$/u);
        if (matrix3d) {
            return getPosFromMatrix(matrix3d[1], pos3);
        }
        else {
            const matrix = transform.match(/^matrix\((.+)\)$/u);
            if (matrix) {
                return getPosFromMatrix(matrix[1], pos2);
            }
            else {
                return 0;
            }
        }
    };
    const transformKeys = new Set(["x", "y", "z"]);
    const nonTranslationalTransformKeys = transformPropOrder.filter((key) => !transformKeys.has(key));
    function removeNonTranslationalTransform(visualElement) {
        const removedTransforms = [];
        nonTranslationalTransformKeys.forEach((key) => {
            const value = visualElement.getValue(key);
            if (value !== undefined) {
                removedTransforms.push([key, value.get()]);
                value.set(key.startsWith("scale") ? 1 : 0);
            }
        });
        return removedTransforms;
    }
    const positionalValues = {
        // Dimensions
        width: ({ x }, { paddingLeft = "0", paddingRight = "0" }) => x.max - x.min - parseFloat(paddingLeft) - parseFloat(paddingRight),
        height: ({ y }, { paddingTop = "0", paddingBottom = "0" }) => y.max - y.min - parseFloat(paddingTop) - parseFloat(paddingBottom),
        top: (_bbox, { top }) => parseFloat(top),
        left: (_bbox, { left }) => parseFloat(left),
        bottom: ({ y }, { top }) => parseFloat(top) + (y.max - y.min),
        right: ({ x }, { left }) => parseFloat(left) + (x.max - x.min),
        // Transform
        x: getTranslateFromMatrix(4, 13),
        y: getTranslateFromMatrix(5, 14),
    };
    // Alias translate longform names
    positionalValues.translateX = positionalValues.x;
    positionalValues.translateY = positionalValues.y;

    /**
     * Tests a provided value against a ValueType
     */
    const testValueType = (v) => (type) => type.test(v);

    /**
     * ValueType for "auto"
     */
    const auto = {
        test: (v) => v === "auto",
        parse: (v) => v,
    };

    /**
     * A list of value types commonly used for dimensions
     */
    const dimensionValueTypes = [number, px, percent, degrees, vw, vh, auto];
    /**
     * Tests a dimensional value against the list of dimension ValueTypes
     */
    const findDimensionValueType = (v) => dimensionValueTypes.find(testValueType(v));

    const toResolve = new Set();
    let isScheduled = false;
    let anyNeedsMeasurement = false;
    function measureAllKeyframes() {
        if (anyNeedsMeasurement) {
            const resolversToMeasure = Array.from(toResolve).filter((resolver) => resolver.needsMeasurement);
            const elementsToMeasure = new Set(resolversToMeasure.map((resolver) => resolver.element));
            const transformsToRestore = new Map();
            /**
             * Write pass
             * If we're measuring elements we want to remove bounding box-changing transforms.
             */
            elementsToMeasure.forEach((element) => {
                const removedTransforms = removeNonTranslationalTransform(element);
                if (!removedTransforms.length)
                    return;
                transformsToRestore.set(element, removedTransforms);
                element.render();
            });
            // Read
            resolversToMeasure.forEach((resolver) => resolver.measureInitialState());
            // Write
            elementsToMeasure.forEach((element) => {
                element.render();
                const restore = transformsToRestore.get(element);
                if (restore) {
                    restore.forEach(([key, value]) => {
                        var _a;
                        (_a = element.getValue(key)) === null || _a === void 0 ? void 0 : _a.set(value);
                    });
                }
            });
            // Read
            resolversToMeasure.forEach((resolver) => resolver.measureEndState());
            // Write
            resolversToMeasure.forEach((resolver) => {
                if (resolver.suspendedScrollY !== undefined) {
                    window.scrollTo(0, resolver.suspendedScrollY);
                }
            });
        }
        anyNeedsMeasurement = false;
        isScheduled = false;
        toResolve.forEach((resolver) => resolver.complete());
        toResolve.clear();
    }
    function readAllKeyframes() {
        toResolve.forEach((resolver) => {
            resolver.readKeyframes();
            if (resolver.needsMeasurement) {
                anyNeedsMeasurement = true;
            }
        });
    }
    function flushKeyframeResolvers() {
        readAllKeyframes();
        measureAllKeyframes();
    }
    class KeyframeResolver {
        constructor(unresolvedKeyframes, onComplete, name, motionValue, element, isAsync = false) {
            /**
             * Track whether this resolver has completed. Once complete, it never
             * needs to attempt keyframe resolution again.
             */
            this.isComplete = false;
            /**
             * Track whether this resolver is async. If it is, it'll be added to the
             * resolver queue and flushed in the next frame. Resolvers that aren't going
             * to trigger read/write thrashing don't need to be async.
             */
            this.isAsync = false;
            /**
             * Track whether this resolver needs to perform a measurement
             * to resolve its keyframes.
             */
            this.needsMeasurement = false;
            /**
             * Track whether this resolver is currently scheduled to resolve
             * to allow it to be cancelled and resumed externally.
             */
            this.isScheduled = false;
            this.unresolvedKeyframes = [...unresolvedKeyframes];
            this.onComplete = onComplete;
            this.name = name;
            this.motionValue = motionValue;
            this.element = element;
            this.isAsync = isAsync;
        }
        scheduleResolve() {
            this.isScheduled = true;
            if (this.isAsync) {
                toResolve.add(this);
                if (!isScheduled) {
                    isScheduled = true;
                    frame.read(readAllKeyframes);
                    frame.resolveKeyframes(measureAllKeyframes);
                }
            }
            else {
                this.readKeyframes();
                this.complete();
            }
        }
        readKeyframes() {
            const { unresolvedKeyframes, name, element, motionValue } = this;
            /**
             * If a keyframe is null, we hydrate it either by reading it from
             * the instance, or propagating from previous keyframes.
             */
            for (let i = 0; i < unresolvedKeyframes.length; i++) {
                if (unresolvedKeyframes[i] === null) {
                    /**
                     * If the first keyframe is null, we need to find its value by sampling the element
                     */
                    if (i === 0) {
                        const currentValue = motionValue === null || motionValue === void 0 ? void 0 : motionValue.get();
                        const finalKeyframe = unresolvedKeyframes[unresolvedKeyframes.length - 1];
                        if (currentValue !== undefined) {
                            unresolvedKeyframes[0] = currentValue;
                        }
                        else if (element && name) {
                            const valueAsRead = element.readValue(name, finalKeyframe);
                            if (valueAsRead !== undefined && valueAsRead !== null) {
                                unresolvedKeyframes[0] = valueAsRead;
                            }
                        }
                        if (unresolvedKeyframes[0] === undefined) {
                            unresolvedKeyframes[0] = finalKeyframe;
                        }
                        if (motionValue && currentValue === undefined) {
                            motionValue.set(unresolvedKeyframes[0]);
                        }
                    }
                    else {
                        unresolvedKeyframes[i] = unresolvedKeyframes[i - 1];
                    }
                }
            }
        }
        setFinalKeyframe() { }
        measureInitialState() { }
        renderEndStyles() { }
        measureEndState() { }
        complete() {
            this.isComplete = true;
            this.onComplete(this.unresolvedKeyframes, this.finalKeyframe);
            toResolve.delete(this);
        }
        cancel() {
            if (!this.isComplete) {
                this.isScheduled = false;
                toResolve.delete(this);
            }
        }
        resume() {
            if (!this.isComplete)
                this.scheduleResolve();
        }
    }

    /**
     * Returns true if the provided string is a color, ie rgba(0,0,0,0) or #000,
     * but false if a number or multiple colors
     */
    const isColorString = (type, testProp) => (v) => {
        return Boolean((isString(v) && singleColorRegex.test(v) && v.startsWith(type)) ||
            (testProp && Object.prototype.hasOwnProperty.call(v, testProp)));
    };
    const splitColor = (aName, bName, cName) => (v) => {
        if (!isString(v))
            return v;
        const [a, b, c, alpha] = v.match(floatRegex);
        return {
            [aName]: parseFloat(a),
            [bName]: parseFloat(b),
            [cName]: parseFloat(c),
            alpha: alpha !== undefined ? parseFloat(alpha) : 1,
        };
    };

    const clampRgbUnit = (v) => clamp(0, 255, v);
    const rgbUnit = {
        ...number,
        transform: (v) => Math.round(clampRgbUnit(v)),
    };
    const rgba = {
        test: isColorString("rgb", "red"),
        parse: splitColor("red", "green", "blue"),
        transform: ({ red, green, blue, alpha: alpha$1 = 1 }) => "rgba(" +
            rgbUnit.transform(red) +
            ", " +
            rgbUnit.transform(green) +
            ", " +
            rgbUnit.transform(blue) +
            ", " +
            sanitize(alpha.transform(alpha$1)) +
            ")",
    };

    function parseHex(v) {
        let r = "";
        let g = "";
        let b = "";
        let a = "";
        // If we have 6 characters, ie #FF0000
        if (v.length > 5) {
            r = v.substring(1, 3);
            g = v.substring(3, 5);
            b = v.substring(5, 7);
            a = v.substring(7, 9);
            // Or we have 3 characters, ie #F00
        }
        else {
            r = v.substring(1, 2);
            g = v.substring(2, 3);
            b = v.substring(3, 4);
            a = v.substring(4, 5);
            r += r;
            g += g;
            b += b;
            a += a;
        }
        return {
            red: parseInt(r, 16),
            green: parseInt(g, 16),
            blue: parseInt(b, 16),
            alpha: a ? parseInt(a, 16) / 255 : 1,
        };
    }
    const hex = {
        test: isColorString("#"),
        parse: parseHex,
        transform: rgba.transform,
    };

    const hsla = {
        test: isColorString("hsl", "hue"),
        parse: splitColor("hue", "saturation", "lightness"),
        transform: ({ hue, saturation, lightness, alpha: alpha$1 = 1 }) => {
            return ("hsla(" +
                Math.round(hue) +
                ", " +
                percent.transform(sanitize(saturation)) +
                ", " +
                percent.transform(sanitize(lightness)) +
                ", " +
                sanitize(alpha.transform(alpha$1)) +
                ")");
        },
    };

    const color = {
        test: (v) => rgba.test(v) || hex.test(v) || hsla.test(v),
        parse: (v) => {
            if (rgba.test(v)) {
                return rgba.parse(v);
            }
            else if (hsla.test(v)) {
                return hsla.parse(v);
            }
            else {
                return hex.parse(v);
            }
        },
        transform: (v) => {
            return isString(v)
                ? v
                : v.hasOwnProperty("red")
                    ? rgba.transform(v)
                    : hsla.transform(v);
        },
    };

    function test(v) {
        var _a, _b;
        return (isNaN(v) &&
            isString(v) &&
            (((_a = v.match(floatRegex)) === null || _a === void 0 ? void 0 : _a.length) || 0) +
                (((_b = v.match(colorRegex)) === null || _b === void 0 ? void 0 : _b.length) || 0) >
                0);
    }
    const NUMBER_TOKEN = "number";
    const COLOR_TOKEN = "color";
    const VAR_TOKEN = "var";
    const VAR_FUNCTION_TOKEN = "var(";
    const SPLIT_TOKEN = "${}";
    // this regex consists of the `singleCssVariableRegex|rgbHSLValueRegex|digitRegex`
    const complexRegex = /var\s*\(\s*--(?:[\w-]+\s*|[\w-]+\s*,(?:\s*[^)(\s]|\s*\((?:[^)(]|\([^)(]*\))*\))+\s*)\)|#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\)|-?(?:\d+(?:\.\d+)?|\.\d+)/giu;
    function analyseComplexValue(value) {
        const originalValue = value.toString();
        const values = [];
        const indexes = {
            color: [],
            number: [],
            var: [],
        };
        const types = [];
        let i = 0;
        const tokenised = originalValue.replace(complexRegex, (parsedValue) => {
            if (color.test(parsedValue)) {
                indexes.color.push(i);
                types.push(COLOR_TOKEN);
                values.push(color.parse(parsedValue));
            }
            else if (parsedValue.startsWith(VAR_FUNCTION_TOKEN)) {
                indexes.var.push(i);
                types.push(VAR_TOKEN);
                values.push(parsedValue);
            }
            else {
                indexes.number.push(i);
                types.push(NUMBER_TOKEN);
                values.push(parseFloat(parsedValue));
            }
            ++i;
            return SPLIT_TOKEN;
        });
        const split = tokenised.split(SPLIT_TOKEN);
        return { values, split, indexes, types };
    }
    function parseComplexValue(v) {
        return analyseComplexValue(v).values;
    }
    function createTransformer(source) {
        const { split, types } = analyseComplexValue(source);
        const numSections = split.length;
        return (v) => {
            let output = "";
            for (let i = 0; i < numSections; i++) {
                output += split[i];
                if (v[i] !== undefined) {
                    const type = types[i];
                    if (type === NUMBER_TOKEN) {
                        output += sanitize(v[i]);
                    }
                    else if (type === COLOR_TOKEN) {
                        output += color.transform(v[i]);
                    }
                    else {
                        output += v[i];
                    }
                }
            }
            return output;
        };
    }
    const convertNumbersToZero = (v) => typeof v === "number" ? 0 : v;
    function getAnimatableNone$1(v) {
        const parsed = parseComplexValue(v);
        const transformer = createTransformer(v);
        return transformer(parsed.map(convertNumbersToZero));
    }
    const complex = {
        test,
        parse: parseComplexValue,
        createTransformer,
        getAnimatableNone: getAnimatableNone$1,
    };

    /**
     * Properties that should default to 1 or 100%
     */
    const maxDefaults = new Set(["brightness", "contrast", "saturate", "opacity"]);
    function applyDefaultFilter(v) {
        const [name, value] = v.slice(0, -1).split("(");
        if (name === "drop-shadow")
            return v;
        const [number] = value.match(floatRegex) || [];
        if (!number)
            return v;
        const unit = value.replace(number, "");
        let defaultValue = maxDefaults.has(name) ? 1 : 0;
        if (number !== value)
            defaultValue *= 100;
        return name + "(" + defaultValue + unit + ")";
    }
    const functionRegex = /\b([a-z-]*)\(.*?\)/gu;
    const filter = {
        ...complex,
        getAnimatableNone: (v) => {
            const functions = v.match(functionRegex);
            return functions ? functions.map(applyDefaultFilter).join(" ") : v;
        },
    };

    const int = {
        ...number,
        transform: Math.round,
    };

    const numberValueTypes = {
        // Border props
        borderWidth: px,
        borderTopWidth: px,
        borderRightWidth: px,
        borderBottomWidth: px,
        borderLeftWidth: px,
        borderRadius: px,
        radius: px,
        borderTopLeftRadius: px,
        borderTopRightRadius: px,
        borderBottomRightRadius: px,
        borderBottomLeftRadius: px,
        // Positioning props
        width: px,
        maxWidth: px,
        height: px,
        maxHeight: px,
        size: px,
        top: px,
        right: px,
        bottom: px,
        left: px,
        // Spacing props
        padding: px,
        paddingTop: px,
        paddingRight: px,
        paddingBottom: px,
        paddingLeft: px,
        margin: px,
        marginTop: px,
        marginRight: px,
        marginBottom: px,
        marginLeft: px,
        // Transform props
        rotate: degrees,
        rotateX: degrees,
        rotateY: degrees,
        rotateZ: degrees,
        scale,
        scaleX: scale,
        scaleY: scale,
        scaleZ: scale,
        skew: degrees,
        skewX: degrees,
        skewY: degrees,
        distance: px,
        translateX: px,
        translateY: px,
        translateZ: px,
        x: px,
        y: px,
        z: px,
        perspective: px,
        transformPerspective: px,
        opacity: alpha,
        originX: progressPercentage,
        originY: progressPercentage,
        originZ: px,
        // Misc
        zIndex: int,
        backgroundPositionX: px,
        backgroundPositionY: px,
        // SVG
        fillOpacity: alpha,
        strokeOpacity: alpha,
        numOctaves: int,
    };

    /**
     * A map of default value types for common values
     */
    const defaultValueTypes = {
        ...numberValueTypes,
        // Color props
        color,
        backgroundColor: color,
        outlineColor: color,
        fill: color,
        stroke: color,
        // Border props
        borderColor: color,
        borderTopColor: color,
        borderRightColor: color,
        borderBottomColor: color,
        borderLeftColor: color,
        filter,
        WebkitFilter: filter,
    };
    /**
     * Gets the default ValueType for the provided value key
     */
    const getDefaultValueType = (key) => defaultValueTypes[key];

    function getAnimatableNone(key, value) {
        let defaultValueType = getDefaultValueType(key);
        if (defaultValueType !== filter)
            defaultValueType = complex;
        // If value is not recognised as animatable, ie "none", create an animatable version origin based on the target
        return defaultValueType.getAnimatableNone
            ? defaultValueType.getAnimatableNone(value)
            : undefined;
    }

    /**
     * If we encounter keyframes like "none" or "0" and we also have keyframes like
     * "#fff" or "200px 200px" we want to find a keyframe to serve as a template for
     * the "none" keyframes. In this case "#fff" or "200px 200px" - then these get turned into
     * zero equivalents, i.e. "#fff0" or "0px 0px".
     */
    const invalidTemplates = new Set(["auto", "none", "0"]);
    function makeNoneKeyframesAnimatable(unresolvedKeyframes, noneKeyframeIndexes, name) {
        let i = 0;
        let animatableTemplate = undefined;
        while (i < unresolvedKeyframes.length && !animatableTemplate) {
            const keyframe = unresolvedKeyframes[i];
            if (typeof keyframe === "string" &&
                !invalidTemplates.has(keyframe) &&
                analyseComplexValue(keyframe).values.length) {
                animatableTemplate = unresolvedKeyframes[i];
            }
            i++;
        }
        if (animatableTemplate && name) {
            for (const noneIndex of noneKeyframeIndexes) {
                unresolvedKeyframes[noneIndex] = getAnimatableNone(name, animatableTemplate);
            }
        }
    }

    class DOMKeyframesResolver extends KeyframeResolver {
        constructor(unresolvedKeyframes, onComplete, name, motionValue) {
            super(unresolvedKeyframes, onComplete, name, motionValue, motionValue === null || motionValue === void 0 ? void 0 : motionValue.owner, true);
        }
        readKeyframes() {
            const { unresolvedKeyframes, element, name } = this;
            if (!element.current)
                return;
            super.readKeyframes();
            /**
             * If any keyframe is a CSS variable, we need to find its value by sampling the element
             */
            for (let i = 0; i < unresolvedKeyframes.length; i++) {
                const keyframe = unresolvedKeyframes[i];
                if (typeof keyframe === "string" && isCSSVariableToken(keyframe)) {
                    const resolved = getVariableValue(keyframe, element.current);
                    if (resolved !== undefined) {
                        unresolvedKeyframes[i] = resolved;
                    }
                    if (i === unresolvedKeyframes.length - 1) {
                        this.finalKeyframe = keyframe;
                    }
                }
            }
            /**
             * Resolve "none" values. We do this potentially twice - once before and once after measuring keyframes.
             * This could be seen as inefficient but it's a trade-off to avoid measurements in more situations, which
             * have a far bigger performance impact.
             */
            this.resolveNoneKeyframes();
            /**
             * Check to see if unit type has changed. If so schedule jobs that will
             * temporarily set styles to the destination keyframes.
             * Skip if we have more than two keyframes or this isn't a positional value.
             * TODO: We can throw if there are multiple keyframes and the value type changes.
             */
            if (!positionalKeys.has(name) || unresolvedKeyframes.length !== 2) {
                return;
            }
            const [origin, target] = unresolvedKeyframes;
            const originType = findDimensionValueType(origin);
            const targetType = findDimensionValueType(target);
            /**
             * Either we don't recognise these value types or we can animate between them.
             */
            if (originType === targetType)
                return;
            /**
             * If both values are numbers or pixels, we can animate between them by
             * converting them to numbers.
             */
            if (isNumOrPxType(originType) && isNumOrPxType(targetType)) {
                for (let i = 0; i < unresolvedKeyframes.length; i++) {
                    const value = unresolvedKeyframes[i];
                    if (typeof value === "string") {
                        unresolvedKeyframes[i] = parseFloat(value);
                    }
                }
            }
            else {
                /**
                 * Else, the only way to resolve this is by measuring the element.
                 */
                this.needsMeasurement = true;
            }
        }
        resolveNoneKeyframes() {
            const { unresolvedKeyframes, name } = this;
            const noneKeyframeIndexes = [];
            for (let i = 0; i < unresolvedKeyframes.length; i++) {
                if (isNone(unresolvedKeyframes[i])) {
                    noneKeyframeIndexes.push(i);
                }
            }
            if (noneKeyframeIndexes.length) {
                makeNoneKeyframesAnimatable(unresolvedKeyframes, noneKeyframeIndexes, name);
            }
        }
        measureInitialState() {
            const { element, unresolvedKeyframes, name } = this;
            if (!element.current)
                return;
            if (name === "height") {
                this.suspendedScrollY = window.pageYOffset;
            }
            this.measuredOrigin = positionalValues[name](element.measureViewportBox(), window.getComputedStyle(element.current));
            unresolvedKeyframes[0] = this.measuredOrigin;
            // Set final key frame to measure after next render
            const measureKeyframe = unresolvedKeyframes[unresolvedKeyframes.length - 1];
            if (measureKeyframe !== undefined) {
                element.getValue(name, measureKeyframe).jump(measureKeyframe, false);
            }
        }
        measureEndState() {
            var _a;
            const { element, name, unresolvedKeyframes } = this;
            if (!element.current)
                return;
            const value = element.getValue(name);
            value && value.jump(this.measuredOrigin, false);
            const finalKeyframeIndex = unresolvedKeyframes.length - 1;
            const finalKeyframe = unresolvedKeyframes[finalKeyframeIndex];
            unresolvedKeyframes[finalKeyframeIndex] = positionalValues[name](element.measureViewportBox(), window.getComputedStyle(element.current));
            if (finalKeyframe !== null && this.finalKeyframe === undefined) {
                this.finalKeyframe = finalKeyframe;
            }
            // If we removed transform values, reapply them before the next render
            if ((_a = this.removedTransforms) === null || _a === void 0 ? void 0 : _a.length) {
                this.removedTransforms.forEach(([unsetTransformName, unsetTransformValue]) => {
                    element
                        .getValue(unsetTransformName)
                        .set(unsetTransformValue);
                });
            }
            this.resolveNoneKeyframes();
        }
    }

    /**
     * Check if a value is animatable. Examples:
     *
     * ✅: 100, "100px", "#fff"
     * ❌: "block", "url(2.jpg)"
     * @param value
     *
     * @internal
     */
    const isAnimatable = (value, name) => {
        // If the list of keys tat might be non-animatable grows, replace with Set
        if (name === "zIndex")
            return false;
        // If it's a number or a keyframes array, we can animate it. We might at some point
        // need to do a deep isAnimatable check of keyframes, or let Popmotion handle this,
        // but for now lets leave it like this for performance reasons
        if (typeof value === "number" || Array.isArray(value))
            return true;
        if (typeof value === "string" && // It's animatable if we have a string
            (complex.test(value) || value === "0") && // And it contains numbers and/or colors
            !value.startsWith("url(") // Unless it starts with "url("
        ) {
            return true;
        }
        return false;
    };

    function hasKeyframesChanged(keyframes) {
        const current = keyframes[0];
        if (keyframes.length === 1)
            return true;
        for (let i = 0; i < keyframes.length; i++) {
            if (keyframes[i] !== current)
                return true;
        }
    }
    function canAnimate(keyframes, name, type, velocity) {
        /**
         * Check if we're able to animate between the start and end keyframes,
         * and throw a warning if we're attempting to animate between one that's
         * animatable and another that isn't.
         */
        const originKeyframe = keyframes[0];
        if (originKeyframe === null)
            return false;
        /**
         * These aren't traditionally animatable but we do support them.
         * In future we could look into making this more generic or replacing
         * this function with mix() === mixImmediate
         */
        if (name === "display" || name === "visibility")
            return true;
        const targetKeyframe = keyframes[keyframes.length - 1];
        const isOriginAnimatable = isAnimatable(originKeyframe, name);
        const isTargetAnimatable = isAnimatable(targetKeyframe, name);
        warning(isOriginAnimatable === isTargetAnimatable, `You are trying to animate ${name} from "${originKeyframe}" to "${targetKeyframe}". ${originKeyframe} is not an animatable value - to enable this animation set ${originKeyframe} to a value animatable to ${targetKeyframe} via the \`style\` property.`);
        // Always skip if any of these are true
        if (!isOriginAnimatable || !isTargetAnimatable) {
            return false;
        }
        return hasKeyframesChanged(keyframes) || (type === "spring" && velocity);
    }

    class BaseAnimation {
        constructor({ autoplay = true, delay = 0, type = "keyframes", repeat = 0, repeatDelay = 0, repeatType = "loop", ...options }) {
            // Track whether the animation has been stopped. Stopped animations won't restart.
            this.isStopped = false;
            this.hasAttemptedResolve = false;
            this.options = {
                autoplay,
                delay,
                type,
                repeat,
                repeatDelay,
                repeatType,
                ...options,
            };
            this.updateFinishedPromise();
        }
        /**
         * A getter for resolved data. If keyframes are not yet resolved, accessing
         * this.resolved will synchronously flush all pending keyframe resolvers.
         * This is a deoptimisation, but at its worst still batches read/writes.
         */
        get resolved() {
            if (!this._resolved && !this.hasAttemptedResolve) {
                flushKeyframeResolvers();
            }
            return this._resolved;
        }
        /**
         * A method to be called when the keyframes resolver completes. This method
         * will check if its possible to run the animation and, if not, skip it.
         * Otherwise, it will call initPlayback on the implementing class.
         */
        onKeyframesResolved(keyframes, finalKeyframe) {
            this.hasAttemptedResolve = true;
            const { name, type, velocity, delay, onComplete, onUpdate, isGenerator, } = this.options;
            /**
             * If we can't animate this value with the resolved keyframes
             * then we should complete it immediately.
             */
            if (!isGenerator && !canAnimate(keyframes, name, type, velocity)) {
                // Finish immediately
                if (!delay) {
                    onUpdate === null || onUpdate === void 0 ? void 0 : onUpdate(getFinalKeyframe(keyframes, this.options, finalKeyframe));
                    onComplete === null || onComplete === void 0 ? void 0 : onComplete();
                    this.resolveFinishedPromise();
                    return;
                }
                // Finish after a delay
                else {
                    this.options.duration = 0;
                }
            }
            const resolvedAnimation = this.initPlayback(keyframes, finalKeyframe);
            if (resolvedAnimation === false)
                return;
            this._resolved = {
                keyframes,
                finalKeyframe,
                ...resolvedAnimation,
            };
            this.onPostResolved();
        }
        onPostResolved() { }
        /**
         * Allows the returned animation to be awaited or promise-chained. Currently
         * resolves when the animation finishes at all but in a future update could/should
         * reject if its cancels.
         */
        then(resolve, reject) {
            return this.currentFinishedPromise.then(resolve, reject);
        }
        updateFinishedPromise() {
            this.currentFinishedPromise = new Promise((resolve) => {
                this.resolveFinishedPromise = resolve;
            });
        }
    }

    const velocitySampleDuration = 5; // ms
    function calcGeneratorVelocity(resolveValue, t, current) {
        const prevT = Math.max(t - velocitySampleDuration, 0);
        return velocityPerSecond(current - resolveValue(prevT), t - prevT);
    }

    const safeMin = 0.001;
    const minDuration = 0.01;
    const maxDuration$1 = 10.0;
    const minDamping = 0.05;
    const maxDamping = 1;
    function findSpring({ duration = 800, bounce = 0.25, velocity = 0, mass = 1, }) {
        let envelope;
        let derivative;
        warning(duration <= secondsToMilliseconds(maxDuration$1), "Spring duration must be 10 seconds or less");
        let dampingRatio = 1 - bounce;
        /**
         * Restrict dampingRatio and duration to within acceptable ranges.
         */
        dampingRatio = clamp(minDamping, maxDamping, dampingRatio);
        duration = clamp(minDuration, maxDuration$1, millisecondsToSeconds(duration));
        if (dampingRatio < 1) {
            /**
             * Underdamped spring
             */
            envelope = (undampedFreq) => {
                const exponentialDecay = undampedFreq * dampingRatio;
                const delta = exponentialDecay * duration;
                const a = exponentialDecay - velocity;
                const b = calcAngularFreq(undampedFreq, dampingRatio);
                const c = Math.exp(-delta);
                return safeMin - (a / b) * c;
            };
            derivative = (undampedFreq) => {
                const exponentialDecay = undampedFreq * dampingRatio;
                const delta = exponentialDecay * duration;
                const d = delta * velocity + velocity;
                const e = Math.pow(dampingRatio, 2) * Math.pow(undampedFreq, 2) * duration;
                const f = Math.exp(-delta);
                const g = calcAngularFreq(Math.pow(undampedFreq, 2), dampingRatio);
                const factor = -envelope(undampedFreq) + safeMin > 0 ? -1 : 1;
                return (factor * ((d - e) * f)) / g;
            };
        }
        else {
            /**
             * Critically-damped spring
             */
            envelope = (undampedFreq) => {
                const a = Math.exp(-undampedFreq * duration);
                const b = (undampedFreq - velocity) * duration + 1;
                return -safeMin + a * b;
            };
            derivative = (undampedFreq) => {
                const a = Math.exp(-undampedFreq * duration);
                const b = (velocity - undampedFreq) * (duration * duration);
                return a * b;
            };
        }
        const initialGuess = 5 / duration;
        const undampedFreq = approximateRoot(envelope, derivative, initialGuess);
        duration = secondsToMilliseconds(duration);
        if (isNaN(undampedFreq)) {
            return {
                stiffness: 100,
                damping: 10,
                duration,
            };
        }
        else {
            const stiffness = Math.pow(undampedFreq, 2) * mass;
            return {
                stiffness,
                damping: dampingRatio * 2 * Math.sqrt(mass * stiffness),
                duration,
            };
        }
    }
    const rootIterations = 12;
    function approximateRoot(envelope, derivative, initialGuess) {
        let result = initialGuess;
        for (let i = 1; i < rootIterations; i++) {
            result = result - envelope(result) / derivative(result);
        }
        return result;
    }
    function calcAngularFreq(undampedFreq, dampingRatio) {
        return undampedFreq * Math.sqrt(1 - dampingRatio * dampingRatio);
    }

    const durationKeys = ["duration", "bounce"];
    const physicsKeys = ["stiffness", "damping", "mass"];
    function isSpringType(options, keys) {
        return keys.some((key) => options[key] !== undefined);
    }
    function getSpringOptions(options) {
        let springOptions = {
            velocity: 0.0,
            stiffness: 100,
            damping: 10,
            mass: 1.0,
            isResolvedFromDuration: false,
            ...options,
        };
        // stiffness/damping/mass overrides duration/bounce
        if (!isSpringType(options, physicsKeys) &&
            isSpringType(options, durationKeys)) {
            const derived = findSpring(options);
            springOptions = {
                ...springOptions,
                ...derived,
                mass: 1.0,
            };
            springOptions.isResolvedFromDuration = true;
        }
        return springOptions;
    }
    function spring({ keyframes, restDelta, restSpeed, ...options }) {
        const origin = keyframes[0];
        const target = keyframes[keyframes.length - 1];
        /**
         * This is the Iterator-spec return value. We ensure it's mutable rather than using a generator
         * to reduce GC during animation.
         */
        const state = { done: false, value: origin };
        const { stiffness, damping, mass, duration, velocity, isResolvedFromDuration, } = getSpringOptions({
            ...options,
            velocity: -millisecondsToSeconds(options.velocity || 0),
        });
        const initialVelocity = velocity || 0.0;
        const dampingRatio = damping / (2 * Math.sqrt(stiffness * mass));
        const initialDelta = target - origin;
        const undampedAngularFreq = millisecondsToSeconds(Math.sqrt(stiffness / mass));
        /**
         * If we're working on a granular scale, use smaller defaults for determining
         * when the spring is finished.
         *
         * These defaults have been selected emprically based on what strikes a good
         * ratio between feeling good and finishing as soon as changes are imperceptible.
         */
        const isGranularScale = Math.abs(initialDelta) < 5;
        restSpeed || (restSpeed = isGranularScale ? 0.01 : 2);
        restDelta || (restDelta = isGranularScale ? 0.005 : 0.5);
        let resolveSpring;
        if (dampingRatio < 1) {
            const angularFreq = calcAngularFreq(undampedAngularFreq, dampingRatio);
            // Underdamped spring
            resolveSpring = (t) => {
                const envelope = Math.exp(-dampingRatio * undampedAngularFreq * t);
                return (target -
                    envelope *
                        (((initialVelocity +
                            dampingRatio * undampedAngularFreq * initialDelta) /
                            angularFreq) *
                            Math.sin(angularFreq * t) +
                            initialDelta * Math.cos(angularFreq * t)));
            };
        }
        else if (dampingRatio === 1) {
            // Critically damped spring
            resolveSpring = (t) => target -
                Math.exp(-undampedAngularFreq * t) *
                    (initialDelta +
                        (initialVelocity + undampedAngularFreq * initialDelta) * t);
        }
        else {
            // Overdamped spring
            const dampedAngularFreq = undampedAngularFreq * Math.sqrt(dampingRatio * dampingRatio - 1);
            resolveSpring = (t) => {
                const envelope = Math.exp(-dampingRatio * undampedAngularFreq * t);
                // When performing sinh or cosh values can hit Infinity so we cap them here
                const freqForT = Math.min(dampedAngularFreq * t, 300);
                return (target -
                    (envelope *
                        ((initialVelocity +
                            dampingRatio * undampedAngularFreq * initialDelta) *
                            Math.sinh(freqForT) +
                            dampedAngularFreq *
                                initialDelta *
                                Math.cosh(freqForT))) /
                        dampedAngularFreq);
            };
        }
        return {
            calculatedDuration: isResolvedFromDuration ? duration || null : null,
            next: (t) => {
                const current = resolveSpring(t);
                if (!isResolvedFromDuration) {
                    let currentVelocity = initialVelocity;
                    if (t !== 0) {
                        /**
                         * We only need to calculate velocity for under-damped springs
                         * as over- and critically-damped springs can't overshoot, so
                         * checking only for displacement is enough.
                         */
                        if (dampingRatio < 1) {
                            currentVelocity = calcGeneratorVelocity(resolveSpring, t, current);
                        }
                        else {
                            currentVelocity = 0;
                        }
                    }
                    const isBelowVelocityThreshold = Math.abs(currentVelocity) <= restSpeed;
                    const isBelowDisplacementThreshold = Math.abs(target - current) <= restDelta;
                    state.done =
                        isBelowVelocityThreshold && isBelowDisplacementThreshold;
                }
                else {
                    state.done = t >= duration;
                }
                state.value = state.done ? target : current;
                return state;
            },
        };
    }

    function inertia({ keyframes, velocity = 0.0, power = 0.8, timeConstant = 325, bounceDamping = 10, bounceStiffness = 500, modifyTarget, min, max, restDelta = 0.5, restSpeed, }) {
        const origin = keyframes[0];
        const state = {
            done: false,
            value: origin,
        };
        const isOutOfBounds = (v) => (min !== undefined && v < min) || (max !== undefined && v > max);
        const nearestBoundary = (v) => {
            if (min === undefined)
                return max;
            if (max === undefined)
                return min;
            return Math.abs(min - v) < Math.abs(max - v) ? min : max;
        };
        let amplitude = power * velocity;
        const ideal = origin + amplitude;
        const target = modifyTarget === undefined ? ideal : modifyTarget(ideal);
        /**
         * If the target has changed we need to re-calculate the amplitude, otherwise
         * the animation will start from the wrong position.
         */
        if (target !== ideal)
            amplitude = target - origin;
        const calcDelta = (t) => -amplitude * Math.exp(-t / timeConstant);
        const calcLatest = (t) => target + calcDelta(t);
        const applyFriction = (t) => {
            const delta = calcDelta(t);
            const latest = calcLatest(t);
            state.done = Math.abs(delta) <= restDelta;
            state.value = state.done ? target : latest;
        };
        /**
         * Ideally this would resolve for t in a stateless way, we could
         * do that by always precalculating the animation but as we know
         * this will be done anyway we can assume that spring will
         * be discovered during that.
         */
        let timeReachedBoundary;
        let spring$1;
        const checkCatchBoundary = (t) => {
            if (!isOutOfBounds(state.value))
                return;
            timeReachedBoundary = t;
            spring$1 = spring({
                keyframes: [state.value, nearestBoundary(state.value)],
                velocity: calcGeneratorVelocity(calcLatest, t, state.value), // TODO: This should be passing * 1000
                damping: bounceDamping,
                stiffness: bounceStiffness,
                restDelta,
                restSpeed,
            });
        };
        checkCatchBoundary(0);
        return {
            calculatedDuration: null,
            next: (t) => {
                /**
                 * We need to resolve the friction to figure out if we need a
                 * spring but we don't want to do this twice per frame. So here
                 * we flag if we updated for this frame and later if we did
                 * we can skip doing it again.
                 */
                let hasUpdatedFrame = false;
                if (!spring$1 && timeReachedBoundary === undefined) {
                    hasUpdatedFrame = true;
                    applyFriction(t);
                    checkCatchBoundary(t);
                }
                /**
                 * If we have a spring and the provided t is beyond the moment the friction
                 * animation crossed the min/max boundary, use the spring.
                 */
                if (timeReachedBoundary !== undefined && t >= timeReachedBoundary) {
                    return spring$1.next(t - timeReachedBoundary);
                }
                else {
                    !hasUpdatedFrame && applyFriction(t);
                    return state;
                }
            },
        };
    }

    /*
      Bezier function generator
      This has been modified from Gaëtan Renaudeau's BezierEasing
      https://github.com/gre/bezier-easing/blob/master/src/index.js
      https://github.com/gre/bezier-easing/blob/master/LICENSE
      
      I've removed the newtonRaphsonIterate algo because in benchmarking it
      wasn't noticiably faster than binarySubdivision, indeed removing it
      usually improved times, depending on the curve.
      I also removed the lookup table, as for the added bundle size and loop we're
      only cutting ~4 or so subdivision iterations. I bumped the max iterations up
      to 12 to compensate and this still tended to be faster for no perceivable
      loss in accuracy.
      Usage
        const easeOut = cubicBezier(.17,.67,.83,.67);
        const x = easeOut(0.5); // returns 0.627...
    */
    // Returns x(t) given t, x1, and x2, or y(t) given t, y1, and y2.
    const calcBezier = (t, a1, a2) => (((1.0 - 3.0 * a2 + 3.0 * a1) * t + (3.0 * a2 - 6.0 * a1)) * t + 3.0 * a1) *
        t;
    const subdivisionPrecision = 0.0000001;
    const subdivisionMaxIterations = 12;
    function binarySubdivide(x, lowerBound, upperBound, mX1, mX2) {
        let currentX;
        let currentT;
        let i = 0;
        do {
            currentT = lowerBound + (upperBound - lowerBound) / 2.0;
            currentX = calcBezier(currentT, mX1, mX2) - x;
            if (currentX > 0.0) {
                upperBound = currentT;
            }
            else {
                lowerBound = currentT;
            }
        } while (Math.abs(currentX) > subdivisionPrecision &&
            ++i < subdivisionMaxIterations);
        return currentT;
    }
    function cubicBezier(mX1, mY1, mX2, mY2) {
        // If this is a linear gradient, return linear easing
        if (mX1 === mY1 && mX2 === mY2)
            return noop;
        const getTForX = (aX) => binarySubdivide(aX, 0, 1, mX1, mX2);
        // If animation is at start/end, return t without easing
        return (t) => t === 0 || t === 1 ? t : calcBezier(getTForX(t), mY1, mY2);
    }

    const easeIn = cubicBezier(0.42, 0, 1, 1);
    const easeOut = cubicBezier(0, 0, 0.58, 1);
    const easeInOut = cubicBezier(0.42, 0, 0.58, 1);

    const isEasingArray = (ease) => {
        return Array.isArray(ease) && typeof ease[0] !== "number";
    };

    const backOut = cubicBezier(0.33, 1.53, 0.69, 0.99);
    const backIn = reverseEasing(backOut);
    const backInOut = mirrorEasing(backIn);

    const anticipate = (p) => (p *= 2) < 1 ? 0.5 * backIn(p) : 0.5 * (2 - Math.pow(2, -10 * (p - 1)));

    const easingLookup = {
        linear: noop,
        easeIn,
        easeInOut,
        easeOut,
        circIn,
        circInOut,
        circOut,
        backIn,
        backInOut,
        backOut,
        anticipate,
    };
    const easingDefinitionToFunction = (definition) => {
        if (Array.isArray(definition)) {
            // If cubic bezier definition, create bezier curve
            invariant(definition.length === 4, `Cubic bezier arrays must contain four numerical values.`);
            const [x1, y1, x2, y2] = definition;
            return cubicBezier(x1, y1, x2, y2);
        }
        else if (typeof definition === "string") {
            // Else lookup from table
            invariant(easingLookup[definition] !== undefined, `Invalid easing type '${definition}'`);
            return easingLookup[definition];
        }
        return definition;
    };

    /**
     * Pipe
     * Compose other transformers to run linearily
     * pipe(min(20), max(40))
     * @param  {...functions} transformers
     * @return {function}
     */
    const combineFunctions = (a, b) => (v) => b(a(v));
    const pipe = (...transformers) => transformers.reduce(combineFunctions);

    // Adapted from https://gist.github.com/mjackson/5311256
    function hueToRgb(p, q, t) {
        if (t < 0)
            t += 1;
        if (t > 1)
            t -= 1;
        if (t < 1 / 6)
            return p + (q - p) * 6 * t;
        if (t < 1 / 2)
            return q;
        if (t < 2 / 3)
            return p + (q - p) * (2 / 3 - t) * 6;
        return p;
    }
    function hslaToRgba({ hue, saturation, lightness, alpha }) {
        hue /= 360;
        saturation /= 100;
        lightness /= 100;
        let red = 0;
        let green = 0;
        let blue = 0;
        if (!saturation) {
            red = green = blue = lightness;
        }
        else {
            const q = lightness < 0.5
                ? lightness * (1 + saturation)
                : lightness + saturation - lightness * saturation;
            const p = 2 * lightness - q;
            red = hueToRgb(p, q, hue + 1 / 3);
            green = hueToRgb(p, q, hue);
            blue = hueToRgb(p, q, hue - 1 / 3);
        }
        return {
            red: Math.round(red * 255),
            green: Math.round(green * 255),
            blue: Math.round(blue * 255),
            alpha,
        };
    }

    // Linear color space blending
    // Explained https://www.youtube.com/watch?v=LKnqECcg6Gw
    // Demonstrated http://codepen.io/osublake/pen/xGVVaN
    const mixLinearColor = (from, to, v) => {
        const fromExpo = from * from;
        const expo = v * (to * to - fromExpo) + fromExpo;
        return expo < 0 ? 0 : Math.sqrt(expo);
    };
    const colorTypes = [hex, rgba, hsla];
    const getColorType = (v) => colorTypes.find((type) => type.test(v));
    function asRGBA(color) {
        const type = getColorType(color);
        invariant(Boolean(type), `'${color}' is not an animatable color. Use the equivalent color code instead.`);
        let model = type.parse(color);
        if (type === hsla) {
            // TODO Remove this cast - needed since Framer Motion's stricter typing
            model = hslaToRgba(model);
        }
        return model;
    }
    const mixColor = (from, to) => {
        const fromRGBA = asRGBA(from);
        const toRGBA = asRGBA(to);
        const blended = { ...fromRGBA };
        return (v) => {
            blended.red = mixLinearColor(fromRGBA.red, toRGBA.red, v);
            blended.green = mixLinearColor(fromRGBA.green, toRGBA.green, v);
            blended.blue = mixLinearColor(fromRGBA.blue, toRGBA.blue, v);
            blended.alpha = mixNumber$1(fromRGBA.alpha, toRGBA.alpha, v);
            return rgba.transform(blended);
        };
    };

    const invisibleValues = new Set(["none", "hidden"]);
    /**
     * Returns a function that, when provided a progress value between 0 and 1,
     * will return the "none" or "hidden" string only when the progress is that of
     * the origin or target.
     */
    function mixVisibility(origin, target) {
        if (invisibleValues.has(origin)) {
            return (p) => (p <= 0 ? origin : target);
        }
        else {
            return (p) => (p >= 1 ? target : origin);
        }
    }

    function mixImmediate(a, b) {
        return (p) => (p > 0 ? b : a);
    }
    function mixNumber(a, b) {
        return (p) => mixNumber$1(a, b, p);
    }
    function getMixer(a) {
        if (typeof a === "number") {
            return mixNumber;
        }
        else if (typeof a === "string") {
            return isCSSVariableToken(a)
                ? mixImmediate
                : color.test(a)
                    ? mixColor
                    : mixComplex;
        }
        else if (Array.isArray(a)) {
            return mixArray;
        }
        else if (typeof a === "object") {
            return color.test(a) ? mixColor : mixObject;
        }
        return mixImmediate;
    }
    function mixArray(a, b) {
        const output = [...a];
        const numValues = output.length;
        const blendValue = a.map((v, i) => getMixer(v)(v, b[i]));
        return (p) => {
            for (let i = 0; i < numValues; i++) {
                output[i] = blendValue[i](p);
            }
            return output;
        };
    }
    function mixObject(a, b) {
        const output = { ...a, ...b };
        const blendValue = {};
        for (const key in output) {
            if (a[key] !== undefined && b[key] !== undefined) {
                blendValue[key] = getMixer(a[key])(a[key], b[key]);
            }
        }
        return (v) => {
            for (const key in blendValue) {
                output[key] = blendValue[key](v);
            }
            return output;
        };
    }
    function matchOrder(origin, target) {
        var _a;
        const orderedOrigin = [];
        const pointers = { color: 0, var: 0, number: 0 };
        for (let i = 0; i < target.values.length; i++) {
            const type = target.types[i];
            const originIndex = origin.indexes[type][pointers[type]];
            const originValue = (_a = origin.values[originIndex]) !== null && _a !== void 0 ? _a : 0;
            orderedOrigin[i] = originValue;
            pointers[type]++;
        }
        return orderedOrigin;
    }
    const mixComplex = (origin, target) => {
        const template = complex.createTransformer(target);
        const originStats = analyseComplexValue(origin);
        const targetStats = analyseComplexValue(target);
        const canInterpolate = originStats.indexes.var.length === targetStats.indexes.var.length &&
            originStats.indexes.color.length === targetStats.indexes.color.length &&
            originStats.indexes.number.length >= targetStats.indexes.number.length;
        if (canInterpolate) {
            if ((invisibleValues.has(origin) &&
                !targetStats.values.length) ||
                (invisibleValues.has(target) &&
                    !originStats.values.length)) {
                return mixVisibility(origin, target);
            }
            return pipe(mixArray(matchOrder(originStats, targetStats), targetStats.values), template);
        }
        else {
            warning(true, `Complex values '${origin}' and '${target}' too different to mix. Ensure all colors are of the same type, and that each contains the same quantity of number and color values. Falling back to instant transition.`);
            return mixImmediate(origin, target);
        }
    };

    function mix(from, to, p) {
        if (typeof from === "number" &&
            typeof to === "number" &&
            typeof p === "number") {
            return mixNumber$1(from, to, p);
        }
        const mixer = getMixer(from);
        return mixer(from, to);
    }

    function createMixers(output, ease, customMixer) {
        const mixers = [];
        const mixerFactory = customMixer || mix;
        const numMixers = output.length - 1;
        for (let i = 0; i < numMixers; i++) {
            let mixer = mixerFactory(output[i], output[i + 1]);
            if (ease) {
                const easingFunction = Array.isArray(ease) ? ease[i] || noop : ease;
                mixer = pipe(easingFunction, mixer);
            }
            mixers.push(mixer);
        }
        return mixers;
    }
    /**
     * Create a function that maps from a numerical input array to a generic output array.
     *
     * Accepts:
     *   - Numbers
     *   - Colors (hex, hsl, hsla, rgb, rgba)
     *   - Complex (combinations of one or more numbers or strings)
     *
     * ```jsx
     * const mixColor = interpolate([0, 1], ['#fff', '#000'])
     *
     * mixColor(0.5) // 'rgba(128, 128, 128, 1)'
     * ```
     *
     * TODO Revist this approach once we've moved to data models for values,
     * probably not needed to pregenerate mixer functions.
     *
     * @public
     */
    function interpolate(input, output, { clamp: isClamp = true, ease, mixer } = {}) {
        const inputLength = input.length;
        invariant(inputLength === output.length, "Both input and output ranges must be the same length");
        /**
         * If we're only provided a single input, we can just make a function
         * that returns the output.
         */
        if (inputLength === 1)
            return () => output[0];
        if (inputLength === 2 && input[0] === input[1])
            return () => output[1];
        // If input runs highest -> lowest, reverse both arrays
        if (input[0] > input[inputLength - 1]) {
            input = [...input].reverse();
            output = [...output].reverse();
        }
        const mixers = createMixers(output, ease, mixer);
        const numMixers = mixers.length;
        const interpolator = (v) => {
            let i = 0;
            if (numMixers > 1) {
                for (; i < input.length - 2; i++) {
                    if (v < input[i + 1])
                        break;
                }
            }
            const progressInRange = progress(input[i], input[i + 1], v);
            return mixers[i](progressInRange);
        };
        return isClamp
            ? (v) => interpolator(clamp(input[0], input[inputLength - 1], v))
            : interpolator;
    }

    function fillOffset(offset, remaining) {
        const min = offset[offset.length - 1];
        for (let i = 1; i <= remaining; i++) {
            const offsetProgress = progress(0, remaining, i);
            offset.push(mixNumber$1(min, 1, offsetProgress));
        }
    }

    function defaultOffset(arr) {
        const offset = [0];
        fillOffset(offset, arr.length - 1);
        return offset;
    }

    function convertOffsetToTimes(offset, duration) {
        return offset.map((o) => o * duration);
    }

    function defaultEasing(values, easing) {
        return values.map(() => easing || easeInOut).splice(0, values.length - 1);
    }
    function keyframes({ duration = 300, keyframes: keyframeValues, times, ease = "easeInOut", }) {
        /**
         * Easing functions can be externally defined as strings. Here we convert them
         * into actual functions.
         */
        const easingFunctions = isEasingArray(ease)
            ? ease.map(easingDefinitionToFunction)
            : easingDefinitionToFunction(ease);
        /**
         * This is the Iterator-spec return value. We ensure it's mutable rather than using a generator
         * to reduce GC during animation.
         */
        const state = {
            done: false,
            value: keyframeValues[0],
        };
        /**
         * Create a times array based on the provided 0-1 offsets
         */
        const absoluteTimes = convertOffsetToTimes(
        // Only use the provided offsets if they're the correct length
        // TODO Maybe we should warn here if there's a length mismatch
        times && times.length === keyframeValues.length
            ? times
            : defaultOffset(keyframeValues), duration);
        const mapTimeToKeyframe = interpolate(absoluteTimes, keyframeValues, {
            ease: Array.isArray(easingFunctions)
                ? easingFunctions
                : defaultEasing(keyframeValues, easingFunctions),
        });
        return {
            calculatedDuration: duration,
            next: (t) => {
                state.value = mapTimeToKeyframe(t);
                state.done = t >= duration;
                return state;
            },
        };
    }

    /**
     * Implement a practical max duration for keyframe generation
     * to prevent infinite loops
     */
    const maxGeneratorDuration = 20000;
    function calcGeneratorDuration(generator) {
        let duration = 0;
        const timeStep = 50;
        let state = generator.next(duration);
        while (!state.done && duration < maxGeneratorDuration) {
            duration += timeStep;
            state = generator.next(duration);
        }
        return duration >= maxGeneratorDuration ? Infinity : duration;
    }

    const frameloopDriver = (update) => {
        const passTimestamp = ({ timestamp }) => update(timestamp);
        return {
            start: () => frame.update(passTimestamp, true),
            stop: () => cancelFrame(passTimestamp),
            /**
             * If we're processing this frame we can use the
             * framelocked timestamp to keep things in sync.
             */
            now: () => (frameData.isProcessing ? frameData.timestamp : time.now()),
        };
    };

    const generators = {
        decay: inertia,
        inertia,
        tween: keyframes,
        keyframes: keyframes,
        spring,
    };
    const percentToProgress = (percent) => percent / 100;
    /**
     * Animation that runs on the main thread. Designed to be WAAPI-spec in the subset of
     * features we expose publically. Mostly the compatibility is to ensure visual identity
     * between both WAAPI and main thread animations.
     */
    class MainThreadAnimation extends BaseAnimation {
        constructor({ KeyframeResolver: KeyframeResolver$1 = KeyframeResolver, ...options }) {
            super(options);
            /**
             * The time at which the animation was paused.
             */
            this.holdTime = null;
            /**
             * The time at which the animation was started.
             */
            this.startTime = null;
            /**
             * The time at which the animation was cancelled.
             */
            this.cancelTime = null;
            /**
             * The current time of the animation.
             */
            this.currentTime = 0;
            /**
             * Playback speed as a factor. 0 would be stopped, -1 reverse and 2 double speed.
             */
            this.playbackSpeed = 1;
            /**
             * The state of the animation to apply when the animation is resolved. This
             * allows calls to the public API to control the animation before it is resolved,
             * without us having to resolve it first.
             */
            this.pendingPlayState = "running";
            this.state = "idle";
            /**
             * This method is bound to the instance to fix a pattern where
             * animation.stop is returned as a reference from a useEffect.
             */
            this.stop = () => {
                this.resolver.cancel();
                this.isStopped = true;
                if (this.state === "idle")
                    return;
                this.teardown();
                const { onStop } = this.options;
                onStop && onStop();
            };
            const { name, motionValue, keyframes } = this.options;
            const onResolved = (resolvedKeyframes, finalKeyframe) => this.onKeyframesResolved(resolvedKeyframes, finalKeyframe);
            if (name && motionValue && motionValue.owner) {
                this.resolver = motionValue.owner.resolveKeyframes(keyframes, onResolved, name, motionValue);
            }
            else {
                this.resolver = new KeyframeResolver$1(keyframes, onResolved, name, motionValue);
            }
            this.resolver.scheduleResolve();
        }
        initPlayback(keyframes$1) {
            const { type = "keyframes", repeat = 0, repeatDelay = 0, repeatType, velocity = 0, } = this.options;
            const generatorFactory = generators[type] || keyframes;
            /**
             * If our generator doesn't support mixing numbers, we need to replace keyframes with
             * [0, 100] and then make a function that maps that to the actual keyframes.
             *
             * 100 is chosen instead of 1 as it works nicer with spring animations.
             */
            let mapPercentToKeyframes;
            let mirroredGenerator;
            if (generatorFactory !== keyframes &&
                typeof keyframes$1[0] !== "number") {
                {
                    invariant(keyframes$1.length === 2, `Only two keyframes currently supported with spring and inertia animations. Trying to animate ${keyframes$1}`);
                }
                mapPercentToKeyframes = pipe(percentToProgress, mix(keyframes$1[0], keyframes$1[1]));
                keyframes$1 = [0, 100];
            }
            const generator = generatorFactory({ ...this.options, keyframes: keyframes$1 });
            /**
             * If we have a mirror repeat type we need to create a second generator that outputs the
             * mirrored (not reversed) animation and later ping pong between the two generators.
             */
            if (repeatType === "mirror") {
                mirroredGenerator = generatorFactory({
                    ...this.options,
                    keyframes: [...keyframes$1].reverse(),
                    velocity: -velocity,
                });
            }
            /**
             * If duration is undefined and we have repeat options,
             * we need to calculate a duration from the generator.
             *
             * We set it to the generator itself to cache the duration.
             * Any timeline resolver will need to have already precalculated
             * the duration by this step.
             */
            if (generator.calculatedDuration === null) {
                generator.calculatedDuration = calcGeneratorDuration(generator);
            }
            const { calculatedDuration } = generator;
            const resolvedDuration = calculatedDuration + repeatDelay;
            const totalDuration = resolvedDuration * (repeat + 1) - repeatDelay;
            return {
                generator,
                mirroredGenerator,
                mapPercentToKeyframes,
                calculatedDuration,
                resolvedDuration,
                totalDuration,
            };
        }
        onPostResolved() {
            const { autoplay = true } = this.options;
            this.play();
            if (this.pendingPlayState === "paused" || !autoplay) {
                this.pause();
            }
            else {
                this.state = this.pendingPlayState;
            }
        }
        tick(timestamp, sample = false) {
            const { resolved } = this;
            // If the animations has failed to resolve, return the final keyframe.
            if (!resolved) {
                const { keyframes } = this.options;
                return { done: true, value: keyframes[keyframes.length - 1] };
            }
            const { finalKeyframe, generator, mirroredGenerator, mapPercentToKeyframes, keyframes, calculatedDuration, totalDuration, resolvedDuration, } = resolved;
            if (this.startTime === null)
                return generator.next(0);
            const { delay, repeat, repeatType, repeatDelay, onUpdate } = this.options;
            /**
             * requestAnimationFrame timestamps can come through as lower than
             * the startTime as set by performance.now(). Here we prevent this,
             * though in the future it could be possible to make setting startTime
             * a pending operation that gets resolved here.
             */
            if (this.speed > 0) {
                this.startTime = Math.min(this.startTime, timestamp);
            }
            else if (this.speed < 0) {
                this.startTime = Math.min(timestamp - totalDuration / this.speed, this.startTime);
            }
            // Update currentTime
            if (sample) {
                this.currentTime = timestamp;
            }
            else if (this.holdTime !== null) {
                this.currentTime = this.holdTime;
            }
            else {
                // Rounding the time because floating point arithmetic is not always accurate, e.g. 3000.367 - 1000.367 =
                // 2000.0000000000002. This is a problem when we are comparing the currentTime with the duration, for
                // example.
                this.currentTime =
                    Math.round(timestamp - this.startTime) * this.speed;
            }
            // Rebase on delay
            const timeWithoutDelay = this.currentTime - delay * (this.speed >= 0 ? 1 : -1);
            const isInDelayPhase = this.speed >= 0
                ? timeWithoutDelay < 0
                : timeWithoutDelay > totalDuration;
            this.currentTime = Math.max(timeWithoutDelay, 0);
            // If this animation has finished, set the current time  to the total duration.
            if (this.state === "finished" && this.holdTime === null) {
                this.currentTime = totalDuration;
            }
            let elapsed = this.currentTime;
            let frameGenerator = generator;
            if (repeat) {
                /**
                 * Get the current progress (0-1) of the animation. If t is >
                 * than duration we'll get values like 2.5 (midway through the
                 * third iteration)
                 */
                const progress = Math.min(this.currentTime, totalDuration) / resolvedDuration;
                /**
                 * Get the current iteration (0 indexed). For instance the floor of
                 * 2.5 is 2.
                 */
                let currentIteration = Math.floor(progress);
                /**
                 * Get the current progress of the iteration by taking the remainder
                 * so 2.5 is 0.5 through iteration 2
                 */
                let iterationProgress = progress % 1.0;
                /**
                 * If iteration progress is 1 we count that as the end
                 * of the previous iteration.
                 */
                if (!iterationProgress && progress >= 1) {
                    iterationProgress = 1;
                }
                iterationProgress === 1 && currentIteration--;
                currentIteration = Math.min(currentIteration, repeat + 1);
                /**
                 * Reverse progress if we're not running in "normal" direction
                 */
                const isOddIteration = Boolean(currentIteration % 2);
                if (isOddIteration) {
                    if (repeatType === "reverse") {
                        iterationProgress = 1 - iterationProgress;
                        if (repeatDelay) {
                            iterationProgress -= repeatDelay / resolvedDuration;
                        }
                    }
                    else if (repeatType === "mirror") {
                        frameGenerator = mirroredGenerator;
                    }
                }
                elapsed = clamp(0, 1, iterationProgress) * resolvedDuration;
            }
            /**
             * If we're in negative time, set state as the initial keyframe.
             * This prevents delay: x, duration: 0 animations from finishing
             * instantly.
             */
            const state = isInDelayPhase
                ? { done: false, value: keyframes[0] }
                : frameGenerator.next(elapsed);
            if (mapPercentToKeyframes) {
                state.value = mapPercentToKeyframes(state.value);
            }
            let { done } = state;
            if (!isInDelayPhase && calculatedDuration !== null) {
                done =
                    this.speed >= 0
                        ? this.currentTime >= totalDuration
                        : this.currentTime <= 0;
            }
            const isAnimationFinished = this.holdTime === null &&
                (this.state === "finished" || (this.state === "running" && done));
            if (isAnimationFinished && finalKeyframe !== undefined) {
                state.value = getFinalKeyframe(keyframes, this.options, finalKeyframe);
            }
            if (onUpdate) {
                onUpdate(state.value);
            }
            if (isAnimationFinished) {
                this.finish();
            }
            return state;
        }
        get duration() {
            const { resolved } = this;
            return resolved ? millisecondsToSeconds(resolved.calculatedDuration) : 0;
        }
        get time() {
            return millisecondsToSeconds(this.currentTime);
        }
        set time(newTime) {
            newTime = secondsToMilliseconds(newTime);
            this.currentTime = newTime;
            if (this.holdTime !== null || this.speed === 0) {
                this.holdTime = newTime;
            }
            else if (this.driver) {
                this.startTime = this.driver.now() - newTime / this.speed;
            }
        }
        get speed() {
            return this.playbackSpeed;
        }
        set speed(newSpeed) {
            const hasChanged = this.playbackSpeed !== newSpeed;
            this.playbackSpeed = newSpeed;
            if (hasChanged) {
                this.time = millisecondsToSeconds(this.currentTime);
            }
        }
        play() {
            if (!this.resolver.isScheduled) {
                this.resolver.resume();
            }
            if (!this._resolved) {
                this.pendingPlayState = "running";
                return;
            }
            if (this.isStopped)
                return;
            const { driver = frameloopDriver, onPlay } = this.options;
            if (!this.driver) {
                this.driver = driver((timestamp) => this.tick(timestamp));
            }
            onPlay && onPlay();
            const now = this.driver.now();
            if (this.holdTime !== null) {
                this.startTime = now - this.holdTime;
            }
            else if (!this.startTime || this.state === "finished") {
                this.startTime = now;
            }
            if (this.state === "finished") {
                this.updateFinishedPromise();
            }
            this.cancelTime = this.startTime;
            this.holdTime = null;
            /**
             * Set playState to running only after we've used it in
             * the previous logic.
             */
            this.state = "running";
            this.driver.start();
        }
        pause() {
            var _a;
            if (!this._resolved) {
                this.pendingPlayState = "paused";
                return;
            }
            this.state = "paused";
            this.holdTime = (_a = this.currentTime) !== null && _a !== void 0 ? _a : 0;
        }
        complete() {
            if (this.state !== "running") {
                this.play();
            }
            this.pendingPlayState = this.state = "finished";
            this.holdTime = null;
        }
        finish() {
            this.teardown();
            this.state = "finished";
            const { onComplete } = this.options;
            onComplete && onComplete();
        }
        cancel() {
            if (this.cancelTime !== null) {
                this.tick(this.cancelTime);
            }
            this.teardown();
            this.updateFinishedPromise();
        }
        teardown() {
            this.state = "idle";
            this.stopDriver();
            this.resolveFinishedPromise();
            this.updateFinishedPromise();
            this.startTime = this.cancelTime = null;
            this.resolver.cancel();
        }
        stopDriver() {
            if (!this.driver)
                return;
            this.driver.stop();
            this.driver = undefined;
        }
        sample(time) {
            this.startTime = 0;
            return this.tick(time, true);
        }
    }
    // Legacy interface
    function animateValue(options) {
        return new MainThreadAnimation(options);
    }

    const isBezierDefinition = (easing) => Array.isArray(easing) && typeof easing[0] === "number";

    function isWaapiSupportedEasing(easing) {
        return Boolean(!easing ||
            (typeof easing === "string" && easing in supportedWaapiEasing) ||
            isBezierDefinition(easing) ||
            (Array.isArray(easing) && easing.every(isWaapiSupportedEasing)));
    }
    const cubicBezierAsString = ([a, b, c, d]) => `cubic-bezier(${a}, ${b}, ${c}, ${d})`;
    const supportedWaapiEasing = {
        linear: "linear",
        ease: "ease",
        easeIn: "ease-in",
        easeOut: "ease-out",
        easeInOut: "ease-in-out",
        circIn: cubicBezierAsString([0, 0.65, 0.55, 1]),
        circOut: cubicBezierAsString([0.55, 0, 1, 0.45]),
        backIn: cubicBezierAsString([0.31, 0.01, 0.66, -0.59]),
        backOut: cubicBezierAsString([0.33, 1.53, 0.69, 0.99]),
    };
    function mapEasingToNativeEasingWithDefault(easing) {
        return (mapEasingToNativeEasing(easing) ||
            supportedWaapiEasing.easeOut);
    }
    function mapEasingToNativeEasing(easing) {
        if (!easing) {
            return undefined;
        }
        else if (isBezierDefinition(easing)) {
            return cubicBezierAsString(easing);
        }
        else if (Array.isArray(easing)) {
            return easing.map(mapEasingToNativeEasingWithDefault);
        }
        else {
            return supportedWaapiEasing[easing];
        }
    }

    function animateStyle(element, valueName, keyframes, { delay = 0, duration = 300, repeat = 0, repeatType = "loop", ease, times, } = {}) {
        const keyframeOptions = { [valueName]: keyframes };
        if (times)
            keyframeOptions.offset = times;
        const easing = mapEasingToNativeEasing(ease);
        /**
         * If this is an easing array, apply to keyframes, not animation as a whole
         */
        if (Array.isArray(easing))
            keyframeOptions.easing = easing;
        return element.animate(keyframeOptions, {
            delay,
            duration,
            easing: !Array.isArray(easing) ? easing : "linear",
            fill: "both",
            iterations: repeat + 1,
            direction: repeatType === "reverse" ? "alternate" : "normal",
        });
    }

    const supportsWaapi = memo(() => Object.hasOwnProperty.call(Element.prototype, "animate"));
    /**
     * A list of values that can be hardware-accelerated.
     */
    const acceleratedValues = new Set([
        "opacity",
        "clipPath",
        "filter",
        "transform",
        // TODO: Can be accelerated but currently disabled until https://issues.chromium.org/issues/41491098 is resolved
        // or until we implement support for linear() easing.
        // "background-color"
    ]);
    /**
     * 10ms is chosen here as it strikes a balance between smooth
     * results (more than one keyframe per frame at 60fps) and
     * keyframe quantity.
     */
    const sampleDelta = 10; //ms
    /**
     * Implement a practical max duration for keyframe generation
     * to prevent infinite loops
     */
    const maxDuration = 20000;
    /**
     * Check if an animation can run natively via WAAPI or requires pregenerated keyframes.
     * WAAPI doesn't support spring or function easings so we run these as JS animation before
     * handing off.
     */
    function requiresPregeneratedKeyframes(options) {
        return (options.type === "spring" ||
            options.name === "backgroundColor" ||
            !isWaapiSupportedEasing(options.ease));
    }
    function pregenerateKeyframes(keyframes, options) {
        /**
         * Create a main-thread animation to pregenerate keyframes.
         * We sample this at regular intervals to generate keyframes that we then
         * linearly interpolate between.
         */
        const sampleAnimation = new MainThreadAnimation({
            ...options,
            keyframes,
            repeat: 0,
            delay: 0,
            isGenerator: true,
        });
        let state = { done: false, value: keyframes[0] };
        const pregeneratedKeyframes = [];
        /**
         * Bail after 20 seconds of pre-generated keyframes as it's likely
         * we're heading for an infinite loop.
         */
        let t = 0;
        while (!state.done && t < maxDuration) {
            state = sampleAnimation.sample(t);
            pregeneratedKeyframes.push(state.value);
            t += sampleDelta;
        }
        return {
            times: undefined,
            keyframes: pregeneratedKeyframes,
            duration: t - sampleDelta,
            ease: "linear",
        };
    }
    class AcceleratedAnimation extends BaseAnimation {
        constructor(options) {
            super(options);
            const { name, motionValue, keyframes } = this.options;
            this.resolver = new DOMKeyframesResolver(keyframes, (resolvedKeyframes, finalKeyframe) => this.onKeyframesResolved(resolvedKeyframes, finalKeyframe), name, motionValue);
            this.resolver.scheduleResolve();
        }
        initPlayback(keyframes, finalKeyframe) {
            var _a;
            let { duration = 300, times, ease, type, motionValue, name, } = this.options;
            /**
             * If element has since been unmounted, return false to indicate
             * the animation failed to initialised.
             */
            if (!((_a = motionValue.owner) === null || _a === void 0 ? void 0 : _a.current)) {
                return false;
            }
            /**
             * If this animation needs pre-generated keyframes then generate.
             */
            if (requiresPregeneratedKeyframes(this.options)) {
                const { onComplete, onUpdate, motionValue, ...options } = this.options;
                const pregeneratedAnimation = pregenerateKeyframes(keyframes, options);
                keyframes = pregeneratedAnimation.keyframes;
                // If this is a very short animation, ensure we have
                // at least two keyframes to animate between as older browsers
                // can't animate between a single keyframe.
                if (keyframes.length === 1) {
                    keyframes[1] = keyframes[0];
                }
                duration = pregeneratedAnimation.duration;
                times = pregeneratedAnimation.times;
                ease = pregeneratedAnimation.ease;
                type = "keyframes";
            }
            const animation = animateStyle(motionValue.owner.current, name, keyframes, { ...this.options, duration, times, ease });
            // Override the browser calculated startTime with one synchronised to other JS
            // and WAAPI animations starting this event loop.
            animation.startTime = time.now();
            if (this.pendingTimeline) {
                animation.timeline = this.pendingTimeline;
                this.pendingTimeline = undefined;
            }
            else {
                /**
                 * Prefer the `onfinish` prop as it's more widely supported than
                 * the `finished` promise.
                 *
                 * Here, we synchronously set the provided MotionValue to the end
                 * keyframe. If we didn't, when the WAAPI animation is finished it would
                 * be removed from the element which would then revert to its old styles.
                 */
                animation.onfinish = () => {
                    const { onComplete } = this.options;
                    motionValue.set(getFinalKeyframe(keyframes, this.options, finalKeyframe));
                    onComplete && onComplete();
                    this.cancel();
                    this.resolveFinishedPromise();
                };
            }
            return {
                animation,
                duration,
                times,
                type,
                ease,
                keyframes: keyframes,
            };
        }
        get duration() {
            const { resolved } = this;
            if (!resolved)
                return 0;
            const { duration } = resolved;
            return millisecondsToSeconds(duration);
        }
        get time() {
            const { resolved } = this;
            if (!resolved)
                return 0;
            const { animation } = resolved;
            return millisecondsToSeconds(animation.currentTime || 0);
        }
        set time(newTime) {
            const { resolved } = this;
            if (!resolved)
                return;
            const { animation } = resolved;
            animation.currentTime = secondsToMilliseconds(newTime);
        }
        get speed() {
            const { resolved } = this;
            if (!resolved)
                return 1;
            const { animation } = resolved;
            return animation.playbackRate;
        }
        set speed(newSpeed) {
            const { resolved } = this;
            if (!resolved)
                return;
            const { animation } = resolved;
            animation.playbackRate = newSpeed;
        }
        get state() {
            const { resolved } = this;
            if (!resolved)
                return "idle";
            const { animation } = resolved;
            return animation.playState;
        }
        /**
         * Replace the default DocumentTimeline with another AnimationTimeline.
         * Currently used for scroll animations.
         */
        attachTimeline(timeline) {
            if (!this._resolved) {
                this.pendingTimeline = timeline;
            }
            else {
                const { resolved } = this;
                if (!resolved)
                    return noop;
                const { animation } = resolved;
                animation.timeline = timeline;
                animation.onfinish = null;
            }
            return noop;
        }
        play() {
            if (this.isStopped)
                return;
            const { resolved } = this;
            if (!resolved)
                return;
            const { animation } = resolved;
            if (animation.playState === "finished") {
                this.updateFinishedPromise();
            }
            animation.play();
        }
        pause() {
            const { resolved } = this;
            if (!resolved)
                return;
            const { animation } = resolved;
            animation.pause();
        }
        stop() {
            this.resolver.cancel();
            this.isStopped = true;
            if (this.state === "idle")
                return;
            const { resolved } = this;
            if (!resolved)
                return;
            const { animation, keyframes, duration, type, ease, times } = resolved;
            if (animation.playState === "idle" ||
                animation.playState === "finished") {
                return;
            }
            /**
             * WAAPI doesn't natively have any interruption capabilities.
             *
             * Rather than read commited styles back out of the DOM, we can
             * create a renderless JS animation and sample it twice to calculate
             * its current value, "previous" value, and therefore allow
             * Motion to calculate velocity for any subsequent animation.
             */
            if (this.time) {
                const { motionValue, onUpdate, onComplete, ...options } = this.options;
                const sampleAnimation = new MainThreadAnimation({
                    ...options,
                    keyframes,
                    duration,
                    type,
                    ease,
                    times,
                    isGenerator: true,
                });
                const sampleTime = secondsToMilliseconds(this.time);
                motionValue.setWithVelocity(sampleAnimation.sample(sampleTime - sampleDelta).value, sampleAnimation.sample(sampleTime).value, sampleDelta);
            }
            this.cancel();
        }
        complete() {
            const { resolved } = this;
            if (!resolved)
                return;
            resolved.animation.finish();
        }
        cancel() {
            const { resolved } = this;
            if (!resolved)
                return;
            resolved.animation.cancel();
        }
        static supports(options) {
            const { motionValue, name, repeatDelay, repeatType, damping, type } = options;
            return (supportsWaapi() &&
                name &&
                acceleratedValues.has(name) &&
                motionValue &&
                motionValue.owner &&
                motionValue.owner.current instanceof HTMLElement &&
                /**
                 * If we're outputting values to onUpdate then we can't use WAAPI as there's
                 * no way to read the value from WAAPI every frame.
                 */
                !motionValue.owner.getProps().onUpdate &&
                !repeatDelay &&
                repeatType !== "mirror" &&
                damping !== 0 &&
                type !== "inertia");
        }
    }

    const animateMotionValue = (name, value, target, transition = {}, element, isHandoff) => (onComplete) => {
        const valueTransition = getValueTransition(transition, name) || {};
        /**
         * Most transition values are currently completely overwritten by value-specific
         * transitions. In the future it'd be nicer to blend these transitions. But for now
         * delay actually does inherit from the root transition if not value-specific.
         */
        const delay = valueTransition.delay || transition.delay || 0;
        /**
         * Elapsed isn't a public transition option but can be passed through from
         * optimized appear effects in milliseconds.
         */
        let { elapsed = 0 } = transition;
        elapsed = elapsed - secondsToMilliseconds(delay);
        let options = {
            keyframes: Array.isArray(target) ? target : [null, target],
            ease: "easeOut",
            velocity: value.getVelocity(),
            ...valueTransition,
            delay: -elapsed,
            onUpdate: (v) => {
                value.set(v);
                valueTransition.onUpdate && valueTransition.onUpdate(v);
            },
            onComplete: () => {
                onComplete();
                valueTransition.onComplete && valueTransition.onComplete();
            },
            name,
            motionValue: value,
            element: isHandoff ? undefined : element,
        };
        /**
         * If there's no transition defined for this value, we can generate
         * unqiue transition settings for this value.
         */
        if (!isTransitionDefined(valueTransition)) {
            options = {
                ...options,
                ...getDefaultTransition(name, options),
            };
        }
        /**
         * Both WAAPI and our internal animation functions use durations
         * as defined by milliseconds, while our external API defines them
         * as seconds.
         */
        if (options.duration) {
            options.duration = secondsToMilliseconds(options.duration);
        }
        if (options.repeatDelay) {
            options.repeatDelay = secondsToMilliseconds(options.repeatDelay);
        }
        if (options.from !== undefined) {
            options.keyframes[0] = options.from;
        }
        let shouldSkip = false;
        if (options.type === false ||
            (options.duration === 0 && !options.repeatDelay)) {
            options.duration = 0;
            if (options.delay === 0) {
                shouldSkip = true;
            }
        }
        /**
         * If we can or must skip creating the animation, and apply only
         * the final keyframe, do so. We also check once keyframes are resolved but
         * this early check prevents the need to create an animation at all.
         */
        if (shouldSkip && !isHandoff && value.get() !== undefined) {
            const finalKeyframe = getFinalKeyframe(options.keyframes, valueTransition);
            if (finalKeyframe !== undefined) {
                frame.update(() => {
                    options.onUpdate(finalKeyframe);
                    options.onComplete();
                });
                return;
            }
        }
        /**
         * Animate via WAAPI if possible. If this is a handoff animation, the optimised animation will be running via
         * WAAPI. Therefore, this animation must be JS to ensure it runs "under" the
         * optimised animation.
         */
        if (!isHandoff && AcceleratedAnimation.supports(options)) {
            return new AcceleratedAnimation(options);
        }
        else {
            return new MainThreadAnimation(options);
        }
    };

    function isWillChangeMotionValue(value) {
        return Boolean(isMotionValue(value) && value.add);
    }

    function getValueState(visualElement) {
        const state = [{}, {}];
        visualElement === null || visualElement === void 0 ? void 0 : visualElement.values.forEach((value, key) => {
            state[0][key] = value.get();
            state[1][key] = value.getVelocity();
        });
        return state;
    }
    function resolveVariantFromProps(props, definition, custom, visualElement) {
        /**
         * If the variant definition is a function, resolve.
         */
        if (typeof definition === "function") {
            const [current, velocity] = getValueState(visualElement);
            definition = definition(custom !== undefined ? custom : props.custom, current, velocity);
        }
        /**
         * If the variant definition is a variant label, or
         * the function returned a variant label, resolve.
         */
        if (typeof definition === "string") {
            definition = props.variants && props.variants[definition];
        }
        /**
         * At this point we've resolved both functions and variant labels,
         * but the resolved variant label might itself have been a function.
         * If so, resolve. This can only have returned a valid target object.
         */
        if (typeof definition === "function") {
            const [current, velocity] = getValueState(visualElement);
            definition = definition(custom !== undefined ? custom : props.custom, current, velocity);
        }
        return definition;
    }

    function isSVGElement(element) {
        return element instanceof SVGElement && element.tagName !== "svg";
    }

    function isForcedMotionValue(key, { layout, layoutId }) {
        return (transformProps.has(key) ||
            key.startsWith("origin") ||
            ((layout || layoutId !== undefined) &&
                (!!scaleCorrectors[key] || key === "opacity")));
    }

    function scrapeMotionValuesFromProps(props, prevProps, visualElement) {
        var _a;
        const { style } = props;
        const newValues = {};
        for (const key in style) {
            if (isMotionValue(style[key]) ||
                (prevProps.style &&
                    isMotionValue(prevProps.style[key])) ||
                isForcedMotionValue(key, props) ||
                ((_a = visualElement === null || visualElement === void 0 ? void 0 : visualElement.getValue(key)) === null || _a === void 0 ? void 0 : _a.liveStyle) !== undefined) {
                newValues[key] = style[key];
            }
        }
        return newValues;
    }

    function isRefObject(ref) {
        return (ref &&
            typeof ref === "object" &&
            Object.prototype.hasOwnProperty.call(ref, "current"));
    }

    const isBrowser = typeof document !== "undefined";

    // Does this device prefer reduced motion? Returns `null` server-side.
    const prefersReducedMotion = { current: null };
    const hasReducedMotionListener = { current: false };

    function initPrefersReducedMotion() {
        hasReducedMotionListener.current = true;
        if (!isBrowser)
            return;
        if (window.matchMedia) {
            const motionMediaQuery = window.matchMedia("(prefers-reduced-motion)");
            const setReducedMotionPreferences = () => (prefersReducedMotion.current = motionMediaQuery.matches);
            motionMediaQuery.addListener(setReducedMotionPreferences);
            setReducedMotionPreferences();
        }
        else {
            prefersReducedMotion.current = false;
        }
    }

    function isAnimationControls(v) {
        return (v !== null &&
            typeof v === "object" &&
            typeof v.start === "function");
    }

    /**
     * Decides if the supplied variable is variant label
     */
    function isVariantLabel(v) {
        return typeof v === "string" || Array.isArray(v);
    }

    const variantPriorityOrder = [
        "animate",
        "whileInView",
        "whileFocus",
        "whileHover",
        "whileTap",
        "whileDrag",
        "exit",
    ];
    const variantProps = ["initial", ...variantPriorityOrder];

    function isControllingVariants(props) {
        return (isAnimationControls(props.animate) ||
            variantProps.some((name) => isVariantLabel(props[name])));
    }
    function isVariantNode(props) {
        return Boolean(isControllingVariants(props) || props.variants);
    }

    function updateMotionValuesFromProps(element, next, prev) {
        const { willChange } = next;
        for (const key in next) {
            const nextValue = next[key];
            const prevValue = prev[key];
            if (isMotionValue(nextValue)) {
                /**
                 * If this is a motion value found in props or style, we want to add it
                 * to our visual element's motion value map.
                 */
                element.addValue(key, nextValue);
                if (isWillChangeMotionValue(willChange)) {
                    willChange.add(key);
                }
                /**
                 * Check the version of the incoming motion value with this version
                 * and warn against mismatches.
                 */
                {
                    warnOnce(nextValue.version === "11.2.4", `Attempting to mix Framer Motion versions ${nextValue.version} with 11.2.4 may not work as expected.`);
                }
            }
            else if (isMotionValue(prevValue)) {
                /**
                 * If we're swapping from a motion value to a static value,
                 * create a new motion value from that
                 */
                element.addValue(key, motionValue(nextValue, { owner: element }));
                if (isWillChangeMotionValue(willChange)) {
                    willChange.remove(key);
                }
            }
            else if (prevValue !== nextValue) {
                /**
                 * If this is a flat value that has changed, update the motion value
                 * or create one if it doesn't exist. We only want to do this if we're
                 * not handling the value with our animation state.
                 */
                if (element.hasValue(key)) {
                    const existingValue = element.getValue(key);
                    if (existingValue.liveStyle === true) {
                        existingValue.jump(nextValue);
                    }
                    else if (!existingValue.hasAnimated) {
                        existingValue.set(nextValue);
                    }
                }
                else {
                    const latestValue = element.getStaticValue(key);
                    element.addValue(key, motionValue(latestValue !== undefined ? latestValue : nextValue, { owner: element }));
                }
            }
        }
        // Handle removed values
        for (const key in prev) {
            if (next[key] === undefined)
                element.removeValue(key);
        }
        return next;
    }

    const featureProps = {
        animation: [
            "animate",
            "variants",
            "whileHover",
            "whileTap",
            "exit",
            "whileInView",
            "whileFocus",
            "whileDrag",
        ],
        exit: ["exit"],
        drag: ["drag", "dragControls"],
        focus: ["whileFocus"],
        hover: ["whileHover", "onHoverStart", "onHoverEnd"],
        tap: ["whileTap", "onTap", "onTapStart", "onTapCancel"],
        pan: ["onPan", "onPanStart", "onPanSessionStart", "onPanEnd"],
        inView: ["whileInView", "onViewportEnter", "onViewportLeave"],
        layout: ["layout", "layoutId"],
    };
    const featureDefinitions = {};
    for (const key in featureProps) {
        featureDefinitions[key] = {
            isEnabled: (props) => featureProps[key].some((name) => !!props[name]),
        };
    }

    /**
     * A list of all ValueTypes
     */
    const valueTypes = [...dimensionValueTypes, color, complex];
    /**
     * Tests a value against the list of ValueTypes
     */
    const findValueType = (v) => valueTypes.find(testValueType(v));

    const featureNames = Object.keys(featureDefinitions);
    const numFeatures = featureNames.length;
    const propEventHandlers = [
        "AnimationStart",
        "AnimationComplete",
        "Update",
        "BeforeLayoutMeasure",
        "LayoutMeasure",
        "LayoutAnimationStart",
        "LayoutAnimationComplete",
    ];
    const numVariantProps = variantProps.length;
    function getClosestProjectingNode(visualElement) {
        if (!visualElement)
            return undefined;
        return visualElement.options.allowProjection !== false
            ? visualElement.projection
            : getClosestProjectingNode(visualElement.parent);
    }
    /**
     * A VisualElement is an imperative abstraction around UI elements such as
     * HTMLElement, SVGElement, Three.Object3D etc.
     */
    class VisualElement {
        /**
         * This method takes React props and returns found MotionValues. For example, HTML
         * MotionValues will be found within the style prop, whereas for Three.js within attribute arrays.
         *
         * This isn't an abstract method as it needs calling in the constructor, but it is
         * intended to be one.
         */
        scrapeMotionValuesFromProps(_props, _prevProps, _visualElement) {
            return {};
        }
        constructor({ parent, props, presenceContext, reducedMotionConfig, blockInitialAnimation, visualState, }, options = {}) {
            this.resolveKeyframes = (keyframes, 
            // We use an onComplete callback here rather than a Promise as a Promise
            // resolution is a microtask and we want to retain the ability to force
            // the resolution of keyframes synchronously.
            onComplete, name, value) => {
                return new this.KeyframeResolver(keyframes, onComplete, name, value, this);
            };
            /**
             * A reference to the current underlying Instance, e.g. a HTMLElement
             * or Three.Mesh etc.
             */
            this.current = null;
            /**
             * A set containing references to this VisualElement's children.
             */
            this.children = new Set();
            /**
             * Determine what role this visual element should take in the variant tree.
             */
            this.isVariantNode = false;
            this.isControllingVariants = false;
            /**
             * Decides whether this VisualElement should animate in reduced motion
             * mode.
             *
             * TODO: This is currently set on every individual VisualElement but feels
             * like it could be set globally.
             */
            this.shouldReduceMotion = null;
            /**
             * A map of all motion values attached to this visual element. Motion
             * values are source of truth for any given animated value. A motion
             * value might be provided externally by the component via props.
             */
            this.values = new Map();
            this.KeyframeResolver = KeyframeResolver;
            /**
             * Cleanup functions for active features (hover/tap/exit etc)
             */
            this.features = {};
            /**
             * A map of every subscription that binds the provided or generated
             * motion values onChange listeners to this visual element.
             */
            this.valueSubscriptions = new Map();
            /**
             * A reference to the previously-provided motion values as returned
             * from scrapeMotionValuesFromProps. We use the keys in here to determine
             * if any motion values need to be removed after props are updated.
             */
            this.prevMotionValues = {};
            /**
             * An object containing a SubscriptionManager for each active event.
             */
            this.events = {};
            /**
             * An object containing an unsubscribe function for each prop event subscription.
             * For example, every "Update" event can have multiple subscribers via
             * VisualElement.on(), but only one of those can be defined via the onUpdate prop.
             */
            this.propEventSubscriptions = {};
            this.notifyUpdate = () => this.notify("Update", this.latestValues);
            this.render = () => {
                if (!this.current)
                    return;
                this.triggerBuild();
                this.renderInstance(this.current, this.renderState, this.props.style, this.projection);
            };
            this.scheduleRender = () => frame.render(this.render, false, true);
            const { latestValues, renderState } = visualState;
            this.latestValues = latestValues;
            this.baseTarget = { ...latestValues };
            this.initialValues = props.initial ? { ...latestValues } : {};
            this.renderState = renderState;
            this.parent = parent;
            this.props = props;
            this.presenceContext = presenceContext;
            this.depth = parent ? parent.depth + 1 : 0;
            this.reducedMotionConfig = reducedMotionConfig;
            this.options = options;
            this.blockInitialAnimation = Boolean(blockInitialAnimation);
            this.isControllingVariants = isControllingVariants(props);
            this.isVariantNode = isVariantNode(props);
            if (this.isVariantNode) {
                this.variantChildren = new Set();
            }
            this.manuallyAnimateOnMount = Boolean(parent && parent.current);
            /**
             * Any motion values that are provided to the element when created
             * aren't yet bound to the element, as this would technically be impure.
             * However, we iterate through the motion values and set them to the
             * initial values for this component.
             *
             * TODO: This is impure and we should look at changing this to run on mount.
             * Doing so will break some tests but this isn't neccessarily a breaking change,
             * more a reflection of the test.
             */
            const { willChange, ...initialMotionValues } = this.scrapeMotionValuesFromProps(props, {}, this);
            for (const key in initialMotionValues) {
                const value = initialMotionValues[key];
                if (latestValues[key] !== undefined && isMotionValue(value)) {
                    value.set(latestValues[key], false);
                    if (isWillChangeMotionValue(willChange)) {
                        willChange.add(key);
                    }
                }
            }
        }
        mount(instance) {
            this.current = instance;
            visualElementStore.set(instance, this);
            if (this.projection && !this.projection.instance) {
                this.projection.mount(instance);
            }
            if (this.parent && this.isVariantNode && !this.isControllingVariants) {
                this.removeFromVariantTree = this.parent.addVariantChild(this);
            }
            this.values.forEach((value, key) => this.bindToMotionValue(key, value));
            if (!hasReducedMotionListener.current) {
                initPrefersReducedMotion();
            }
            this.shouldReduceMotion =
                this.reducedMotionConfig === "never"
                    ? false
                    : this.reducedMotionConfig === "always"
                        ? true
                        : prefersReducedMotion.current;
            {
                warnOnce(this.shouldReduceMotion !== true, "You have Reduced Motion enabled on your device. Animations may not appear as expected.");
            }
            if (this.parent)
                this.parent.children.add(this);
            this.update(this.props, this.presenceContext);
        }
        unmount() {
            var _a;
            visualElementStore.delete(this.current);
            this.projection && this.projection.unmount();
            cancelFrame(this.notifyUpdate);
            cancelFrame(this.render);
            this.valueSubscriptions.forEach((remove) => remove());
            this.removeFromVariantTree && this.removeFromVariantTree();
            this.parent && this.parent.children.delete(this);
            for (const key in this.events) {
                this.events[key].clear();
            }
            for (const key in this.features) {
                (_a = this.features[key]) === null || _a === void 0 ? void 0 : _a.unmount();
            }
            this.current = null;
        }
        bindToMotionValue(key, value) {
            const valueIsTransform = transformProps.has(key);
            const removeOnChange = value.on("change", (latestValue) => {
                this.latestValues[key] = latestValue;
                this.props.onUpdate && frame.preRender(this.notifyUpdate);
                if (valueIsTransform && this.projection) {
                    this.projection.isTransformDirty = true;
                }
            });
            const removeOnRenderRequest = value.on("renderRequest", this.scheduleRender);
            this.valueSubscriptions.set(key, () => {
                removeOnChange();
                removeOnRenderRequest();
                if (value.owner)
                    value.stop();
            });
        }
        sortNodePosition(other) {
            /**
             * If these nodes aren't even of the same type we can't compare their depth.
             */
            if (!this.current ||
                !this.sortInstanceNodePosition ||
                this.type !== other.type) {
                return 0;
            }
            return this.sortInstanceNodePosition(this.current, other.current);
        }
        loadFeatures({ children, ...renderedProps }, isStrict, preloadedFeatures, initialLayoutGroupConfig) {
            let ProjectionNodeConstructor;
            let MeasureLayout;
            /**
             * If we're in development mode, check to make sure we're not rendering a motion component
             * as a child of LazyMotion, as this will break the file-size benefits of using it.
             */
            if (preloadedFeatures &&
                isStrict) {
                const strictMessage = "You have rendered a `motion` component within a `LazyMotion` component. This will break tree shaking. Import and render a `m` component instead.";
                renderedProps.ignoreStrict
                    ? warning(false, strictMessage)
                    : invariant(false, strictMessage);
            }
            for (let i = 0; i < numFeatures; i++) {
                const name = featureNames[i];
                const { isEnabled, Feature: FeatureConstructor, ProjectionNode, MeasureLayout: MeasureLayoutComponent, } = featureDefinitions[name];
                if (ProjectionNode)
                    ProjectionNodeConstructor = ProjectionNode;
                if (isEnabled(renderedProps)) {
                    if (!this.features[name] && FeatureConstructor) {
                        this.features[name] = new FeatureConstructor(this);
                    }
                    if (MeasureLayoutComponent) {
                        MeasureLayout = MeasureLayoutComponent;
                    }
                }
            }
            if ((this.type === "html" || this.type === "svg") &&
                !this.projection &&
                ProjectionNodeConstructor) {
                this.projection = new ProjectionNodeConstructor(this.latestValues, getClosestProjectingNode(this.parent));
                const { layoutId, layout, drag, dragConstraints, layoutScroll, layoutRoot, } = renderedProps;
                this.projection.setOptions({
                    layoutId,
                    layout,
                    alwaysMeasureLayout: Boolean(drag) ||
                        (dragConstraints && isRefObject(dragConstraints)),
                    visualElement: this,
                    scheduleRender: () => this.scheduleRender(),
                    /**
                     * TODO: Update options in an effect. This could be tricky as it'll be too late
                     * to update by the time layout animations run.
                     * We also need to fix this safeToRemove by linking it up to the one returned by usePresence,
                     * ensuring it gets called if there's no potential layout animations.
                     *
                     */
                    animationType: typeof layout === "string" ? layout : "both",
                    initialPromotionConfig: initialLayoutGroupConfig,
                    layoutScroll,
                    layoutRoot,
                });
            }
            return MeasureLayout;
        }
        updateFeatures() {
            for (const key in this.features) {
                const feature = this.features[key];
                if (feature.isMounted) {
                    feature.update();
                }
                else {
                    feature.mount();
                    feature.isMounted = true;
                }
            }
        }
        triggerBuild() {
            this.build(this.renderState, this.latestValues, this.options, this.props);
        }
        /**
         * Measure the current viewport box with or without transforms.
         * Only measures axis-aligned boxes, rotate and skew must be manually
         * removed with a re-render to work.
         */
        measureViewportBox() {
            return this.current
                ? this.measureInstanceViewportBox(this.current, this.props)
                : createBox();
        }
        getStaticValue(key) {
            return this.latestValues[key];
        }
        setStaticValue(key, value) {
            this.latestValues[key] = value;
        }
        /**
         * Update the provided props. Ensure any newly-added motion values are
         * added to our map, old ones removed, and listeners updated.
         */
        update(props, presenceContext) {
            if (props.transformTemplate || this.props.transformTemplate) {
                this.scheduleRender();
            }
            this.prevProps = this.props;
            this.props = props;
            this.prevPresenceContext = this.presenceContext;
            this.presenceContext = presenceContext;
            /**
             * Update prop event handlers ie onAnimationStart, onAnimationComplete
             */
            for (let i = 0; i < propEventHandlers.length; i++) {
                const key = propEventHandlers[i];
                if (this.propEventSubscriptions[key]) {
                    this.propEventSubscriptions[key]();
                    delete this.propEventSubscriptions[key];
                }
                const listenerName = ("on" + key);
                const listener = props[listenerName];
                if (listener) {
                    this.propEventSubscriptions[key] = this.on(key, listener);
                }
            }
            this.prevMotionValues = updateMotionValuesFromProps(this, this.scrapeMotionValuesFromProps(props, this.prevProps, this), this.prevMotionValues);
            if (this.handleChildMotionValue) {
                this.handleChildMotionValue();
            }
        }
        getProps() {
            return this.props;
        }
        /**
         * Returns the variant definition with a given name.
         */
        getVariant(name) {
            return this.props.variants ? this.props.variants[name] : undefined;
        }
        /**
         * Returns the defined default transition on this component.
         */
        getDefaultTransition() {
            return this.props.transition;
        }
        getTransformPagePoint() {
            return this.props.transformPagePoint;
        }
        getClosestVariantNode() {
            return this.isVariantNode
                ? this
                : this.parent
                    ? this.parent.getClosestVariantNode()
                    : undefined;
        }
        getVariantContext(startAtParent = false) {
            if (startAtParent) {
                return this.parent ? this.parent.getVariantContext() : undefined;
            }
            if (!this.isControllingVariants) {
                const context = this.parent
                    ? this.parent.getVariantContext() || {}
                    : {};
                if (this.props.initial !== undefined) {
                    context.initial = this.props.initial;
                }
                return context;
            }
            const context = {};
            for (let i = 0; i < numVariantProps; i++) {
                const name = variantProps[i];
                const prop = this.props[name];
                if (isVariantLabel(prop) || prop === false) {
                    context[name] = prop;
                }
            }
            return context;
        }
        /**
         * Add a child visual element to our set of children.
         */
        addVariantChild(child) {
            const closestVariantNode = this.getClosestVariantNode();
            if (closestVariantNode) {
                closestVariantNode.variantChildren &&
                    closestVariantNode.variantChildren.add(child);
                return () => closestVariantNode.variantChildren.delete(child);
            }
        }
        /**
         * Add a motion value and bind it to this visual element.
         */
        addValue(key, value) {
            // Remove existing value if it exists
            const existingValue = this.values.get(key);
            if (value !== existingValue) {
                if (existingValue)
                    this.removeValue(key);
                this.bindToMotionValue(key, value);
                this.values.set(key, value);
                this.latestValues[key] = value.get();
            }
        }
        /**
         * Remove a motion value and unbind any active subscriptions.
         */
        removeValue(key) {
            this.values.delete(key);
            const unsubscribe = this.valueSubscriptions.get(key);
            if (unsubscribe) {
                unsubscribe();
                this.valueSubscriptions.delete(key);
            }
            delete this.latestValues[key];
            this.removeValueFromRenderState(key, this.renderState);
        }
        /**
         * Check whether we have a motion value for this key
         */
        hasValue(key) {
            return this.values.has(key);
        }
        getValue(key, defaultValue) {
            if (this.props.values && this.props.values[key]) {
                return this.props.values[key];
            }
            let value = this.values.get(key);
            if (value === undefined && defaultValue !== undefined) {
                value = motionValue(defaultValue === null ? undefined : defaultValue, { owner: this });
                this.addValue(key, value);
            }
            return value;
        }
        /**
         * If we're trying to animate to a previously unencountered value,
         * we need to check for it in our state and as a last resort read it
         * directly from the instance (which might have performance implications).
         */
        readValue(key, target) {
            var _a;
            let value = this.latestValues[key] !== undefined || !this.current
                ? this.latestValues[key]
                : (_a = this.getBaseTargetFromProps(this.props, key)) !== null && _a !== void 0 ? _a : this.readValueFromInstance(this.current, key, this.options);
            if (value !== undefined && value !== null) {
                if (typeof value === "string" &&
                    (isNumericalString(value) || isZeroValueString(value))) {
                    // If this is a number read as a string, ie "0" or "200", convert it to a number
                    value = parseFloat(value);
                }
                else if (!findValueType(value) && complex.test(target)) {
                    value = getAnimatableNone(key, target);
                }
                this.setBaseTarget(key, isMotionValue(value) ? value.get() : value);
            }
            return isMotionValue(value) ? value.get() : value;
        }
        /**
         * Set the base target to later animate back to. This is currently
         * only hydrated on creation and when we first read a value.
         */
        setBaseTarget(key, value) {
            this.baseTarget[key] = value;
        }
        /**
         * Find the base target for a value thats been removed from all animation
         * props.
         */
        getBaseTarget(key) {
            var _a;
            const { initial } = this.props;
            let valueFromInitial;
            if (typeof initial === "string" || typeof initial === "object") {
                const variant = resolveVariantFromProps(this.props, initial, (_a = this.presenceContext) === null || _a === void 0 ? void 0 : _a.custom);
                if (variant) {
                    valueFromInitial = variant[key];
                }
            }
            /**
             * If this value still exists in the current initial variant, read that.
             */
            if (initial && valueFromInitial !== undefined) {
                return valueFromInitial;
            }
            /**
             * Alternatively, if this VisualElement config has defined a getBaseTarget
             * so we can read the value from an alternative source, try that.
             */
            const target = this.getBaseTargetFromProps(this.props, key);
            if (target !== undefined && !isMotionValue(target))
                return target;
            /**
             * If the value was initially defined on initial, but it doesn't any more,
             * return undefined. Otherwise return the value as initially read from the DOM.
             */
            return this.initialValues[key] !== undefined &&
                valueFromInitial === undefined
                ? undefined
                : this.baseTarget[key];
        }
        on(eventName, callback) {
            if (!this.events[eventName]) {
                this.events[eventName] = new SubscriptionManager();
            }
            return this.events[eventName].add(callback);
        }
        notify(eventName, ...args) {
            if (this.events[eventName]) {
                this.events[eventName].notify(...args);
            }
        }
    }

    class DOMVisualElement extends VisualElement {
        constructor() {
            super(...arguments);
            this.KeyframeResolver = DOMKeyframesResolver;
        }
        sortInstanceNodePosition(a, b) {
            /**
             * compareDocumentPosition returns a bitmask, by using the bitwise &
             * we're returning true if 2 in that bitmask is set to true. 2 is set
             * to true if b preceeds a.
             */
            return a.compareDocumentPosition(b) & 2 ? 1 : -1;
        }
        getBaseTargetFromProps(props, key) {
            return props.style
                ? props.style[key]
                : undefined;
        }
        removeValueFromRenderState(key, { vars, style }) {
            delete vars[key];
            delete style[key];
        }
    }

    const translateAlias = {
        x: "translateX",
        y: "translateY",
        z: "translateZ",
        transformPerspective: "perspective",
    };
    const numTransforms = transformPropOrder.length;
    /**
     * Build a CSS transform style from individual x/y/scale etc properties.
     *
     * This outputs with a default order of transforms/scales/rotations, this can be customised by
     * providing a transformTemplate function.
     */
    function buildTransform(transform, { enableHardwareAcceleration = true, allowTransformNone = true, }, transformIsDefault, transformTemplate) {
        // The transform string we're going to build into.
        let transformString = "";
        /**
         * Loop over all possible transforms in order, adding the ones that
         * are present to the transform string.
         */
        for (let i = 0; i < numTransforms; i++) {
            const key = transformPropOrder[i];
            if (transform[key] !== undefined) {
                const transformName = translateAlias[key] || key;
                transformString += `${transformName}(${transform[key]}) `;
            }
        }
        if (enableHardwareAcceleration && !transform.z) {
            transformString += "translateZ(0)";
        }
        transformString = transformString.trim();
        // If we have a custom `transform` template, pass our transform values and
        // generated transformString to that before returning
        if (transformTemplate) {
            transformString = transformTemplate(transform, transformIsDefault ? "" : transformString);
        }
        else if (allowTransformNone && transformIsDefault) {
            transformString = "none";
        }
        return transformString;
    }

    /**
     * Provided a value and a ValueType, returns the value as that value type.
     */
    const getValueAsType = (value, type) => {
        return type && typeof value === "number"
            ? type.transform(value)
            : value;
    };

    function buildHTMLStyles(state, latestValues, options, transformTemplate) {
        const { style, vars, transform, transformOrigin } = state;
        // Track whether we encounter any transform or transformOrigin values.
        let hasTransform = false;
        let hasTransformOrigin = false;
        // Does the calculated transform essentially equal "none"?
        let transformIsNone = true;
        /**
         * Loop over all our latest animated values and decide whether to handle them
         * as a style or CSS variable.
         *
         * Transforms and transform origins are kept seperately for further processing.
         */
        for (const key in latestValues) {
            const value = latestValues[key];
            /**
             * If this is a CSS variable we don't do any further processing.
             */
            if (isCSSVariableName(key)) {
                vars[key] = value;
                continue;
            }
            // Convert the value to its default value type, ie 0 -> "0px"
            const valueType = numberValueTypes[key];
            const valueAsType = getValueAsType(value, valueType);
            if (transformProps.has(key)) {
                // If this is a transform, flag to enable further transform processing
                hasTransform = true;
                transform[key] = valueAsType;
                // If we already know we have a non-default transform, early return
                if (!transformIsNone)
                    continue;
                // Otherwise check to see if this is a default transform
                if (value !== (valueType.default || 0))
                    transformIsNone = false;
            }
            else if (key.startsWith("origin")) {
                // If this is a transform origin, flag and enable further transform-origin processing
                hasTransformOrigin = true;
                transformOrigin[key] = valueAsType;
            }
            else {
                style[key] = valueAsType;
            }
        }
        if (!latestValues.transform) {
            if (hasTransform || transformTemplate) {
                style.transform = buildTransform(state.transform, options, transformIsNone, transformTemplate);
            }
            else if (style.transform) {
                /**
                 * If we have previously created a transform but currently don't have any,
                 * reset transform style to none.
                 */
                style.transform = "none";
            }
        }
        /**
         * Build a transformOrigin style. Uses the same defaults as the browser for
         * undefined origins.
         */
        if (hasTransformOrigin) {
            const { originX = "50%", originY = "50%", originZ = 0, } = transformOrigin;
            style.transformOrigin = `${originX} ${originY} ${originZ}`;
        }
    }

    function renderHTML(element, { style, vars }, styleProp, projection) {
        Object.assign(element.style, style, projection && projection.getProjectionStyles(styleProp));
        // Loop over any CSS variables and assign those.
        for (const key in vars) {
            element.style.setProperty(key, vars[key]);
        }
    }

    /**
     * Bounding boxes tend to be defined as top, left, right, bottom. For various operations
     * it's easier to consider each axis individually. This function returns a bounding box
     * as a map of single-axis min/max values.
     */
    function convertBoundingBoxToBox({ top, left, right, bottom, }) {
        return {
            x: { min: left, max: right },
            y: { min: top, max: bottom },
        };
    }
    /**
     * Applies a TransformPoint function to a bounding box. TransformPoint is usually a function
     * provided by Framer to allow measured points to be corrected for device scaling. This is used
     * when measuring DOM elements and DOM event points.
     */
    function transformBoxPoints(point, transformPoint) {
        if (!transformPoint)
            return point;
        const topLeft = transformPoint({ x: point.left, y: point.top });
        const bottomRight = transformPoint({ x: point.right, y: point.bottom });
        return {
            top: topLeft.y,
            left: topLeft.x,
            bottom: bottomRight.y,
            right: bottomRight.x,
        };
    }

    function measureViewportBox(instance, transformPoint) {
        return convertBoundingBoxToBox(transformBoxPoints(instance.getBoundingClientRect(), transformPoint));
    }

    function getComputedStyle(element) {
        return window.getComputedStyle(element);
    }
    class HTMLVisualElement extends DOMVisualElement {
        constructor() {
            super(...arguments);
            this.type = "html";
        }
        readValueFromInstance(instance, key) {
            if (transformProps.has(key)) {
                const defaultType = getDefaultValueType(key);
                return defaultType ? defaultType.default || 0 : 0;
            }
            else {
                const computedStyle = getComputedStyle(instance);
                const value = (isCSSVariableName(key)
                    ? computedStyle.getPropertyValue(key)
                    : computedStyle[key]) || 0;
                return typeof value === "string" ? value.trim() : value;
            }
        }
        measureInstanceViewportBox(instance, { transformPagePoint }) {
            return measureViewportBox(instance, transformPagePoint);
        }
        build(renderState, latestValues, options, props) {
            buildHTMLStyles(renderState, latestValues, options, props.transformTemplate);
        }
        scrapeMotionValuesFromProps(props, prevProps, visualElement) {
            return scrapeMotionValuesFromProps(props, prevProps, visualElement);
        }
        handleChildMotionValue() {
            if (this.childSubscription) {
                this.childSubscription();
                delete this.childSubscription;
            }
            const { children } = this.props;
            if (isMotionValue(children)) {
                this.childSubscription = children.on("change", (latest) => {
                    if (this.current)
                        this.current.textContent = `${latest}`;
                });
            }
        }
        renderInstance(instance, renderState, styleProp, projection) {
            renderHTML(instance, renderState, styleProp, projection);
        }
    }

    function animateSingleValue(value, keyframes, options) {
        const motionValue$1 = isMotionValue(value) ? value : motionValue(value);
        motionValue$1.start(animateMotionValue("", motionValue$1, keyframes, options));
        return motionValue$1.animation;
    }

    const { schedule: microtask, cancel: cancelMicrotask } = createRenderBatcher(queueMicrotask, false);

    const transformAxes = ["", "X", "Y", "Z"];
    const hiddenVisibility = { visibility: "hidden" };
    /**
     * We use 1000 as the animation target as 0-1000 maps better to pixels than 0-1
     * which has a noticeable difference in spring animations
     */
    const animationTarget = 1000;
    let id = 0;
    /**
     * Use a mutable data object for debug data so as to not create a new
     * object every frame.
     */
    const projectionFrameData = {
        type: "projectionFrame",
        totalNodes: 0,
        resolvedTargetDeltas: 0,
        recalculatedProjection: 0,
    };
    function resetDistortingTransform(key, visualElement, values, sharedAnimationValues) {
        const { latestValues } = visualElement;
        // Record the distorting transform and then temporarily set it to 0
        if (latestValues[key]) {
            values[key] = latestValues[key];
            visualElement.setStaticValue(key, 0);
            if (sharedAnimationValues) {
                sharedAnimationValues[key] = 0;
            }
        }
    }
    function createProjectionNode({ attachResizeListener, defaultParent, measureScroll, checkIsScrollRoot, resetTransform, }) {
        return class ProjectionNode {
            constructor(latestValues = {}, parent = defaultParent === null || defaultParent === void 0 ? void 0 : defaultParent()) {
                /**
                 * A unique ID generated for every projection node.
                 */
                this.id = id++;
                /**
                 * An id that represents a unique session instigated by startUpdate.
                 */
                this.animationId = 0;
                /**
                 * A Set containing all this component's children. This is used to iterate
                 * through the children.
                 *
                 * TODO: This could be faster to iterate as a flat array stored on the root node.
                 */
                this.children = new Set();
                /**
                 * Options for the node. We use this to configure what kind of layout animations
                 * we should perform (if any).
                 */
                this.options = {};
                /**
                 * We use this to detect when its safe to shut down part of a projection tree.
                 * We have to keep projecting children for scale correction and relative projection
                 * until all their parents stop performing layout animations.
                 */
                this.isTreeAnimating = false;
                this.isAnimationBlocked = false;
                /**
                 * Flag to true if we think this layout has been changed. We can't always know this,
                 * currently we set it to true every time a component renders, or if it has a layoutDependency
                 * if that has changed between renders. Additionally, components can be grouped by LayoutGroup
                 * and if one node is dirtied, they all are.
                 */
                this.isLayoutDirty = false;
                /**
                 * Flag to true if we think the projection calculations for this node needs
                 * recalculating as a result of an updated transform or layout animation.
                 */
                this.isProjectionDirty = false;
                /**
                 * Flag to true if the layout *or* transform has changed. This then gets propagated
                 * throughout the projection tree, forcing any element below to recalculate on the next frame.
                 */
                this.isSharedProjectionDirty = false;
                /**
                 * Flag transform dirty. This gets propagated throughout the whole tree but is only
                 * respected by shared nodes.
                 */
                this.isTransformDirty = false;
                /**
                 * Block layout updates for instant layout transitions throughout the tree.
                 */
                this.updateManuallyBlocked = false;
                this.updateBlockedByResize = false;
                /**
                 * Set to true between the start of the first `willUpdate` call and the end of the `didUpdate`
                 * call.
                 */
                this.isUpdating = false;
                /**
                 * If this is an SVG element we currently disable projection transforms
                 */
                this.isSVG = false;
                /**
                 * Flag to true (during promotion) if a node doing an instant layout transition needs to reset
                 * its projection styles.
                 */
                this.needsReset = false;
                /**
                 * Flags whether this node should have its transform reset prior to measuring.
                 */
                this.shouldResetTransform = false;
                /**
                 * An object representing the calculated contextual/accumulated/tree scale.
                 * This will be used to scale calculcated projection transforms, as these are
                 * calculated in screen-space but need to be scaled for elements to layoutly
                 * make it to their calculated destinations.
                 *
                 * TODO: Lazy-init
                 */
                this.treeScale = { x: 1, y: 1 };
                /**
                 *
                 */
                this.eventHandlers = new Map();
                this.hasTreeAnimated = false;
                // Note: Currently only running on root node
                this.updateScheduled = false;
                this.projectionUpdateScheduled = false;
                this.checkUpdateFailed = () => {
                    if (this.isUpdating) {
                        this.isUpdating = false;
                        this.clearAllSnapshots();
                    }
                };
                /**
                 * This is a multi-step process as shared nodes might be of different depths. Nodes
                 * are sorted by depth order, so we need to resolve the entire tree before moving to
                 * the next step.
                 */
                this.updateProjection = () => {
                    this.projectionUpdateScheduled = false;
                    /**
                     * Reset debug counts. Manually resetting rather than creating a new
                     * object each frame.
                     */
                    projectionFrameData.totalNodes =
                        projectionFrameData.resolvedTargetDeltas =
                            projectionFrameData.recalculatedProjection =
                                0;
                    this.nodes.forEach(propagateDirtyNodes);
                    this.nodes.forEach(resolveTargetDelta);
                    this.nodes.forEach(calcProjection);
                    this.nodes.forEach(cleanDirtyNodes);
                    record(projectionFrameData);
                };
                this.hasProjected = false;
                this.isVisible = true;
                this.animationProgress = 0;
                /**
                 * Shared layout
                 */
                // TODO Only running on root node
                this.sharedNodes = new Map();
                this.latestValues = latestValues;
                this.root = parent ? parent.root || parent : this;
                this.path = parent ? [...parent.path, parent] : [];
                this.parent = parent;
                this.depth = parent ? parent.depth + 1 : 0;
                for (let i = 0; i < this.path.length; i++) {
                    this.path[i].shouldResetTransform = true;
                }
                if (this.root === this)
                    this.nodes = new FlatTree();
            }
            addEventListener(name, handler) {
                if (!this.eventHandlers.has(name)) {
                    this.eventHandlers.set(name, new SubscriptionManager());
                }
                return this.eventHandlers.get(name).add(handler);
            }
            notifyListeners(name, ...args) {
                const subscriptionManager = this.eventHandlers.get(name);
                subscriptionManager && subscriptionManager.notify(...args);
            }
            hasListeners(name) {
                return this.eventHandlers.has(name);
            }
            /**
             * Lifecycles
             */
            mount(instance, isLayoutDirty = this.root.hasTreeAnimated) {
                if (this.instance)
                    return;
                this.isSVG = isSVGElement(instance);
                this.instance = instance;
                const { layoutId, layout, visualElement } = this.options;
                if (visualElement && !visualElement.current) {
                    visualElement.mount(instance);
                }
                this.root.nodes.add(this);
                this.parent && this.parent.children.add(this);
                if (isLayoutDirty && (layout || layoutId)) {
                    this.isLayoutDirty = true;
                }
                if (attachResizeListener) {
                    let cancelDelay;
                    const resizeUnblockUpdate = () => (this.root.updateBlockedByResize = false);
                    attachResizeListener(instance, () => {
                        this.root.updateBlockedByResize = true;
                        cancelDelay && cancelDelay();
                        cancelDelay = delay(resizeUnblockUpdate, 250);
                        if (globalProjectionState.hasAnimatedSinceResize) {
                            globalProjectionState.hasAnimatedSinceResize = false;
                            this.nodes.forEach(finishAnimation);
                        }
                    });
                }
                if (layoutId) {
                    this.root.registerSharedNode(layoutId, this);
                }
                // Only register the handler if it requires layout animation
                if (this.options.animate !== false &&
                    visualElement &&
                    (layoutId || layout)) {
                    this.addEventListener("didUpdate", ({ delta, hasLayoutChanged, hasRelativeTargetChanged, layout: newLayout, }) => {
                        if (this.isTreeAnimationBlocked()) {
                            this.target = undefined;
                            this.relativeTarget = undefined;
                            return;
                        }
                        // TODO: Check here if an animation exists
                        const layoutTransition = this.options.transition ||
                            visualElement.getDefaultTransition() ||
                            defaultLayoutTransition;
                        const { onLayoutAnimationStart, onLayoutAnimationComplete, } = visualElement.getProps();
                        /**
                         * The target layout of the element might stay the same,
                         * but its position relative to its parent has changed.
                         */
                        const targetChanged = !this.targetLayout ||
                            !boxEqualsRounded(this.targetLayout, newLayout) ||
                            hasRelativeTargetChanged;
                        /**
                         * If the layout hasn't seemed to have changed, it might be that the
                         * element is visually in the same place in the document but its position
                         * relative to its parent has indeed changed. So here we check for that.
                         */
                        const hasOnlyRelativeTargetChanged = !hasLayoutChanged && hasRelativeTargetChanged;
                        if (this.options.layoutRoot ||
                            (this.resumeFrom && this.resumeFrom.instance) ||
                            hasOnlyRelativeTargetChanged ||
                            (hasLayoutChanged &&
                                (targetChanged || !this.currentAnimation))) {
                            if (this.resumeFrom) {
                                this.resumingFrom = this.resumeFrom;
                                this.resumingFrom.resumingFrom = undefined;
                            }
                            this.setAnimationOrigin(delta, hasOnlyRelativeTargetChanged);
                            const animationOptions = {
                                ...getValueTransition(layoutTransition, "layout"),
                                onPlay: onLayoutAnimationStart,
                                onComplete: onLayoutAnimationComplete,
                            };
                            if (visualElement.shouldReduceMotion ||
                                this.options.layoutRoot) {
                                animationOptions.delay = 0;
                                animationOptions.type = false;
                            }
                            this.startAnimation(animationOptions);
                        }
                        else {
                            /**
                             * If the layout hasn't changed and we have an animation that hasn't started yet,
                             * finish it immediately. Otherwise it will be animating from a location
                             * that was probably never commited to screen and look like a jumpy box.
                             */
                            if (!hasLayoutChanged) {
                                finishAnimation(this);
                            }
                            if (this.isLead() && this.options.onExitComplete) {
                                this.options.onExitComplete();
                            }
                        }
                        this.targetLayout = newLayout;
                    });
                }
            }
            unmount() {
                this.options.layoutId && this.willUpdate();
                this.root.nodes.remove(this);
                const stack = this.getStack();
                stack && stack.remove(this);
                this.parent && this.parent.children.delete(this);
                this.instance = undefined;
                cancelFrame(this.updateProjection);
            }
            // only on the root
            blockUpdate() {
                this.updateManuallyBlocked = true;
            }
            unblockUpdate() {
                this.updateManuallyBlocked = false;
            }
            isUpdateBlocked() {
                return this.updateManuallyBlocked || this.updateBlockedByResize;
            }
            isTreeAnimationBlocked() {
                return (this.isAnimationBlocked ||
                    (this.parent && this.parent.isTreeAnimationBlocked()) ||
                    false);
            }
            // Note: currently only running on root node
            startUpdate() {
                if (this.isUpdateBlocked())
                    return;
                this.isUpdating = true;
                this.nodes && this.nodes.forEach(resetSkewAndRotation);
                this.animationId++;
            }
            getTransformTemplate() {
                const { visualElement } = this.options;
                return visualElement && visualElement.getProps().transformTemplate;
            }
            willUpdate(shouldNotifyListeners = true) {
                this.root.hasTreeAnimated = true;
                if (this.root.isUpdateBlocked()) {
                    this.options.onExitComplete && this.options.onExitComplete();
                    return;
                }
                !this.root.isUpdating && this.root.startUpdate();
                if (this.isLayoutDirty)
                    return;
                this.isLayoutDirty = true;
                for (let i = 0; i < this.path.length; i++) {
                    const node = this.path[i];
                    node.shouldResetTransform = true;
                    node.updateScroll("snapshot");
                    if (node.options.layoutRoot) {
                        node.willUpdate(false);
                    }
                }
                const { layoutId, layout } = this.options;
                if (layoutId === undefined && !layout)
                    return;
                const transformTemplate = this.getTransformTemplate();
                this.prevTransformTemplateValue = transformTemplate
                    ? transformTemplate(this.latestValues, "")
                    : undefined;
                this.updateSnapshot();
                shouldNotifyListeners && this.notifyListeners("willUpdate");
            }
            update() {
                this.updateScheduled = false;
                const updateWasBlocked = this.isUpdateBlocked();
                // When doing an instant transition, we skip the layout update,
                // but should still clean up the measurements so that the next
                // snapshot could be taken correctly.
                if (updateWasBlocked) {
                    this.unblockUpdate();
                    this.clearAllSnapshots();
                    this.nodes.forEach(clearMeasurements);
                    return;
                }
                if (!this.isUpdating) {
                    this.nodes.forEach(clearIsLayoutDirty);
                }
                this.isUpdating = false;
                /**
                 * Write
                 */
                if (window.HandoffCancelAllAnimations) {
                    window.HandoffCancelAllAnimations();
                }
                this.nodes.forEach(resetTransformStyle);
                /**
                 * Read ==================
                 */
                // Update layout measurements of updated children
                this.nodes.forEach(updateLayout);
                /**
                 * Write
                 */
                // Notify listeners that the layout is updated
                this.nodes.forEach(notifyLayoutUpdate);
                this.clearAllSnapshots();
                /**
                 * Manually flush any pending updates. Ideally
                 * we could leave this to the following requestAnimationFrame but this seems
                 * to leave a flash of incorrectly styled content.
                 */
                const now = time.now();
                frameData.delta = clamp(0, 1000 / 60, now - frameData.timestamp);
                frameData.timestamp = now;
                frameData.isProcessing = true;
                steps.update.process(frameData);
                steps.preRender.process(frameData);
                steps.render.process(frameData);
                frameData.isProcessing = false;
            }
            didUpdate() {
                if (!this.updateScheduled) {
                    this.updateScheduled = true;
                    microtask.read(() => this.update());
                }
            }
            clearAllSnapshots() {
                this.nodes.forEach(clearSnapshot);
                this.sharedNodes.forEach(removeLeadSnapshots);
            }
            scheduleUpdateProjection() {
                if (!this.projectionUpdateScheduled) {
                    this.projectionUpdateScheduled = true;
                    frame.preRender(this.updateProjection, false, true);
                }
            }
            scheduleCheckAfterUnmount() {
                /**
                 * If the unmounting node is in a layoutGroup and did trigger a willUpdate,
                 * we manually call didUpdate to give a chance to the siblings to animate.
                 * Otherwise, cleanup all snapshots to prevents future nodes from reusing them.
                 */
                frame.postRender(() => {
                    if (this.isLayoutDirty) {
                        this.root.didUpdate();
                    }
                    else {
                        this.root.checkUpdateFailed();
                    }
                });
            }
            /**
             * Update measurements
             */
            updateSnapshot() {
                if (this.snapshot || !this.instance)
                    return;
                this.snapshot = this.measure();
            }
            updateLayout() {
                if (!this.instance)
                    return;
                // TODO: Incorporate into a forwarded scroll offset
                this.updateScroll();
                if (!(this.options.alwaysMeasureLayout && this.isLead()) &&
                    !this.isLayoutDirty) {
                    return;
                }
                /**
                 * When a node is mounted, it simply resumes from the prevLead's
                 * snapshot instead of taking a new one, but the ancestors scroll
                 * might have updated while the prevLead is unmounted. We need to
                 * update the scroll again to make sure the layout we measure is
                 * up to date.
                 */
                if (this.resumeFrom && !this.resumeFrom.instance) {
                    for (let i = 0; i < this.path.length; i++) {
                        const node = this.path[i];
                        node.updateScroll();
                    }
                }
                const prevLayout = this.layout;
                this.layout = this.measure(false);
                this.layoutCorrected = createBox();
                this.isLayoutDirty = false;
                this.projectionDelta = undefined;
                this.notifyListeners("measure", this.layout.layoutBox);
                const { visualElement } = this.options;
                visualElement &&
                    visualElement.notify("LayoutMeasure", this.layout.layoutBox, prevLayout ? prevLayout.layoutBox : undefined);
            }
            updateScroll(phase = "measure") {
                let needsMeasurement = Boolean(this.options.layoutScroll && this.instance);
                if (this.scroll &&
                    this.scroll.animationId === this.root.animationId &&
                    this.scroll.phase === phase) {
                    needsMeasurement = false;
                }
                if (needsMeasurement) {
                    this.scroll = {
                        animationId: this.root.animationId,
                        phase,
                        isRoot: checkIsScrollRoot(this.instance),
                        offset: measureScroll(this.instance),
                    };
                }
            }
            resetTransform() {
                if (!resetTransform)
                    return;
                const isResetRequested = this.isLayoutDirty || this.shouldResetTransform;
                const hasProjection = this.projectionDelta && !isDeltaZero(this.projectionDelta);
                const transformTemplate = this.getTransformTemplate();
                const transformTemplateValue = transformTemplate
                    ? transformTemplate(this.latestValues, "")
                    : undefined;
                const transformTemplateHasChanged = transformTemplateValue !== this.prevTransformTemplateValue;
                if (isResetRequested &&
                    (hasProjection ||
                        hasTransform(this.latestValues) ||
                        transformTemplateHasChanged)) {
                    resetTransform(this.instance, transformTemplateValue);
                    this.shouldResetTransform = false;
                    this.scheduleRender();
                }
            }
            measure(removeTransform = true) {
                const pageBox = this.measurePageBox();
                let layoutBox = this.removeElementScroll(pageBox);
                /**
                 * Measurements taken during the pre-render stage
                 * still have transforms applied so we remove them
                 * via calculation.
                 */
                if (removeTransform) {
                    layoutBox = this.removeTransform(layoutBox);
                }
                roundBox(layoutBox);
                return {
                    animationId: this.root.animationId,
                    measuredBox: pageBox,
                    layoutBox,
                    latestValues: {},
                    source: this.id,
                };
            }
            measurePageBox() {
                const { visualElement } = this.options;
                if (!visualElement)
                    return createBox();
                const box = visualElement.measureViewportBox();
                // Remove viewport scroll to give page-relative coordinates
                const { scroll } = this.root;
                if (scroll) {
                    translateAxis(box.x, scroll.offset.x);
                    translateAxis(box.y, scroll.offset.y);
                }
                return box;
            }
            removeElementScroll(box) {
                const boxWithoutScroll = createBox();
                copyBoxInto(boxWithoutScroll, box);
                /**
                 * Performance TODO: Keep a cumulative scroll offset down the tree
                 * rather than loop back up the path.
                 */
                for (let i = 0; i < this.path.length; i++) {
                    const node = this.path[i];
                    const { scroll, options } = node;
                    if (node !== this.root && scroll && options.layoutScroll) {
                        /**
                         * If this is a new scroll root, we want to remove all previous scrolls
                         * from the viewport box.
                         */
                        if (scroll.isRoot) {
                            copyBoxInto(boxWithoutScroll, box);
                            const { scroll: rootScroll } = this.root;
                            /**
                             * Undo the application of page scroll that was originally added
                             * to the measured bounding box.
                             */
                            if (rootScroll) {
                                translateAxis(boxWithoutScroll.x, -rootScroll.offset.x);
                                translateAxis(boxWithoutScroll.y, -rootScroll.offset.y);
                            }
                        }
                        translateAxis(boxWithoutScroll.x, scroll.offset.x);
                        translateAxis(boxWithoutScroll.y, scroll.offset.y);
                    }
                }
                return boxWithoutScroll;
            }
            applyTransform(box, transformOnly = false) {
                const withTransforms = createBox();
                copyBoxInto(withTransforms, box);
                for (let i = 0; i < this.path.length; i++) {
                    const node = this.path[i];
                    if (!transformOnly &&
                        node.options.layoutScroll &&
                        node.scroll &&
                        node !== node.root) {
                        transformBox(withTransforms, {
                            x: -node.scroll.offset.x,
                            y: -node.scroll.offset.y,
                        });
                    }
                    if (!hasTransform(node.latestValues))
                        continue;
                    transformBox(withTransforms, node.latestValues);
                }
                if (hasTransform(this.latestValues)) {
                    transformBox(withTransforms, this.latestValues);
                }
                return withTransforms;
            }
            removeTransform(box) {
                const boxWithoutTransform = createBox();
                copyBoxInto(boxWithoutTransform, box);
                for (let i = 0; i < this.path.length; i++) {
                    const node = this.path[i];
                    if (!node.instance)
                        continue;
                    if (!hasTransform(node.latestValues))
                        continue;
                    hasScale(node.latestValues) && node.updateSnapshot();
                    const sourceBox = createBox();
                    const nodeBox = node.measurePageBox();
                    copyBoxInto(sourceBox, nodeBox);
                    removeBoxTransforms(boxWithoutTransform, node.latestValues, node.snapshot ? node.snapshot.layoutBox : undefined, sourceBox);
                }
                if (hasTransform(this.latestValues)) {
                    removeBoxTransforms(boxWithoutTransform, this.latestValues);
                }
                return boxWithoutTransform;
            }
            setTargetDelta(delta) {
                this.targetDelta = delta;
                this.root.scheduleUpdateProjection();
                this.isProjectionDirty = true;
            }
            setOptions(options) {
                this.options = {
                    ...this.options,
                    ...options,
                    crossfade: options.crossfade !== undefined ? options.crossfade : true,
                };
            }
            clearMeasurements() {
                this.scroll = undefined;
                this.layout = undefined;
                this.snapshot = undefined;
                this.prevTransformTemplateValue = undefined;
                this.targetDelta = undefined;
                this.target = undefined;
                this.isLayoutDirty = false;
            }
            forceRelativeParentToResolveTarget() {
                if (!this.relativeParent)
                    return;
                /**
                 * If the parent target isn't up-to-date, force it to update.
                 * This is an unfortunate de-optimisation as it means any updating relative
                 * projection will cause all the relative parents to recalculate back
                 * up the tree.
                 */
                if (this.relativeParent.resolvedRelativeTargetAt !==
                    frameData.timestamp) {
                    this.relativeParent.resolveTargetDelta(true);
                }
            }
            resolveTargetDelta(forceRecalculation = false) {
                var _a;
                /**
                 * Once the dirty status of nodes has been spread through the tree, we also
                 * need to check if we have a shared node of a different depth that has itself
                 * been dirtied.
                 */
                const lead = this.getLead();
                this.isProjectionDirty || (this.isProjectionDirty = lead.isProjectionDirty);
                this.isTransformDirty || (this.isTransformDirty = lead.isTransformDirty);
                this.isSharedProjectionDirty || (this.isSharedProjectionDirty = lead.isSharedProjectionDirty);
                const isShared = Boolean(this.resumingFrom) || this !== lead;
                /**
                 * We don't use transform for this step of processing so we don't
                 * need to check whether any nodes have changed transform.
                 */
                const canSkip = !(forceRecalculation ||
                    (isShared && this.isSharedProjectionDirty) ||
                    this.isProjectionDirty ||
                    ((_a = this.parent) === null || _a === void 0 ? void 0 : _a.isProjectionDirty) ||
                    this.attemptToResolveRelativeTarget);
                if (canSkip)
                    return;
                const { layout, layoutId } = this.options;
                /**
                 * If we have no layout, we can't perform projection, so early return
                 */
                if (!this.layout || !(layout || layoutId))
                    return;
                this.resolvedRelativeTargetAt = frameData.timestamp;
                /**
                 * If we don't have a targetDelta but do have a layout, we can attempt to resolve
                 * a relativeParent. This will allow a component to perform scale correction
                 * even if no animation has started.
                 */
                if (!this.targetDelta && !this.relativeTarget) {
                    const relativeParent = this.getClosestProjectingParent();
                    if (relativeParent &&
                        relativeParent.layout &&
                        this.animationProgress !== 1) {
                        this.relativeParent = relativeParent;
                        this.forceRelativeParentToResolveTarget();
                        this.relativeTarget = createBox();
                        this.relativeTargetOrigin = createBox();
                        calcRelativePosition(this.relativeTargetOrigin, this.layout.layoutBox, relativeParent.layout.layoutBox);
                        copyBoxInto(this.relativeTarget, this.relativeTargetOrigin);
                    }
                    else {
                        this.relativeParent = this.relativeTarget = undefined;
                    }
                }
                /**
                 * If we have no relative target or no target delta our target isn't valid
                 * for this frame.
                 */
                if (!this.relativeTarget && !this.targetDelta)
                    return;
                /**
                 * Lazy-init target data structure
                 */
                if (!this.target) {
                    this.target = createBox();
                    this.targetWithTransforms = createBox();
                }
                /**
                 * If we've got a relative box for this component, resolve it into a target relative to the parent.
                 */
                if (this.relativeTarget &&
                    this.relativeTargetOrigin &&
                    this.relativeParent &&
                    this.relativeParent.target) {
                    this.forceRelativeParentToResolveTarget();
                    calcRelativeBox(this.target, this.relativeTarget, this.relativeParent.target);
                    /**
                     * If we've only got a targetDelta, resolve it into a target
                     */
                }
                else if (this.targetDelta) {
                    if (Boolean(this.resumingFrom)) {
                        // TODO: This is creating a new object every frame
                        this.target = this.applyTransform(this.layout.layoutBox);
                    }
                    else {
                        copyBoxInto(this.target, this.layout.layoutBox);
                    }
                    applyBoxDelta(this.target, this.targetDelta);
                }
                else {
                    /**
                     * If no target, use own layout as target
                     */
                    copyBoxInto(this.target, this.layout.layoutBox);
                }
                /**
                 * If we've been told to attempt to resolve a relative target, do so.
                 */
                if (this.attemptToResolveRelativeTarget) {
                    this.attemptToResolveRelativeTarget = false;
                    const relativeParent = this.getClosestProjectingParent();
                    if (relativeParent &&
                        Boolean(relativeParent.resumingFrom) ===
                            Boolean(this.resumingFrom) &&
                        !relativeParent.options.layoutScroll &&
                        relativeParent.target &&
                        this.animationProgress !== 1) {
                        this.relativeParent = relativeParent;
                        this.forceRelativeParentToResolveTarget();
                        this.relativeTarget = createBox();
                        this.relativeTargetOrigin = createBox();
                        calcRelativePosition(this.relativeTargetOrigin, this.target, relativeParent.target);
                        copyBoxInto(this.relativeTarget, this.relativeTargetOrigin);
                    }
                    else {
                        this.relativeParent = this.relativeTarget = undefined;
                    }
                }
                /**
                 * Increase debug counter for resolved target deltas
                 */
                projectionFrameData.resolvedTargetDeltas++;
            }
            getClosestProjectingParent() {
                if (!this.parent ||
                    hasScale(this.parent.latestValues) ||
                    has2DTranslate(this.parent.latestValues)) {
                    return undefined;
                }
                if (this.parent.isProjecting()) {
                    return this.parent;
                }
                else {
                    return this.parent.getClosestProjectingParent();
                }
            }
            isProjecting() {
                return Boolean((this.relativeTarget ||
                    this.targetDelta ||
                    this.options.layoutRoot) &&
                    this.layout);
            }
            calcProjection() {
                var _a;
                const lead = this.getLead();
                const isShared = Boolean(this.resumingFrom) || this !== lead;
                let canSkip = true;
                /**
                 * If this is a normal layout animation and neither this node nor its nearest projecting
                 * is dirty then we can't skip.
                 */
                if (this.isProjectionDirty || ((_a = this.parent) === null || _a === void 0 ? void 0 : _a.isProjectionDirty)) {
                    canSkip = false;
                }
                /**
                 * If this is a shared layout animation and this node's shared projection is dirty then
                 * we can't skip.
                 */
                if (isShared &&
                    (this.isSharedProjectionDirty || this.isTransformDirty)) {
                    canSkip = false;
                }
                /**
                 * If we have resolved the target this frame we must recalculate the
                 * projection to ensure it visually represents the internal calculations.
                 */
                if (this.resolvedRelativeTargetAt === frameData.timestamp) {
                    canSkip = false;
                }
                if (canSkip)
                    return;
                const { layout, layoutId } = this.options;
                /**
                 * If this section of the tree isn't animating we can
                 * delete our target sources for the following frame.
                 */
                this.isTreeAnimating = Boolean((this.parent && this.parent.isTreeAnimating) ||
                    this.currentAnimation ||
                    this.pendingAnimation);
                if (!this.isTreeAnimating) {
                    this.targetDelta = this.relativeTarget = undefined;
                }
                if (!this.layout || !(layout || layoutId))
                    return;
                /**
                 * Reset the corrected box with the latest values from box, as we're then going
                 * to perform mutative operations on it.
                 */
                copyBoxInto(this.layoutCorrected, this.layout.layoutBox);
                /**
                 * Record previous tree scales before updating.
                 */
                const prevTreeScaleX = this.treeScale.x;
                const prevTreeScaleY = this.treeScale.y;
                /**
                 * Apply all the parent deltas to this box to produce the corrected box. This
                 * is the layout box, as it will appear on screen as a result of the transforms of its parents.
                 */
                applyTreeDeltas(this.layoutCorrected, this.treeScale, this.path, isShared);
                /**
                 * If this layer needs to perform scale correction but doesn't have a target,
                 * use the layout as the target.
                 */
                if (lead.layout &&
                    !lead.target &&
                    (this.treeScale.x !== 1 || this.treeScale.y !== 1)) {
                    lead.target = lead.layout.layoutBox;
                    lead.targetWithTransforms = createBox();
                }
                const { target } = lead;
                if (!target) {
                    /**
                     * If we don't have a target to project into, but we were previously
                     * projecting, we want to remove the stored transform and schedule
                     * a render to ensure the elements reflect the removed transform.
                     */
                    if (this.projectionTransform) {
                        this.projectionDelta = createDelta();
                        this.projectionTransform = "none";
                        this.scheduleRender();
                    }
                    return;
                }
                if (!this.projectionDelta) {
                    this.projectionDelta = createDelta();
                    this.projectionDeltaWithTransform = createDelta();
                }
                const prevProjectionTransform = this.projectionTransform;
                /**
                 * Update the delta between the corrected box and the target box before user-set transforms were applied.
                 * This will allow us to calculate the corrected borderRadius and boxShadow to compensate
                 * for our layout reprojection, but still allow them to be scaled correctly by the user.
                 * It might be that to simplify this we may want to accept that user-set scale is also corrected
                 * and we wouldn't have to keep and calc both deltas, OR we could support a user setting
                 * to allow people to choose whether these styles are corrected based on just the
                 * layout reprojection or the final bounding box.
                 */
                calcBoxDelta(this.projectionDelta, this.layoutCorrected, target, this.latestValues);
                this.projectionTransform = buildProjectionTransform(this.projectionDelta, this.treeScale);
                if (this.projectionTransform !== prevProjectionTransform ||
                    this.treeScale.x !== prevTreeScaleX ||
                    this.treeScale.y !== prevTreeScaleY) {
                    this.hasProjected = true;
                    this.scheduleRender();
                    this.notifyListeners("projectionUpdate", target);
                }
                /**
                 * Increase debug counter for recalculated projections
                 */
                projectionFrameData.recalculatedProjection++;
            }
            hide() {
                this.isVisible = false;
                // TODO: Schedule render
            }
            show() {
                this.isVisible = true;
                // TODO: Schedule render
            }
            scheduleRender(notifyAll = true) {
                this.options.scheduleRender && this.options.scheduleRender();
                if (notifyAll) {
                    const stack = this.getStack();
                    stack && stack.scheduleRender();
                }
                if (this.resumingFrom && !this.resumingFrom.instance) {
                    this.resumingFrom = undefined;
                }
            }
            setAnimationOrigin(delta, hasOnlyRelativeTargetChanged = false) {
                const snapshot = this.snapshot;
                const snapshotLatestValues = snapshot
                    ? snapshot.latestValues
                    : {};
                const mixedValues = { ...this.latestValues };
                const targetDelta = createDelta();
                if (!this.relativeParent ||
                    !this.relativeParent.options.layoutRoot) {
                    this.relativeTarget = this.relativeTargetOrigin = undefined;
                }
                this.attemptToResolveRelativeTarget = !hasOnlyRelativeTargetChanged;
                const relativeLayout = createBox();
                const snapshotSource = snapshot ? snapshot.source : undefined;
                const layoutSource = this.layout ? this.layout.source : undefined;
                const isSharedLayoutAnimation = snapshotSource !== layoutSource;
                const stack = this.getStack();
                const isOnlyMember = !stack || stack.members.length <= 1;
                const shouldCrossfadeOpacity = Boolean(isSharedLayoutAnimation &&
                    !isOnlyMember &&
                    this.options.crossfade === true &&
                    !this.path.some(hasOpacityCrossfade));
                this.animationProgress = 0;
                let prevRelativeTarget;
                this.mixTargetDelta = (latest) => {
                    const progress = latest / 1000;
                    mixAxisDelta(targetDelta.x, delta.x, progress);
                    mixAxisDelta(targetDelta.y, delta.y, progress);
                    this.setTargetDelta(targetDelta);
                    if (this.relativeTarget &&
                        this.relativeTargetOrigin &&
                        this.layout &&
                        this.relativeParent &&
                        this.relativeParent.layout) {
                        calcRelativePosition(relativeLayout, this.layout.layoutBox, this.relativeParent.layout.layoutBox);
                        mixBox(this.relativeTarget, this.relativeTargetOrigin, relativeLayout, progress);
                        /**
                         * If this is an unchanged relative target we can consider the
                         * projection not dirty.
                         */
                        if (prevRelativeTarget &&
                            boxEquals(this.relativeTarget, prevRelativeTarget)) {
                            this.isProjectionDirty = false;
                        }
                        if (!prevRelativeTarget)
                            prevRelativeTarget = createBox();
                        copyBoxInto(prevRelativeTarget, this.relativeTarget);
                    }
                    if (isSharedLayoutAnimation) {
                        this.animationValues = mixedValues;
                        mixValues(mixedValues, snapshotLatestValues, this.latestValues, progress, shouldCrossfadeOpacity, isOnlyMember);
                    }
                    this.root.scheduleUpdateProjection();
                    this.scheduleRender();
                    this.animationProgress = progress;
                };
                this.mixTargetDelta(this.options.layoutRoot ? 1000 : 0);
            }
            startAnimation(options) {
                this.notifyListeners("animationStart");
                this.currentAnimation && this.currentAnimation.stop();
                if (this.resumingFrom && this.resumingFrom.currentAnimation) {
                    this.resumingFrom.currentAnimation.stop();
                }
                if (this.pendingAnimation) {
                    cancelFrame(this.pendingAnimation);
                    this.pendingAnimation = undefined;
                }
                /**
                 * Start the animation in the next frame to have a frame with progress 0,
                 * where the target is the same as when the animation started, so we can
                 * calculate the relative positions correctly for instant transitions.
                 */
                this.pendingAnimation = frame.update(() => {
                    globalProjectionState.hasAnimatedSinceResize = true;
                    this.currentAnimation = animateSingleValue(0, animationTarget, {
                        ...options,
                        onUpdate: (latest) => {
                            this.mixTargetDelta(latest);
                            options.onUpdate && options.onUpdate(latest);
                        },
                        onComplete: () => {
                            options.onComplete && options.onComplete();
                            this.completeAnimation();
                        },
                    });
                    if (this.resumingFrom) {
                        this.resumingFrom.currentAnimation = this.currentAnimation;
                    }
                    this.pendingAnimation = undefined;
                });
            }
            completeAnimation() {
                if (this.resumingFrom) {
                    this.resumingFrom.currentAnimation = undefined;
                    this.resumingFrom.preserveOpacity = undefined;
                }
                const stack = this.getStack();
                stack && stack.exitAnimationComplete();
                this.resumingFrom =
                    this.currentAnimation =
                        this.animationValues =
                            undefined;
                this.notifyListeners("animationComplete");
            }
            finishAnimation() {
                if (this.currentAnimation) {
                    this.mixTargetDelta && this.mixTargetDelta(animationTarget);
                    this.currentAnimation.stop();
                }
                this.completeAnimation();
            }
            applyTransformsToTarget() {
                const lead = this.getLead();
                let { targetWithTransforms, target, layout, latestValues } = lead;
                if (!targetWithTransforms || !target || !layout)
                    return;
                /**
                 * If we're only animating position, and this element isn't the lead element,
                 * then instead of projecting into the lead box we instead want to calculate
                 * a new target that aligns the two boxes but maintains the layout shape.
                 */
                if (this !== lead &&
                    this.layout &&
                    layout &&
                    shouldAnimatePositionOnly(this.options.animationType, this.layout.layoutBox, layout.layoutBox)) {
                    target = this.target || createBox();
                    const xLength = calcLength(this.layout.layoutBox.x);
                    target.x.min = lead.target.x.min;
                    target.x.max = target.x.min + xLength;
                    const yLength = calcLength(this.layout.layoutBox.y);
                    target.y.min = lead.target.y.min;
                    target.y.max = target.y.min + yLength;
                }
                copyBoxInto(targetWithTransforms, target);
                /**
                 * Apply the latest user-set transforms to the targetBox to produce the targetBoxFinal.
                 * This is the final box that we will then project into by calculating a transform delta and
                 * applying it to the corrected box.
                 */
                transformBox(targetWithTransforms, latestValues);
                /**
                 * Update the delta between the corrected box and the final target box, after
                 * user-set transforms are applied to it. This will be used by the renderer to
                 * create a transform style that will reproject the element from its layout layout
                 * into the desired bounding box.
                 */
                calcBoxDelta(this.projectionDeltaWithTransform, this.layoutCorrected, targetWithTransforms, latestValues);
            }
            registerSharedNode(layoutId, node) {
                if (!this.sharedNodes.has(layoutId)) {
                    this.sharedNodes.set(layoutId, new NodeStack());
                }
                const stack = this.sharedNodes.get(layoutId);
                stack.add(node);
                const config = node.options.initialPromotionConfig;
                node.promote({
                    transition: config ? config.transition : undefined,
                    preserveFollowOpacity: config && config.shouldPreserveFollowOpacity
                        ? config.shouldPreserveFollowOpacity(node)
                        : undefined,
                });
            }
            isLead() {
                const stack = this.getStack();
                return stack ? stack.lead === this : true;
            }
            getLead() {
                var _a;
                const { layoutId } = this.options;
                return layoutId ? ((_a = this.getStack()) === null || _a === void 0 ? void 0 : _a.lead) || this : this;
            }
            getPrevLead() {
                var _a;
                const { layoutId } = this.options;
                return layoutId ? (_a = this.getStack()) === null || _a === void 0 ? void 0 : _a.prevLead : undefined;
            }
            getStack() {
                const { layoutId } = this.options;
                if (layoutId)
                    return this.root.sharedNodes.get(layoutId);
            }
            promote({ needsReset, transition, preserveFollowOpacity, } = {}) {
                const stack = this.getStack();
                if (stack)
                    stack.promote(this, preserveFollowOpacity);
                if (needsReset) {
                    this.projectionDelta = undefined;
                    this.needsReset = true;
                }
                if (transition)
                    this.setOptions({ transition });
            }
            relegate() {
                const stack = this.getStack();
                if (stack) {
                    return stack.relegate(this);
                }
                else {
                    return false;
                }
            }
            resetSkewAndRotation() {
                const { visualElement } = this.options;
                if (!visualElement)
                    return;
                // If there's no detected skew or rotation values, we can early return without a forced render.
                let hasDistortingTransform = false;
                /**
                 * An unrolled check for rotation values. Most elements don't have any rotation and
                 * skipping the nested loop and new object creation is 50% faster.
                 */
                const { latestValues } = visualElement;
                if (latestValues.z ||
                    latestValues.rotate ||
                    latestValues.rotateX ||
                    latestValues.rotateY ||
                    latestValues.rotateZ ||
                    latestValues.skewX ||
                    latestValues.skewY) {
                    hasDistortingTransform = true;
                }
                // If there's no distorting values, we don't need to do any more.
                if (!hasDistortingTransform)
                    return;
                const resetValues = {};
                if (latestValues.z) {
                    resetDistortingTransform("z", visualElement, resetValues, this.animationValues);
                }
                // Check the skew and rotate value of all axes and reset to 0
                for (let i = 0; i < transformAxes.length; i++) {
                    resetDistortingTransform(`rotate${transformAxes[i]}`, visualElement, resetValues, this.animationValues);
                    resetDistortingTransform(`skew${transformAxes[i]}`, visualElement, resetValues, this.animationValues);
                }
                // Force a render of this element to apply the transform with all skews and rotations
                // set to 0.
                visualElement.render();
                // Put back all the values we reset
                for (const key in resetValues) {
                    visualElement.setStaticValue(key, resetValues[key]);
                    if (this.animationValues) {
                        this.animationValues[key] = resetValues[key];
                    }
                }
                // Schedule a render for the next frame. This ensures we won't visually
                // see the element with the reset rotate value applied.
                visualElement.scheduleRender();
            }
            getProjectionStyles(styleProp) {
                var _a, _b;
                if (!this.instance || this.isSVG)
                    return undefined;
                if (!this.isVisible) {
                    return hiddenVisibility;
                }
                const styles = {
                    visibility: "",
                };
                const transformTemplate = this.getTransformTemplate();
                if (this.needsReset) {
                    this.needsReset = false;
                    styles.opacity = "";
                    styles.pointerEvents =
                        resolveMotionValue(styleProp === null || styleProp === void 0 ? void 0 : styleProp.pointerEvents) || "";
                    styles.transform = transformTemplate
                        ? transformTemplate(this.latestValues, "")
                        : "none";
                    return styles;
                }
                const lead = this.getLead();
                if (!this.projectionDelta || !this.layout || !lead.target) {
                    const emptyStyles = {};
                    if (this.options.layoutId) {
                        emptyStyles.opacity =
                            this.latestValues.opacity !== undefined
                                ? this.latestValues.opacity
                                : 1;
                        emptyStyles.pointerEvents =
                            resolveMotionValue(styleProp === null || styleProp === void 0 ? void 0 : styleProp.pointerEvents) || "";
                    }
                    if (this.hasProjected && !hasTransform(this.latestValues)) {
                        emptyStyles.transform = transformTemplate
                            ? transformTemplate({}, "")
                            : "none";
                        this.hasProjected = false;
                    }
                    return emptyStyles;
                }
                const valuesToRender = lead.animationValues || lead.latestValues;
                this.applyTransformsToTarget();
                styles.transform = buildProjectionTransform(this.projectionDeltaWithTransform, this.treeScale, valuesToRender);
                if (transformTemplate) {
                    styles.transform = transformTemplate(valuesToRender, styles.transform);
                }
                const { x, y } = this.projectionDelta;
                styles.transformOrigin = `${x.origin * 100}% ${y.origin * 100}% 0`;
                if (lead.animationValues) {
                    /**
                     * If the lead component is animating, assign this either the entering/leaving
                     * opacity
                     */
                    styles.opacity =
                        lead === this
                            ? (_b = (_a = valuesToRender.opacity) !== null && _a !== void 0 ? _a : this.latestValues.opacity) !== null && _b !== void 0 ? _b : 1
                            : this.preserveOpacity
                                ? this.latestValues.opacity
                                : valuesToRender.opacityExit;
                }
                else {
                    /**
                     * Or we're not animating at all, set the lead component to its layout
                     * opacity and other components to hidden.
                     */
                    styles.opacity =
                        lead === this
                            ? valuesToRender.opacity !== undefined
                                ? valuesToRender.opacity
                                : ""
                            : valuesToRender.opacityExit !== undefined
                                ? valuesToRender.opacityExit
                                : 0;
                }
                /**
                 * Apply scale correction
                 */
                for (const key in scaleCorrectors) {
                    if (valuesToRender[key] === undefined)
                        continue;
                    const { correct, applyTo } = scaleCorrectors[key];
                    /**
                     * Only apply scale correction to the value if we have an
                     * active projection transform. Otherwise these values become
                     * vulnerable to distortion if the element changes size without
                     * a corresponding layout animation.
                     */
                    const corrected = styles.transform === "none"
                        ? valuesToRender[key]
                        : correct(valuesToRender[key], lead);
                    if (applyTo) {
                        const num = applyTo.length;
                        for (let i = 0; i < num; i++) {
                            styles[applyTo[i]] = corrected;
                        }
                    }
                    else {
                        styles[key] = corrected;
                    }
                }
                /**
                 * Disable pointer events on follow components. This is to ensure
                 * that if a follow component covers a lead component it doesn't block
                 * pointer events on the lead.
                 */
                if (this.options.layoutId) {
                    styles.pointerEvents =
                        lead === this
                            ? resolveMotionValue(styleProp === null || styleProp === void 0 ? void 0 : styleProp.pointerEvents) || ""
                            : "none";
                }
                return styles;
            }
            clearSnapshot() {
                this.resumeFrom = this.snapshot = undefined;
            }
            // Only run on root
            resetTree() {
                this.root.nodes.forEach((node) => { var _a; return (_a = node.currentAnimation) === null || _a === void 0 ? void 0 : _a.stop(); });
                this.root.nodes.forEach(clearMeasurements);
                this.root.sharedNodes.clear();
            }
        };
    }
    function updateLayout(node) {
        node.updateLayout();
    }
    function notifyLayoutUpdate(node) {
        var _a;
        const snapshot = ((_a = node.resumeFrom) === null || _a === void 0 ? void 0 : _a.snapshot) || node.snapshot;
        if (node.isLead() &&
            node.layout &&
            snapshot &&
            node.hasListeners("didUpdate")) {
            const { layoutBox: layout, measuredBox: measuredLayout } = node.layout;
            const { animationType } = node.options;
            const isShared = snapshot.source !== node.layout.source;
            // TODO Maybe we want to also resize the layout snapshot so we don't trigger
            // animations for instance if layout="size" and an element has only changed position
            if (animationType === "size") {
                eachAxis((axis) => {
                    const axisSnapshot = isShared
                        ? snapshot.measuredBox[axis]
                        : snapshot.layoutBox[axis];
                    const length = calcLength(axisSnapshot);
                    axisSnapshot.min = layout[axis].min;
                    axisSnapshot.max = axisSnapshot.min + length;
                });
            }
            else if (shouldAnimatePositionOnly(animationType, snapshot.layoutBox, layout)) {
                eachAxis((axis) => {
                    const axisSnapshot = isShared
                        ? snapshot.measuredBox[axis]
                        : snapshot.layoutBox[axis];
                    const length = calcLength(layout[axis]);
                    axisSnapshot.max = axisSnapshot.min + length;
                    /**
                     * Ensure relative target gets resized and rerendererd
                     */
                    if (node.relativeTarget && !node.currentAnimation) {
                        node.isProjectionDirty = true;
                        node.relativeTarget[axis].max =
                            node.relativeTarget[axis].min + length;
                    }
                });
            }
            const layoutDelta = createDelta();
            calcBoxDelta(layoutDelta, layout, snapshot.layoutBox);
            const visualDelta = createDelta();
            if (isShared) {
                calcBoxDelta(visualDelta, node.applyTransform(measuredLayout, true), snapshot.measuredBox);
            }
            else {
                calcBoxDelta(visualDelta, layout, snapshot.layoutBox);
            }
            const hasLayoutChanged = !isDeltaZero(layoutDelta);
            let hasRelativeTargetChanged = false;
            if (!node.resumeFrom) {
                const relativeParent = node.getClosestProjectingParent();
                /**
                 * If the relativeParent is itself resuming from a different element then
                 * the relative snapshot is not relavent
                 */
                if (relativeParent && !relativeParent.resumeFrom) {
                    const { snapshot: parentSnapshot, layout: parentLayout } = relativeParent;
                    if (parentSnapshot && parentLayout) {
                        const relativeSnapshot = createBox();
                        calcRelativePosition(relativeSnapshot, snapshot.layoutBox, parentSnapshot.layoutBox);
                        const relativeLayout = createBox();
                        calcRelativePosition(relativeLayout, layout, parentLayout.layoutBox);
                        if (!boxEqualsRounded(relativeSnapshot, relativeLayout)) {
                            hasRelativeTargetChanged = true;
                        }
                        if (relativeParent.options.layoutRoot) {
                            node.relativeTarget = relativeLayout;
                            node.relativeTargetOrigin = relativeSnapshot;
                            node.relativeParent = relativeParent;
                        }
                    }
                }
            }
            node.notifyListeners("didUpdate", {
                layout,
                snapshot,
                delta: visualDelta,
                layoutDelta,
                hasLayoutChanged,
                hasRelativeTargetChanged,
            });
        }
        else if (node.isLead()) {
            const { onExitComplete } = node.options;
            onExitComplete && onExitComplete();
        }
        /**
         * Clearing transition
         * TODO: Investigate why this transition is being passed in as {type: false } from Framer
         * and why we need it at all
         */
        node.options.transition = undefined;
    }
    function propagateDirtyNodes(node) {
        /**
         * Increase debug counter for nodes encountered this frame
         */
        projectionFrameData.totalNodes++;
        if (!node.parent)
            return;
        /**
         * If this node isn't projecting, propagate isProjectionDirty. It will have
         * no performance impact but it will allow the next child that *is* projecting
         * but *isn't* dirty to just check its parent to see if *any* ancestor needs
         * correcting.
         */
        if (!node.isProjecting()) {
            node.isProjectionDirty = node.parent.isProjectionDirty;
        }
        /**
         * Propagate isSharedProjectionDirty and isTransformDirty
         * throughout the whole tree. A future revision can take another look at
         * this but for safety we still recalcualte shared nodes.
         */
        node.isSharedProjectionDirty || (node.isSharedProjectionDirty = Boolean(node.isProjectionDirty ||
            node.parent.isProjectionDirty ||
            node.parent.isSharedProjectionDirty));
        node.isTransformDirty || (node.isTransformDirty = node.parent.isTransformDirty);
    }
    function cleanDirtyNodes(node) {
        node.isProjectionDirty =
            node.isSharedProjectionDirty =
                node.isTransformDirty =
                    false;
    }
    function clearSnapshot(node) {
        node.clearSnapshot();
    }
    function clearMeasurements(node) {
        node.clearMeasurements();
    }
    function clearIsLayoutDirty(node) {
        node.isLayoutDirty = false;
    }
    function resetTransformStyle(node) {
        const { visualElement } = node.options;
        if (visualElement && visualElement.getProps().onBeforeLayoutMeasure) {
            visualElement.notify("BeforeLayoutMeasure");
        }
        node.resetTransform();
    }
    function finishAnimation(node) {
        node.finishAnimation();
        node.targetDelta = node.relativeTarget = node.target = undefined;
        node.isProjectionDirty = true;
    }
    function resolveTargetDelta(node) {
        node.resolveTargetDelta();
    }
    function calcProjection(node) {
        node.calcProjection();
    }
    function resetSkewAndRotation(node) {
        node.resetSkewAndRotation();
    }
    function removeLeadSnapshots(stack) {
        stack.removeLeadSnapshot();
    }
    function mixAxisDelta(output, delta, p) {
        output.translate = mixNumber$1(delta.translate, 0, p);
        output.scale = mixNumber$1(delta.scale, 1, p);
        output.origin = delta.origin;
        output.originPoint = delta.originPoint;
    }
    function mixAxis(output, from, to, p) {
        output.min = mixNumber$1(from.min, to.min, p);
        output.max = mixNumber$1(from.max, to.max, p);
    }
    function mixBox(output, from, to, p) {
        mixAxis(output.x, from.x, to.x, p);
        mixAxis(output.y, from.y, to.y, p);
    }
    function hasOpacityCrossfade(node) {
        return (node.animationValues && node.animationValues.opacityExit !== undefined);
    }
    const defaultLayoutTransition = {
        duration: 0.45,
        ease: [0.4, 0, 0.1, 1],
    };
    const userAgentContains = (string) => typeof navigator !== "undefined" &&
        navigator.userAgent &&
        navigator.userAgent.toLowerCase().includes(string);
    /**
     * Measured bounding boxes must be rounded in Safari and
     * left untouched in Chrome, otherwise non-integer layouts within scaled-up elements
     * can appear to jump.
     */
    const roundPoint = userAgentContains("applewebkit/") && !userAgentContains("chrome/")
        ? Math.round
        : noop;
    function roundAxis(axis) {
        // Round to the nearest .5 pixels to support subpixel layouts
        axis.min = roundPoint(axis.min);
        axis.max = roundPoint(axis.max);
    }
    function roundBox(box) {
        roundAxis(box.x);
        roundAxis(box.y);
    }
    function shouldAnimatePositionOnly(animationType, snapshot, layout) {
        return (animationType === "position" ||
            (animationType === "preserve-aspect" &&
                !isNear(aspectRatio(snapshot), aspectRatio(layout), 0.2)));
    }

    function addDomEvent(target, eventName, handler, options = { passive: true }) {
        target.addEventListener(eventName, handler, options);
        return () => target.removeEventListener(eventName, handler);
    }

    const DocumentProjectionNode = createProjectionNode({
        attachResizeListener: (ref, notify) => addDomEvent(ref, "resize", notify),
        measureScroll: () => ({
            x: document.documentElement.scrollLeft || document.body.scrollLeft,
            y: document.documentElement.scrollTop || document.body.scrollTop,
        }),
        checkIsScrollRoot: () => true,
    });

    const rootProjectionNode = {
        current: undefined,
    };
    const HTMLProjectionNode = createProjectionNode({
        measureScroll: (instance) => ({
            x: instance.scrollLeft,
            y: instance.scrollTop,
        }),
        defaultParent: () => {
            if (!rootProjectionNode.current) {
                const documentNode = new DocumentProjectionNode({});
                documentNode.mount(window);
                documentNode.setOptions({ layoutScroll: true });
                rootProjectionNode.current = documentNode;
            }
            return rootProjectionNode.current;
        },
        resetTransform: (instance, value) => {
            instance.style.transform = value !== undefined ? value : "none";
        },
        checkIsScrollRoot: (instance) => Boolean(window.getComputedStyle(instance).position === "fixed"),
    });

    const notify = (node) => !node.isLayoutDirty && node.willUpdate(false);
    function nodeGroup() {
        const nodes = new Set();
        const subscriptions = new WeakMap();
        const dirtyAll = () => nodes.forEach(notify);
        return {
            add: (node) => {
                nodes.add(node);
                subscriptions.set(node, node.addEventListener("willUpdate", dirtyAll));
            },
            remove: (node) => {
                nodes.delete(node);
                const unsubscribe = subscriptions.get(node);
                if (unsubscribe) {
                    unsubscribe();
                    subscriptions.delete(node);
                }
                dirtyAll();
            },
            dirty: dirtyAll,
        };
    }

    function pixelsToPercent(pixels, axis) {
        if (axis.max === axis.min)
            return 0;
        return (pixels / (axis.max - axis.min)) * 100;
    }
    /**
     * We always correct borderRadius as a percentage rather than pixels to reduce paints.
     * For example, if you are projecting a box that is 100px wide with a 10px borderRadius
     * into a box that is 200px wide with a 20px borderRadius, that is actually a 10%
     * borderRadius in both states. If we animate between the two in pixels that will trigger
     * a paint each time. If we animate between the two in percentage we'll avoid a paint.
     */
    const correctBorderRadius = {
        correct: (latest, node) => {
            if (!node.target)
                return latest;
            /**
             * If latest is a string, if it's a percentage we can return immediately as it's
             * going to be stretched appropriately. Otherwise, if it's a pixel, convert it to a number.
             */
            if (typeof latest === "string") {
                if (px.test(latest)) {
                    latest = parseFloat(latest);
                }
                else {
                    return latest;
                }
            }
            /**
             * If latest is a number, it's a pixel value. We use the current viewportBox to calculate that
             * pixel value as a percentage of each axis
             */
            const x = pixelsToPercent(latest, node.target.x);
            const y = pixelsToPercent(latest, node.target.y);
            return `${x}% ${y}%`;
        },
    };

    const correctBoxShadow = {
        correct: (latest, { treeScale, projectionDelta }) => {
            const original = latest;
            const shadow = complex.parse(latest);
            // TODO: Doesn't support multiple shadows
            if (shadow.length > 5)
                return original;
            const template = complex.createTransformer(latest);
            const offset = typeof shadow[0] !== "number" ? 1 : 0;
            // Calculate the overall context scale
            const xScale = projectionDelta.x.scale * treeScale.x;
            const yScale = projectionDelta.y.scale * treeScale.y;
            shadow[0 + offset] /= xScale;
            shadow[1 + offset] /= yScale;
            /**
             * Ideally we'd correct x and y scales individually, but because blur and
             * spread apply to both we have to take a scale average and apply that instead.
             * We could potentially improve the outcome of this by incorporating the ratio between
             * the two scales.
             */
            const averageScale = mixNumber$1(xScale, yScale, 0.5);
            // Blur
            if (typeof shadow[2 + offset] === "number")
                shadow[2 + offset] /= averageScale;
            // Spread
            if (typeof shadow[3 + offset] === "number")
                shadow[3 + offset] /= averageScale;
            return template(shadow);
        },
    };

    exports.HTMLProjectionNode = HTMLProjectionNode;
    exports.HTMLVisualElement = HTMLVisualElement;
    exports.addScaleCorrector = addScaleCorrector;
    exports.animate = animateValue;
    exports.buildTransform = buildTransform;
    exports.calcBoxDelta = calcBoxDelta;
    exports.correctBorderRadius = correctBorderRadius;
    exports.correctBoxShadow = correctBoxShadow;
    exports.frame = frame;
    exports.frameData = frameData;
    exports.mix = mix;
    exports.nodeGroup = nodeGroup;

}));
