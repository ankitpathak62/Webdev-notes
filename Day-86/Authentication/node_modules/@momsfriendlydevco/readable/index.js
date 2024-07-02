var readable = module.exports = {};

readable.defaults = {
	fileSize: {
		decimals:             1,
		decimalsAbsolute:     true,
		units: {
			bytes:        true,
			killobytes:   true,
			megabytes:    true,
			gigabytes:    true,
			terabytes:    true,
			petabytes:    false,
			exabytes:     false,
			zettabytes:   false,
			yottabytes:   false,
		},
		formatters: {
			fallback:      '',
			bytes:        v => `${v}b`,
			killobytes:   v => `${v}kb`,
			megabytes:    v => `${v}mb`,
			gigabytes:    v => `${v}gb`,
			terabytes:    v => `${v}tb`,
			petabytes:    v => `${v}pb`,
			exabytes:     v => `${v}eb`,
			zettabytes:   v => `${v}zb`,
			yottabytes:   v => `${v}yb`,
		},
		values: {
			bytes:        1,
			killobytes:   1024,
			megabytes:    Math.pow(1024, 2),
			gigabytes:    Math.pow(1024, 3),
			terabytes:    Math.pow(1024, 4),
			petabytes:    Math.pow(1024, 5),
			exabytes:     Math.pow(1024, 6),
			zettabytes:   Math.pow(1024, 7),
			yottabytes:   Math.pow(1024, 8),
		},
	},
	sizeOf: {
		circular: false,
		stringDeepScan: false,
		stringOverhead: 2,
		fallback: v => JSON.stringify(String(v)).length,
	},
	time: {
		units: {
			milliseconds: false,
			seconds:      true,
			minutes:      true,
			hours:        true,
			days:         true,
			weeks:        false,
			months:       false,
			years:        true,
		},
		formatters: {
			fallback:     'Just now',
			input:        v => v.constructor.name == 'Date' ? Date.now() - v.getTime()
			                  : v.constructor.name == 'Moment' ? Date.now() - v.valueOf()
					  : Date.now() - v,
			combiner:     bits => bits.join('').replace(/\s+$/g, ''),
			milliseconds: v => `${v}ms`,
			seconds:      v => `${v}s`,
			minutes:      v => `${v}m`,
			hours:        v => `${v}h`,
			days:         v => `${v}D `,
			weeks:        v => `${v}W `,
			months:       v => `${v}M `,
			years:        v => `${v}Y `,
		},
		values: {
			milliseconds: 1,
			seconds:      1000,
			minutes:      1000 * 60,
			hours:        1000 * 60 * 60,
			days:         1000 * 60 * 60 * 24,
			weeks:        1000 * 60 * 60 * 24 * 7,
			months:       1000 * 60 * 60 * 24 * 30,
			years:        1000 * 60 * 60 * 24 * 356,
		},
	},
};


/**
* Return a human readable relative time distance
* e.g. '1h2s'
*
* @param {number} diff The difference in milliseconds
*
* @param {Object} [options] Additional options
* @param {Object} [options.units] A list of units to output, each is named in the plural with a boolean indicating if it should be reported e.g. `{units: {years: true}}` to enable years as a usable unit
* @param {Object} [options.formatters] A list of formatters for each named unit, each should be a function taking a single value. e.g. `{formatters: {days: v => `${v} days`}}`
* @param {function|string} [options.formatters.fallback="Just now"] The fallback formatter to use, if it is a string its used as is, if it is a function it is called with the value
* @param {function} [options.formatters.input] Input mangler, by defaults this converts dates and Moment objects to a millisecond offset from now
* @param {function} [options.formatters.combiner] function used to combine all compiled units, by default this joins everything into a string with no spacing and truncates any training spaces
* @param {Object} [options.values] A list of unit values to work with if the unit is enabled, each is the plural key of the measure with the number of milliseconds within the unit as the key
*
* @example
* relativeTime(new Date(Date.now() - 50)) //= "Just now"
* relativeTime(new Date(Date.now() - 50), {units: {milliseconds: true}}) //= "50ms"
* relativeTime(new Date(Date.now() - 5000)) //= "5s"
* relativeTime(new Date(Date.now() - 60000)) //= "1m"
* relativeTime(new Date(Date.now() - 65000)) //= "1m5s"
*/
readable.relativeTime = (diff, options) => {
	var settings = readable._defaultsDeep(options, readable.defaults.time);
	diff = settings.formatters.input(diff);

	var result = Object.keys(settings.units)
		.filter(unit => settings.values[unit] && settings.units[unit])
		.map(unit => [unit, settings.values[unit]])
		.sort((a, b) => a[1] == b[1] ? 0 : a[1] > b[1] ? -1 : 1) // Sort descending
		.map(unit => unit[0])
		.reduce((ongoing, unit) => {
			var v = Math.floor(ongoing.value / settings.values[unit]);
			if (v > 0) {
				ongoing.bits.push(settings.formatters[unit](v));
				ongoing.value = ongoing.value - (v * settings.values[unit]);
			}
			return ongoing;
		}, {value: diff, bits: []})

	return result.bits.length ? settings.formatters.combiner(result.bits)
		: typeof settings.formatters.fallback == 'string' ? settings.formatters.fallback
		: settings.formatters.fallback(result.bits.value)
};


