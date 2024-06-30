import chalk from 'chalk';

export default function(text) {
	return (text || 'reset')
		.split(/\s+/)
		.reduce((instance, term) =>
			instance[term] ? instance[term] : instance
		, chalk)
};
