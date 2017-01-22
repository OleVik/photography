'use strict';

var fs = require('fs'),
	url = require("url"),
	path = require("path"),
	del = require('del'),
	request = require('request'),
	exec = require('child_process').exec,
	nconf = require('nconf'),
	gulp = require('gulp'),
	rename = require('gulp-rename'),
	replace = require('gulp-replace'),
	concat = require('gulp-concat'),
	postcss = require('gulp-postcss'),
	purifycss = require('gulp-purifycss'),
	autoprefixer = require('autoprefixer'),
	cssnano = require('gulp-cssnano'),
	uglify = require('gulp-uglify'),
	data = require('gulp-data'),
	nunjucksRender = require('gulp-nunjucks-render'),
	inject = require('gulp-inject'),
	htmlmin = require('gulp-htmlmin');

// Environment-variables
nconf.argv().env();
nconf.file({ file: '.env.json' });

// Nunjucks environment-variable and custom filters
var manageEnvironment = function(environment) {
	environment.addGlobal('local_images', nconf.get('LOCAL_IMAGES'));
	environment.addFilter('split', function(str, seperator) {
		return str.split(seperator);
	});
	environment.addFilter('prepend', function(str, data) {
		return data + str;
	});
}

// Download Flickr-data to ./app/data.json
gulp.task('data', function() {
	try {
		var Flickr = require("flickrapi"),
			flickrOptions = {
				api_key: nconf.get('FLICKR_API_KEY'),
				secret: nconf.get('FLICKR_SECRET'),
				progress: true,
				silent: true
			}
		Flickr.tokenOnly(flickrOptions, function(error, flickr) {
			flickr.people.getPhotos({
				api_key: nconf.get('FLICKR_API_KEY'),
				user_id: nconf.get('FLICKR_USER_ID'),
				privacy_filter: 1,
				extras: "date_taken,description,original_format,media,url_sq,url_t,url_s,url_q,url_m,url_n,url_z,url_c, url_l,url_o"
			}, function(err, result) {
				var photos = result.photos.photo;
				return fs.writeFileSync('app/data.json', JSON.prettyprint({ 'images': photos }));
				if (err) {
					console.log(err);
				}
			})
		});
	} catch(e) {
		throw new Error(e);
	} finally {
		console.log('Downloaded flickr-data to ./app/data.json.');
	}
});

// Verify JSON-data
gulp.task('json', function() {
	try {
		var json = JSON.parse(fs.readFileSync('app/data.json', 'utf8'));
		console.log('Valid JSON in data.json.');
	} catch(e) {
		throw new Error("app/data.json is corrupted");
	}
});

// Create ./dist
gulp.task('create', function() {
	try {
		if (!fs.existsSync('./dist')) {
			fs.mkdirSync('./dist');
		}
		if (!fs.existsSync('./dist/images')) {
			fs.mkdirSync('./dist/images');
		}
	} catch(e) {
		throw new Error("Could not create ./dist");
	}
});

// Build page from templates
gulp.task('nunjucks', ['create', 'json'], function() {
	return gulp.src('app/pages/**/*.+(html|nunjucks)')
	.pipe(data(function() {
		return require('./app/data.json')
	}))
	.pipe(nunjucksRender({
		path: ['app/templates'],
		manageEnv: manageEnvironment
	}))
	.pipe(gulp.dest('app'))
});

// Compile and clean Bootstrap
gulp.task('css:bootstrap', function() {
	return gulp.src([
		'./node_modules/bootstrap/dist/css/bootstrap-reboot.min.css',
		'./node_modules/bootstrap/dist/css/bootstrap-flex.min.css'
	])
	.pipe(purifycss(['./app/index.html']))
	.pipe(rename('bootstrap.min.css'))
    .pipe(gulp.dest('./dist/assets'));
});

// Compile, prefix and minify styles and Bootstrap
gulp.task('css', ['css:bootstrap'], function() {
	return gulp.src([
		'./dist/assets/bootstrap.min.css',
		'./app/assets/css/main.css'
	])
	.pipe(concat('main.min.css'))
    .pipe(postcss([autoprefixer]))
	.pipe(cssnano())
    .pipe(gulp.dest('./dist/assets'));
});

// Compile and minify scripts
gulp.task('js', function() {
	return gulp.src([
		'./app/assets/js/lazysizes.min.js',
		// './app/assets/js/ls.unload.min.js',
		'./app/assets/js/ls.unveilhooks.min.js',
		'./app/assets/js/ls.parent-fit.min.js',
		'./app/assets/js/classList.min.js',
		'./node_modules/object-fit-images/dist/ofi.browser.js',
		'./node_modules/baguettebox.js/dist/baguetteBox.min.js',
	])
	.pipe(concat('main.min.js'))
	.pipe(uglify())
	.pipe(gulp.dest('./dist/assets'));
});

// Inline styles and scripts
gulp.task('inject', ['nunjucks', 'css', 'js'], function () {
	return gulp.src(['./app/index.html'])
	.pipe(inject(gulp.src(['./dist/assets/main.min.js']), {
		starttag: '<!-- inject:main.js -->',
		endtag: '<!-- endinject:main.js -->',
		transform: function (filePath, file) {
			return file.contents.toString('utf8')
		}
	}))
	.pipe(replace('<!-- inject:main.js -->', '<script type="text/javascript">'))
	.pipe(replace('<!-- endinject:main.js -->', '</script>'))
	.pipe(inject(gulp.src(['./dist/assets/main.min.css']), {
		starttag: '<!-- inject:main.css -->',
		endtag: '<!-- endinject:main.css -->',
		transform: function (filePath, file) {
			return file.contents.toString('utf8')
		}
	}))
	.pipe(replace('<!-- inject:main.css -->', '<style type="text/css">'))
	.pipe(replace('<!-- endinject:main.css -->', '</style>'))
	.pipe(gulp.dest('./dist'));
});

// Minify HTML
gulp.task('html', ['inject'], function() {
	return gulp.src('./dist/index.html')
	.pipe(htmlmin({
		collapseWhitespace: true,
		collapseInlineTagWhitespace: true,
		keepClosingSlash: true,
		removeComments: true
	}))
	.pipe(gulp.dest('./dist'));
});

// Save images to ./dist/images
gulp.task('download', ['create', 'html'], function() {
	if (nconf.get('LOCAL_IMAGES')) {
		var sizes = ['url_s', 'url_m', 'url_n', 'url_z', 'url_c', 'url_l'];
		try {
			var json = JSON.parse(fs.readFileSync('app/data.json', 'utf8'))
		} catch(e) {
			throw new Error("app/data.json is corrupted")
		} finally {
			for (var index = 0; index < json["images"].length; index++) {
				for (var subindex = 0; subindex < sizes.length; subindex++) {
					var input = json["images"][index][sizes[subindex]];
					var filename = input.split('/').pop();
					request(input).pipe(fs.createWriteStream('./dist/images/' + filename));
				}
			}
			return console.log('Wrote images to ./dist/images/.');
		}
	} else {
		console.log('Variable LOCAL_IMAGES is false, not downloading images.')
	}
})

// Clean ./dist
gulp.task('clean', ['download'], function () {
	try {
		return del([
			'dist/assets'
		]);
	} catch(e) {
		throw new Error("Could not run task 'clean'.")
	} finally {
		console.log('Cleaned ./dist/assets');
	}
});

// Run all of the above
gulp.task('default', ['clean'], function() {
	return console.log('Built dist/index.html');
});