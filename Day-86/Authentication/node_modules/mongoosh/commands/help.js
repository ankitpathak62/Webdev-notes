import _ from 'lodash';
import colors from 'chalk';

export let description = 'Show help on availble commands';

export default function() {
	var longestCommand = Object.keys(this.settings.eval.commands)
		.reduce((longest, cmd) => !longest || cmd.length > longest ? cmd.length : longest, 0)

	Object.keys(this.settings.eval.commands)
		.sort()
		.forEach(cmd => console.log(
			colors.blue.bold(cmd.padEnd(longestCommand+3)),
			(this.settings.eval.commands[cmd].description || '')
		))
};
