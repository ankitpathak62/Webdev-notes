import colors from 'chalk';
import mongooseConnect from '../lib/mongooseConnect.js';

export let description = 'Switch to another database on this host';

/**
* Switch to another database on this host
* @param {string} db The database to switch to
* @returns {Promise} A promise which resolves when the operation has completed
*/
export default function(db) {
	if (!db) return console.warn('Must specify the database name to switch to');
	this.settings.mongoose.database = db;
	return mongooseConnect.call(this)
		.then(()=> console.log('Switched to', colors.cyan(db), 'database'));
};
