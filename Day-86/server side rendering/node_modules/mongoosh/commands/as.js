import {promisify} from 'util';

export let description = 'Execute a command and show the output using a specified formater';

/**
* Run a command and format its return value via a specified formatter
* @param {...string} query The query to run
*/
export default function(formatter, ...query) {
	var oldFormatter;

	return Promise.resolve()
		.then(()=> { // Sanity checks
			if (!formatter) throw new Error('No formatter or query specified. Run: `as <formatter> <query>`');
			if (!this.settings.formatters[formatter]) throw new Error(`Unknown formatter "${formatter}"`);
			if (!query) throw new Error('No query specified. Run: `as <formatter> <query>`');
		})
		.then(()=> promisify(this.repl.eval)(query.join(' '), this.repl.context, 'COMMAND:AS'))
		.then(result => this.settings.formatters[formatter](result))
};
