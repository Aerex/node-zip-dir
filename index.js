/**
 * Copyright (c) 2013 Jordan Santell

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 */
var fs = require('fs');
var path = require('path');
var asyncLib = require('async');

// Use local version of JSZip, as the version in `npm` is a fork
// and not up to date, and failing on v0.8, so this is an unfortunate
// work around
// from: https://github.com/Stuk/jszip
var Zip = require('jszip');

// Limiting the number of files read at the same time
var maxOpenFiles = 500;

//Error Message
var ROOTDIR_CANNOT_BE_EMPTY = 'Cannot have an empty root directory';

module.exports = function zipWrite(rootDir, options, callback) {
	if (!callback) {
		callback = options;
		options = {};
	}

	options = options || {};

	zipBuffer(rootDir, options, function (err, buffer) {
		if (err) {
			callback(err, null);
		} else if (options.saveTo) {
			fs.writeFile(options.saveTo, buffer, {encoding: 'binary'}, function (err) {
				callback(err, buffer);
			});
		} else {
			callback(err, buffer);
		}
	});
};

function zipBuffer(rootDir, options, callback) {
	var zip = new Zip();
	var folders = {};
	// Resolve the path so we can remove trailing slash if provided
	rootDir = path.resolve(rootDir);

	folders['rootDir'] = rootDir;

	folders[rootDir] = zip;

	dive(rootDir, function (err) {
		if (err) return callback(err);

		callback(null, zip.generate({
			compression: 'DEFLATE',
			type: 'nodebuffer',
			platform: process.platform
		}));
	});

	function dive(dir, callback) {
		fs.readdir(dir, function (err, files) {
			if (err) return callback(err);
			if (!files.length) {
				if (folders.rootDir === dir && options.noEmptyDirectories) {
					return callback(ROOTDIR_CANNOT_BE_EMPTY)
				} else if (options.noEmptyDirectories) {
					var rootDir = dir.substring(0, dir.lastIndexOf('/'));
					var baseName = path.basename(dir);
					var parentZip = folders[rootDir];
					if (parentZip) {
						parentZip.remove(baseName);
					}
					return callback();
				} else {
					return callback();
				}
			}
			var count = files.length;
			files.forEach(function (file) {
				var fullPath = path.resolve(dir, file);
				addItem(fullPath, function (err) {
					if (!--count) {
						callback(err);
					}
				});
			});
		});
	}

	var fileQueue = asyncLib.queue(function (task, callback) {
		fs.readFile(task.fullPath, function (err, data) {
			if (options.each) {
				options.each(path.join(task.dir, task.file));
			}
			folders[task.dir].file(task.file, data, {
				unixPermissions: task.mode,
				dosPermissions: task.mode
			});
			callback(err);
		});
	}, maxOpenFiles);

	function addItem(fullPath, cb) {
		fs.stat(fullPath, function (err, stat) {
			if (err) return cb(err);
			if (options.filter && !options.filter(fullPath, stat)) return cb();
			var dir = path.dirname(fullPath);
			var file = path.basename(fullPath);
			var parentZip;
			if (stat.isDirectory()) {
				parentZip = folders[dir];
				if (options.each) {
					options.each(fullPath);
				}
				folders[fullPath] = parentZip.folder(file);
				folders[fullPath].files[fullPath.replace(folders.rootDir + '/', "") + '/'].unixPermissions = stat.mode;
				folders[fullPath].files[fullPath.replace(folders.rootDir + '/', "") + '/'].options.unixPermissions = stat.mode;
				folders[fullPath].files[fullPath.replace(folders.rootDir + '/', "") + '/'].dosPermissions = stat.mode;
				folders[fullPath].files[fullPath.replace(folders.rootDir + '/', "") + '/'].options.dosPermissions = stat.mode;
				dive(fullPath, cb);
			} else {
				fileQueue.push({fullPath: fullPath, dir: dir, file: file, mode: stat.mode}, cb);
			}
		});
	}
}
