import mongoose from 'mongoose';

export default function() {
	return mongoose.disconnect() // Disconnect existing if we have any
		.then(()=> mongoose.connect(
			this.settings.mongoose.uri
				? this.settings.mongoose.uri
				: `mongodb://${this.settings.mongoose.host}/${this.settings.mongoose.database || 'test'}`
		, {
			useNewUrlParser: true,
			useUnifiedTopology: true,
		}))
		.then(()=> {
			this.settings.context.db = {};
			mongoose.connection.db.listCollections().toArray()
				.then(collections => collections.forEach(collection =>
					this.settings.context.db[collection.name] = mongoose.model( // Init with blank schema
						collection.name,
						new mongoose.Schema({}, {strict: false}), // Need to negate strict so we can actually write to documents
					)
				))
		})
};
