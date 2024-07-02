var babel = require('gulp-babel');
var gulp = require('gulp');
var rename = require('gulp-rename');
var replace = require('gulp-replace');
var uglify = require('gulp-uglify');

gulp.task('default', ['build']);

gulp.task('build', ()=>
	gulp.src('./index.js')
		.pipe(rename('readable.js'))
		.pipe(replace('var readable = module.exports = {}', 'window.readable = {}'))
		.pipe(babel({
			presets: ['@babel/env'],
		}))
		.pipe(gulp.dest('./dist'))
		.pipe(uglify())
		.pipe(rename('readable.min.js'))
		.pipe(gulp.dest('./dist'))
);
