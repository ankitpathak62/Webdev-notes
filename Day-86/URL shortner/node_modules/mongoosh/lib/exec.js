import vm from 'node:vm';


/**
* Execute a string as if it were a command within a REPL, returning the evaluated result
* @param {string} command The command to exec
*
* @param {Object} [options] Additional options to use when evaluating
* @param {Object} [options.mongooshContext] Global Mongoosh context to execute everything within by default
* @param {Object} [options.context] Optional REPL context to run the command within
* @param {boolean} [options.evalCommands=false] Allow internal command evaluation, disabled by default as commands tend to conflict with their execution
* @param {Object} [options.commands=mongooshContext.settings.eval.commands] Object lookup of defined commands
* @param {string} [options.contextFilename] Optional filename to use when evaluating commands, set by the upstream REPL context if any
*
* @returns {Promise<*>} A promise which will resolve to the eventual result context
*/
export function exec(command, options) {
	// Settings processing {{{
	let settings = {
		mongooshContext: undefined,
		context: undefined,
		evalCommands: false,
		commands: undefined,
		contextFilename: undefined,
		evalThenable: true,
		...options,
	};
	if (settings.commands === undefined) settings.commands = options.mongooshContext?.settings.eval.commands;
	if (!settings.context) settings.context = {}; // Create empty context if none given
	// }}}

	// 1. Try defined command {{{
	let cmdBits = command.split(/\s+/);
	cmdBits[0] = cmdBits[0].toLowerCase(); // Lower case command operand automatically to fix casing weirdness
	if (settings.evalCommands && settings.commands[cmdBits[0]]) { // Command exists
		return Promise.resolve(settings.commands[cmdBits[0]].apply(settings.mongooshContext, cmdBits.slice(1)))
	}
	// }}}

	// 2. Try to run in context, returning a result {{{
	let result = vm.runInContext(command, settings.context, settings.filename);
	return Promise.resolve(result);
	// }}}

	// X. Give up {{{
	return Promise.reject('Command error');
	// }}}
};



/**
* REPL callback format of the exec function
* @see exec()
* @param {string} command The command to run
* @param {Object} options Additional options to use when evaluating
* @param {function} callback The callback to call with the output context or an error
*/
export function execCallback(command, options, callback) {
	exec(command, options)
		.then(result => callback(null, result))
		.catch(callback)
};
