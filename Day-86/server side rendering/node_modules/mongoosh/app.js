#!/usr/bin/node
import _ from 'lodash';
import colors from 'chalk';
import {promises as fs} from 'node:fs';
import getColor from './lib/getColor.js';
import {globby} from 'globby';
import {execCallback, exec} from './lib/exec.js';
import {inspect} from 'node:util';
import joi from 'joi';
import os from 'node:os';
import mongoose from 'mongoose';
import mongooseConnect from './lib/mongooseConnect.js';
import path from 'path';
import program from 'commander';
import repl from 'node:repl';
import ttys from 'ttys';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const packageMeta = JSON.parse(await fs.readFile(`${__dirname}/package.json`));

program
	.version(packageMeta.version)
	.name('mongoosh')
	.usage('[database|URI]')
	.option('-e, --eval <expr...>', 'Execute an expression and quit. Can be specified multiple times', (v, t) => t.concat([v]), [])
	.option('-v, --verbose', 'Be verbose. Specify multiple times for increasing verbosity', (t, v) => t + 1, 0)
	.option('--no-color', 'Force disable color')
	.option('--no-eval-echo', 'Dont output eval command being executed into STDERR')
	.option('--no-eval-formatter', 'Dont switch to the eval formatter eval mode - use regular terminal formatter')
	.parse(process.argv);

const programOpts = program.opts();

// Populate settings structure {{{
const settings = {
	context: {
		mongoose,
		OID: mongoose.Types.ObjectId,
		ObjectID: mongoose.Types.ObjectId,
	},
	colors: {
		evalEchoColorPrefix: 'bgWhite black',
		evalEchoColorCommand: 'blue',
		prompt: 'bold blue',
	},
	edit: {
		stringify(obj) {
			return JSON.stringify(obj, null, '\t');
		},
		parse(text) {
			return JSON.parse(text);
		},
	},
	eval: {
		commands: {},
		echoPrefix: 'EVAL',
		formatter: 'jsonTabs',
	},
	formatters: {
		inspect: doc => inspect(doc, settings.inspect),
		json: doc => JSON.stringify(doc),
		jsonTabs: doc => JSON.stringify(doc, null, '\t'),
		jsonSpaces: doc => JSON.stringify(doc, null, '\s\s'),
	},
	inspect: {
		depth: 2,
		colors: true,
	},
	mongoose: {
		autoConnect: true,
		database: '',
		host: 'localhost',
		uri: '',
	},
	paths: {
		commands: [
			`${__dirname}/commands/*.js`,
		],
	},
	prompt: {
		history: '.mongoosh.history',
		ignoreUndefined: true,
		preview: true,
		text: '> ',
		formatter: 'inspect',
	},
	tables: {
		headerBold: true,
		headerUnderline: true,
	},
};
// }}}
// MongooSh context (used with commands to access internals) {{{
const mongooshContext = {
	repl: undefined,
	settings,
};
// }}}

