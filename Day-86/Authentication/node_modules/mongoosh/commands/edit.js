import _ from 'lodash';
import colors from 'chalk';
import diff from '../lib/diff.js';
import {spawnSync} from 'node:child_process';
import parseOptions from '../lib/parseOptions.js';
import {promisify} from 'util';
import {promises as fs} from 'node:fs';
import mongoose from 'mongoose';
import temp from 'temp';

import {inspect} from 'util';

export let description = 'Edit the output of a Mongoose query in your prefered editor, saving the result if changed';

/**
* Show an entity
* Additional options:
*                      -n / --dry-run            Don't actually do anytyhing just simulate
*                      --no-atom / --no-patch    Replace the entire document rather than trying to mini-diff the changes
*
* @param {...string} query The query to run to return result(s)
* @returns {Promise} A promise which resolves when the operation has completed
*/
export default function(...rawQuery) {
	const {args: query, options: settings} = parseOptions(rawQuery, {
		alias: {
			atom: 'patch',
			dryRun: 'n',
		},
		atom: false,
		dryRun: false,
	});

	const tempPath = temp.path({
		prefix: this.settings.mongoose.database + '-',
		suffix: '.json',
	});

	const fakeDate = new Date('1970-01-01T00:00:00.000Z'); // Fake date in the past to set the temp file date to so we can see if it was written
	let queryResponse;
	let model = query.join(' ').replace(/^db\.(.+?)\..+$/, '$1');
	if (!model) console.warn('Cannot determine query model from expression');

	return Promise.resolve()
		.then(()=> process.env.EDITOR || Promise.reject('The EDITOR environment variable is not set to provide an editor'))
		.then(()=> promisify(this.repl.eval)(query.join(' '), this.repl.context, 'COMMAND:EDIT'))
		.then(res =>
			res instanceof mongoose.Document // Single Mongoose document - .findOne / .findById etc.
			|| (Array.isArray(res) && res.every(r => r instanceof mongoose.Document)) // Array of documents - .find etc.
				? res
				: Promise.reject('Result is not a single or array of Mongoose.Document instances')
		)
		.then(res => queryResponse = res)
		.then(()=> this.settings.edit.stringify(queryResponse))
		.then(contents => fs.writeFile(tempPath, contents))
		.then(()=> fs.utimes(tempPath, fakeDate, fakeDate))
		.then(()=> console.log('Written to', tempPath))
		.then(()=> new Promise((resolve, reject) => {
			// NOTE: Annoyingly we have to use spawnSync here instead of the "proper" spawn method as we need REPL to STFU while the foreground editor does its thing
			//       At least this way REPL doesn't have a mini war with the foreground editor over STDOUT
			let response = spawnSync(process.env.EDITOR, [tempPath], {shell: true, stdio: 'inherit'});
			return response.status == 0 ? resolve() : reject(`Exited with code ${response.status}`);
		}))
		.then(()=> fs.stat(tempPath))
		.then(stats => stats.mtime > fakeDate ? true : Promise.reject('No changes made, aborting'))
		.then(()=> fs.readFile(tempPath, 'utf8'))
		.then(contents => this.settings.edit.parse(contents))
		.then(res => {
			// Worker function {{{
			/**
			* Accept the original Mongo response + the users mangled version and try to reconsile them based on the options given
			* @param {MongooseDocument} originalDoc The original document to update
			* @param {Object} changedDoc the decoded POJO returned back from the users editor
			* @returns {Promise} A promise which will conclude when the change has been made
			*/
			let updateDoc = (originalDoc, changedDoc) => {
				if (settings.atom) { // Atomic patching mode
					console.log('Saving document', colors.cyan(changedDoc._id));
					return settings.dryRun
						? console.log(colors.grey('No action to doc', colors.cyan(originalDoc._id), '- dry run mode'))
						: this.settings.context.db[model].updateOne({_id: originalDoc._id}, {$set: changedDoc});
				} else { // Patch mode
					let docDiff = diff(originalDoc.toObject(), changedDoc);
					Object.entries(docDiff.changes)
						.filter(([key, val]) => key !== '_id') // Always omit ID changes
						.forEach(([key, val]) => {
							console.log('- Set', colors.cyan(key), '=', colors.cyan(val));
							originalDoc.$set(key, val);
						})

					docDiff.dropped
						.filter(key => key !== '_id') // Always omit ID changes
						.forEach(key => {
							console.log('- Unset', colors.cyan(key));
							delete originalDoc[key];
						});

					return settings.dryRun
						? console.log(colors.grey('No action to doc', colors.cyan(originalDoc._id), '- dry run mode'))
						: originalDoc.save()
				}
			};
			// }}}
			if (Array.isArray(queryResponse)) { // Array of documents
				if (queryResponse.length != res.length) throw new Error(`Expected response back from editor to be an array size of ${queryResponse.length} but got an array of ${res.length} size`);
				console.log(settings.atom ? 'Saving' : 'Patching', queryResponse.length, 'documents');
				return Promise.all(queryResponse.map((doc, docIndex) =>
					updateDoc(queryResponse[docIndex], res[docIndex])
				));
			} else { // Single document (non-atomic mode)
				console.log(settings.atom ? 'Saving' : 'Patching', 'document', colors.cyan(res._id));
				return updateDoc(queryResponse, res);
			}
		})
		.then(()=> fs.unlink(tempPath))
};
