import _ from 'lodash';
import ListIt from 'list-it';
import mongoose from 'mongoose';
import readable from '@momsfriendlydevco/readable';
export let description = 'Show an entity such as collections';

/**
* Show an entity
* @param {string} what The entity to show. ENUM: 'collections'
* @returns {Promise} A promise which resolves when the operation has completed
*/
export default function(what) {
	switch(what.toLowerCase()) {
		case 'collections':
			return Promise.resolve()
				.then(()=> Promise.all(
					Object.keys(this.settings.context.db).map(colId =>
						mongoose.models[colId].estimatedDocumentCount()
							.then(estDocCount => ({
								collection: colId,
								estDocCount,
							}))
					)
				))
				.then(cols => _.sortBy(cols, 'collection'))
				.then(cols => console.log(
					(new ListIt(this.settings.tables))
						.d(cols)
						.toString()
				))
			break;
		case 'databases':
			return Promise.resolve()
				.then(()=> new Promise((resolve, reject) =>
					new mongoose.mongo.Admin(mongoose.connection.db)
						.listDatabases(function(err, res) {
							err ? reject(err) : resolve(res)
						})
				))
				.then(res => console.log(
					(new ListIt(this.settings.tables))
						.d(res.databases.map(db => ({
							name: db.name,
							size: readable.fileSize(db.sizeOnDisk),
						})))
						.toString()
				))
			break;
		default:
			console.warn('Unknown item to show, select one of: collections');
	}
};
