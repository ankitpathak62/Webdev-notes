import _ from 'lodash';

/**
* Attempt to extract Unix-like options from an array of strings
* This augments commands by allowing `--OPT` or `-O` style options anywhere in the command string
* Only `--long-opt` or `-o` are supported with `--no-X` negating the option
*
* @param {array<string>} args The argument array to parse
* @param {Object} [defaults] Optional object of default values to merge with options, can contain an optional `alias` key to map multiple values into one
* @param {Object} [defaulta.alias] Object mapping to transform multiple values into one, each key can be a single string alias or array of strings
*
* @returns {Object} An object composed of multiple properties
* @property {array<string>} args Remaining non-option arguments
* @property {Object} options Parsed options
*
* @example Parse command options for the `edit` command
* // Export `query` / `settings`
* const {args: query, settings: options} = parseOptions(rawQuery, {
*   atom: true, // Atom is true by default
*   alias: {
*     atom: ['patch'], // Alternate names for 'atom' so --no-a / --no-patch also works
*   },
* });
*/
export default function(args, defaults) {
	// Setup initial output
	var output = {args: [], options: {}};

	// Process arguments, filter out arg-like into output.options
	output.args = args
		.filter(a => {
			let match;
			if ( // Arg with value e.g. --key=value / -k=value
				(match = /^--(?<arg>.+?)\s*=\s*(?<value>.+)$/.exec(a)?.groups)
				|| (match = /^-(?<arg>.+?)\s*=\s*(?<value>.+)$/.exec(a)?.groups)
			) {
				output.options[_.camelCase(match.arg)] = match.value;
			} else if ( // Negated arg with value e.g. --no-key
				match = /^--no-(?<arg>.+)$/.exec(a)?.groups
			) {
				output.options[_.camelCase(match.arg)] = false;
			} else if ( // Arg as flag e.g. --key / -k
				(match = /^--(?<arg>.+)$/.exec(a)?.groups)
				|| (match = /^-(?<arg>.+)$/.exec(a)?.groups)
			) {
				output.options[_.camelCase(match.arg)] = true;
			} else {
				return true;
			}
		})

	// Apply defaults
	_.defaults(output.options, _.omit(defaults, 'alias'));


	// Rewrite aliases
	if (defaults?.alias) Object.entries(defaults.alias)
		.forEach(([key, aliases]) =>
			_.castArray(aliases).forEach(alias => {
				if (alias in output.options) {
					output.options[key] = output.options[alias];
					delete output.options[alias];
				}
			})
		)

	return output;
};
