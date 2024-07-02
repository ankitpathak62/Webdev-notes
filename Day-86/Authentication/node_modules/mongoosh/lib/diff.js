import _ from 'lodash';

/**
* Return only the changes between the source document `a` and destination document `b`
* This function is designed to find the "minimal patch" required to transform A to B
* It works by examining each key of B against A and returning them in a patch object only if they differ
* It is NOT intended as a full DIFF comparitor
*
* @param {Object} a The source document to examine
* @param {Object} b The destination document to examine
*
* @returns {Object} A patch object of minimal changes to transform A to B
* @property {Object} changes The change patch between A and B
* @property {array} dropped An array of keys that should be removed to perform the change
*/
export default function(a, b) {
	return {
		changes: Object.entries(b)
			.filter(([key, value]) => !_.isEqual(a[key], b[key]))
			.reduce((t, v) => { // Transform back to an object of keys
				t[v[0]] = v[1];
				return t;
			}, {}),

		dropped: Object.keys(a)
			.filter(k => !(k in b)),
	};
};