/**
* Return a human readable file size
* e.g. '1.5kb'
*
* @param {number} bytes The bytes to format
*
* @param {Object} [options] Additional options
* @param {number} [options.decimals=1] Decimal places to format the number into
* @param {boolean} [options.decimalsAbsolute=true] If true the decimals will be clipped entirely if the number is exactly correct (e.g. if the input is `1024` the output is `1kb` not `1.0kb`)
* @param {Object} [options.units] A list of units to output, each is named in the plural with a boolean indicating if it should be reported e.g. `{units: {kilobytes: true}}` to enable kilobytes as a usable unit
* @param {Object} [options.formatters] A list of formatters for each named unit, each should be a function taking a single value. e.g. `{formatters: {terabytes: v => `${v} terabytes`}}`
* @param {function|string} [options.formatters.fallback=""] The fallback formatter to use, if it is a string its used as is, if it is a function it is called with the input value
* @param {Object} [options.values] A list of unit values to work with if the unit is enabled, each is the plural key of the measure with the number of milliseconds within the unit as the key
*
* @example
* fileSize(1024) //= "1kb"
* fileSize(1536) //= "1.5kb"
* fileSize(1048576) //= "1mb"
* fileSize(1073741824) //= "1tb"
* fileSize(1288490188) //= "1.2tb"
*/
readable.fileSize = (bytes, options) => {
	var settings = readable._defaultsDeep(options, readable.defaults.fileSize);

	var unit = Object.keys(settings.units)
		.filter(unit => settings.values[unit] && settings.units[unit])
		.map(unit => [unit, settings.values[unit]])
		.sort((a, b) => a[1] == b[1] ? 0 : a[1] > b[1] ? -1 : 1) // Sort descending
		.map(unit => unit[0])
		.find(unit => bytes >= settings.values[unit]);

	return unit && settings.decimalsAbsolute && ((bytes % settings.values[unit]) == 0) ? settings.formatters[unit]((bytes / settings.values[unit]).toFixed(0)) // Absolute value
		: unit ? settings.formatters[unit]((bytes / settings.values[unit]).toFixed(settings.decimals)) // Imperfect value with decimal rounding
		: typeof settings.formatters.fallback == 'string' ? settings.formatters.fallback
		: settings.formatters.fallback(unit);
};


/**
* Calculate the (approximate in some cases) size of a variable as quickly as possible
* The following assumptions are made:
* - Whitespace for stringified data is ignored
* - Strings are 1 char to 1 byte (unless options.stringDeepScan is specified)
* - Numbers are 64 bit / 2 bytes
* - Circular references are resolved to a given byte size (see options.circular)
*
* @param {*} data The varaiable to calculate the size of
* @param {Object} [options] Additional options to use
* @param {boolean|number} [options.circular=false] Calculate circular references as this byte value, if boolean false, circular references are not counted - this can lead to recursion
* @param {boolean} [options.stringDeepScan=false] Calculate additional UTf-8 storage space
* @param {boolean} [options.stringOverhead=2] Additional bytes for string storage, set to `2` to store enclosing speachmarks
* @param {function} [options.fallback] Function to use to calculate all non-handled types (defaults to JSON.stringify length)
* @returns {number} The (rough) size of the object in bytes
*/
readable.sizeOf = (data, options) => {
	var settings = readable._defaultsDeep(options, readable.defaults.sizeOf);

	var size = 0;
	var seen = new WeakSet();

	var traverse = node => {
		if (settings.circular !== false && typeof node == 'object' && seen.has(node)) { // Circular object
			return size += settings.circular;
		} else if (settings.circular !== false && typeof node == 'object') {
			seen.add(node);
		}

		if (node === null) {
			size += 4;
		} else if (node === undefined) {
			size += 9;
		} else if (typeof node == 'object' && node.constructor && node.constructor.name && (node.constructor.name == 'Object' || node.constructor.name == 'Array')) { // Objects
			var isArray = Array.isArray(node);
			size += 2; // Opening and closing braces
			Object.keys(node).forEach(k => {
				if (!isArray) traverse(k); // Length of each key
				size += 2; // Colon + comma
				traverse(node[k]); // Traverse into data
			});
		} else if (typeof node == 'string' && node.constructor.name == 'String') {
			var rawStr = String(node);
			size +=
				rawStr.length
				+ (settings.stringDeepScan ? rawStr.match(/[^\x00-\xff]/ig).length : 0) // Compute UTF8 characters as an array and take that as the extra fluff to add to the string length - see https://stackoverflow.com/a/13118693/1295040
				+ settings.stringOverhead;
		} else if (Number.isNaN(node)) {
			size += 3;
		} else if (typeof node == 'number') {
			size += 4; // 64 bit =~ 4 bytes
		} else {
			size += settings.fallback(node);
		}
	};

	traverse(data);
	return size;
};


/**
* Native implementation of the lodash _.defaultsDeep() function
* This is really only here so we don't need Lodash as a dependency
* @param {Object|null|undefined} target The object which will be mutated with the defaults, if it is not already an object it is mutated into one
* @param {Object} defaults The object to deep merge into the target
*/
readable._defaultsDeep = (target, defaults) => {
	if (typeof target != 'object') target = {};

	for (var k in defaults) {
		if (typeof target[k] == 'undefined') target[k] = defaults[k]; // No value - inherit from defaults
		if (typeof defaults[k] == 'object') readable._defaultsDeep(target[k], defaults[k]);
	}

	return target;
};