// Main promise
Promise.resolve()
	// Load settings {{{
	.then(()=> Promise.all([
		fs.readFile(path.join(os.homedir(), '.mongoosh.json'))
			.then(contents => JSON.parse(contents))
			.then(parsed => _.merge(settings, parsed))
			.then(()=> true)
			.catch(()=> false), // Give up if trying to read a non-existant file

		fs.access(path.join(os.homedir(), '.mongoosh.js'))
			.then(()=> import(path.join(os.homedir(), '.mongoosh.js')))
			.then(parsed => _.isFunction(parsed.default) ? parsed.default.call(mongooshContext) : _.merge(settings, parsed.default))
			.then(()=> true),

		fs.access(path.join(os.homedir(), '.mongoosh.mjs'))
			.then(()=> import(path.join(os.homedir(), '.mongoosh.mjs')))
			.then(parsed => _.isFunction(parsed.default) ? parsed.default.call(mongooshContext) : _.merge(settings, parsed.default))
			.then(()=> true)
			.catch(()=> false),
	]))
	.then(configsLoaded =>
		configsLoaded.some(Boolean) // We loaded some config?
		&& joi.object({ // Check it validates
			eval: {
				commands: joi.object().required(),
			},
			context: joi.object().required(),
			inspect: {
				depth: joi.number(),
				colors: joi.boolean(),
			},
			mongoose: {
				autoConnect: joi.boolean(),
				database: joi.string(),
				host: joi.string().required(),
			},
			prompt: {
				text: joi.string(),
				color: joi.string(),
				ignoreUndefined: joi.boolean(),
				preview: joi.boolean(),
				history: joi.valid(
					false,
					joi.string(),
				),
			},
		}).validate(settings)
	)
	// }}}
	// Load commands {{{
	.then(()=> globby(settings.paths.commands))
	.then(commandPaths => Promise.all(commandPaths.map(commandPath =>
		import(commandPath)
			.then(command => {
				var {name} = path.parse(commandPath);
				if (!_.isFunction(command.default)) throw new Error(`Command import from "${commandPath}" did not export a default function`);
				settings.eval.commands[name] = command.default;

				if (command.description) settings.eval.commands[name].description =  command.description; // Glue description onto function if we have one
			})
			.catch(e => {
				console.warn(colors.red('ERROR'), 'parsing command', colors.cyan(commandPath), e);
			})
	)))
	// }}}
	// Parse database connection string {{{
	.then(()=> {
		var database = program.args.shift();
		if (/^mongodb\+srv:\/\//.test(database)) { // Parse as mongodb+srv://${ATLAS_USER}:${ATLAS_PASS}@${MONGOHOST}/${DATABASE}
			settings.mongoose.database = settings.mongoose.host = '';
			settings.mongoose.uri = database;
		} else { // Assume raw database name
			settings.mongoose.uri = '';
			settings.mongoose.database = database;
			if (!settings.mongoose.database) console.log(colors.gray('No database selected: `show databases` or `use $database` to switch'));
		}
	})
	// }}}
	// Connect to Mongoose {{{
	.then(()=> {
		if (!settings.mongoose.autoConnect) return;

		return mongooseConnect.call(mongooshContext);
	})
	// }}}
	// Repl loop {{{
	.then(()=> new Promise((resolve, reject) => {
		const replInstance = mongooshContext.repl = repl
			.start({
				// BUGFIX: If we are reading from a pipe we need TTys to provide us a user terminal rather than trust process.std{in,out} {{{
				input: ttys.stdin,
				output: ttys.stdout,
				terminal: true,
				// }}}
				useGlobal: false,
				useColors: program.color,
				prompt: programOpts.eval.length > 0 ? '' : getColor(settings.colors.prompt)(settings.prompt.text),
				ignoreUndefined: settings.prompt.ignoreUndefined,
				preview: settings.prompt.preview,
				writer: doc => settings.formatters[settings.prompt.formatter](doc),
				eval: (cmd, context, filename, finish) => { // {{{
					execCallback(cmd, {
						mongooshContext,
						context,
						evalCommands: true,
						filename,
					}, finish);
				}, // }}}
			})
			.on('exit', resolve)

		// Assign context
		Object.assign(replInstance.context, settings.context);
		replInstance.context.settings = settings;

		// Setup history file
		if (settings.prompt.history)
			replInstance.setupHistory(path.join(os.homedir(), settings.prompt.history), ()=> {});


		// Process Evals (if any) {{{
		if (programOpts.eval.length > 0) {
			if (programOpts.evalJson) settings.prompt.formatter = settings.eval.formatter;

			let evalOffset = 0;
			const execQueue = [...programOpts.eval];
			const execEval = ()=> {
				if (!execQueue.length) return resolve();
				var evalCommand = execQueue.shift();
				if (programOpts.evalEcho) console.warn(
					getColor(settings.colors.evalEchoColorPrefix)(settings.eval.echoPrefix),
					getColor(settings.colors.evalEchoColorCommand)(evalCommand)
				);

				replInstance.eval(evalCommand, replInstance.context, `EVAL:${evalOffset++}`, (err, res) => {
					if (err) return reject(err);
					Promise.resolve(replInstance.writer(res))
						.then(content => content !== undefined && !settings.prompt.ignoreUndefined ? console.log(content) : false)
						.then(()=> execEval())
				});
			};
			setTimeout(execEval, 100);
		}
		// }}}
	}))
	/// }}}
	// End {{{
	.then(()=> process.exit(0))
	.catch(e => {
		console.log(colors.red('ERROR'), e);
		process.exit(1);
	})
	// }}}
