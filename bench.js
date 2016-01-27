var minimist = require('minimist');
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');
var path = require('path');
var fs = require('fs');
var bytes = require('bytes');

function usage() {
	console.log([
		'',
		'usage:',
		'',
		'  Write tiles to directory:',
		'    node test.js <path to xml> <path to dir with mapnik+tilelive-bridge>',
		'',
		'options:',
		'  --threadpool=N',
		'  --minzoom=N',
		'  --maxzoom=N',
		'  --bounds=minx,miny,maxx,maxy',
		'  --output (write tiles to directory)',
		'  --verbose (print tiles as they are finished rendering)',
		'  --concurrency=N (source read concurrency)',
		'  --show-progress=true|false (report progress on tiles transferred, default: true)'
	].join('\n'));
	process.exit(1);
}

var argv = minimist(process.argv.slice(2));

if (argv._.length < 2) {
	return usage();
}

var reportprogress = argv['show-progress'] || true;
var mapnik = require('mapnik');
console.log('mapnik severity', mapnik.Logger.getSeverity());
mapnik.Logger.setSeverity(mapnik.Logger.DEBUG);
console.log('mapnik severity', mapnik.Logger.getSeverity());


if (argv.threadpool) {
	process.env.UV_THREADPOOL_SIZE = argv.threadpool;
} else {
	// increase the libuv threadpool size to 1.5x the number of logical CPUs.
	process.env.UV_THREADPOOL_SIZE = Math.ceil(Math.max(4, require('os').cpus().length * 1.5));
}
console.log('UV_THREADPOOL_SIZE:', process.env.UV_THREADPOOL_SIZE);

var xml_map_path = argv._[0];

if (!fs.existsSync(xml_map_path)) {
	console.log('file does not exist',xml_map_path);
	process.exit(1)
}

xml_map_path = path.resolve(xml_map_path);

var submodules_directory = path.join(argv._[1],'node_modules');

if (!fs.existsSync(submodules_directory)) {
	console.log('file does not exist',submodules_directory);
	process.exit(1)
}

submodules_directory = path.resolve(submodules_directory);

var tilelive = require('tilelive');
var File = require('tilelive-file');
var Bridge = require(path.join(submodules_directory,'tilelive-bridge'));

File.registerProtocols(tilelive);
Bridge.registerProtocols(tilelive);
var source = 'bridge://' + xml_map_path;


var mercator = new(require('sphericalmercator'))()

var sink;
var start;
var tile_count = 0;
var tiles_transferred = 0;

if (argv.output) {
	console.log('deleting existing directory:', argv.output);
	rimraf.sync(path.join(__dirname, argv.output));
	mkdirp.sync(argv.output)
	var filetype = -1 === xml_map_path.indexOf('style') ? 'pbf' : 'webp';
	sink = 'file://' + path.join(__dirname, argv.output+'?filetype=' + filetype);
} else {
	sink = 'noop://';

	function NOOP(uri, callback) {
		return callback(null,this);
	}

	NOOP.prototype.putTile = function(z, x, y, tile, callback) {
		if (argv.verbose) {
			var bbox = mercator.bbox(x,y,z, false, '900913');
			console.log('no-op putTile',z,x,y,JSON.stringify(bbox));
		}
		tile_count++;
		return callback(null);
	}

	NOOP.prototype.putInfo = function(info, callback) {
		if (argv.verbose) {
			console.log('no-op putInfo',info);
		}
		return callback(null);
	}

	NOOP.prototype.startWriting = function(callback) {
		if (argv.verbose) {
			console.log('no-op startWriting');
		}
		return callback(null);
	}

	NOOP.prototype.stopWriting = function(callback) {
		if (argv.verbose) {
			console.log('no-op stopWriting');
		}
		return callback(null);
	}

	tilelive.protocols['noop:'] = NOOP;
}

function report(stats, p) {
	tiles_transferred = p.transferred;
	console.log(p.percentage.toFixed(1) + '%, done:' + stats.done + ', skipped:' + stats.skipped + ', transferred:', p.transferred + ', remaining: ' + p.remaining);
	var now = new Date().getTime() / 1000;
	var elapsed = now - start;
	var overall = 0 !== tile_count ? (tile_count / elapsed).toFixed(1) : (tiles_transferred / elapsed).toFixed(1);
	console.log('       elapsed[sec]: ' + elapsed.toFixed(1) + ', tiles put: ' + tile_count + ', overall tiles per second: ' + overall);
}

tilelive.info(source, function(err, info) {
	if (err) {
		throw err;
	}
	var options = { close: true };
	if (argv.bounds) argv.bounds = argv.bounds.split(',').map(Number);
	options.minzoom = argv.minzoom || info.minzoom;
	options.maxzoom = argv.maxzoom || info.maxzoom;
	options.bounds = argv.bounds || info.bounds;
	options.type = argv.scheme || 'pyramid';
	//options.scheme = argv.scheme || 'pyramid';
	options.concurrency = argv.concurrency || Math.ceil(require('os').cpus().length * 16);


	if (true === reportprogress) {

		options.progress = report;

		console.log('')
		console.log('Config -> source options:',JSON.stringify(options));
		console.log('Config -> threadpool size:',process.env.UV_THREADPOOL_SIZE);
		console.log('Config -> sink:',sink);
	}

	var stats = {
		max_rss:0,
		max_heap:0
	}

	var memcheck = setInterval(function() {
		var mem = process.memoryUsage();
		if (mem.rss > stats.max_rss) stats.max_rss = mem.rss;
		if (mem.heapUsed > stats.max_heap) stats.max_heap = mem.heapUsed;
		/*var line = 'Memory -> peak rss: ' + bytes(stats.max_rss) + ' / peak heap: ' + bytes(stats.max_heap);
        if (process.platform === 'win32') {
            process.stdout.write('\033[0G'+line);
        } else {
            process.stdout.write('\r'+line);
        }*/
	},1000);

	start = new Date().getTime() / 1000;
	tilelive.copy(source, sink, options, function(err) {
		if (err) {
			console.log(err);
			process.exit(1);
		} else {
			var end = new Date().getTime() / 1000;
			var elapsed = end - start;
			console.log('')
			console.log('Result -> elapsed time: ' + elapsed + 's');
			if (tile_count > 0) {
				console.log('Result -> total tiles rendered: ' + tile_count);
				console.log('Result -> tiles per second: ' + tile_count/elapsed);
				console.log('Result -> tiles per second per thread: ' + tile_count/elapsed/process.env.UV_THREADPOOL_SIZE);
			} else {
				console.log('\n\nTODO: how to count tiles when *NOT* using "noop" sink!!!\n\n');
			}
			if (tiles_transferred > 0) {
				console.log('Result -> tiles transferred: ' + tiles_transferred);
				console.log('Result -> tiles transferred per second: ' + tiles_transferred / elapsed);
			}
			clearInterval(memcheck);
			console.log('Result -> max_rss[MB]: ', (stats.max_rss/(1024*1024)).toFixed(1));
			console.log('Result -> max_heap[MB]: ', (stats.max_heap/(1024*1024)).toFixed(1));
			console.log('Test is done: process will exit once map pool is automatically reaped\n\n');
		}
	});
});