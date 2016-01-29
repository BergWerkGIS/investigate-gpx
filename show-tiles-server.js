var http = require('http');
var url = require('url');
var path = require('path');
var fs = require('fs');
var Pbf = require('pbf');
var vt = require('vector-tile');
var zlib = require('zlib');

var server = http.createServer();
var port = process.argv[2] || 666;

server.listen(port);

var no_cache_hdr = {
	'Cache-Control': 'no-cache, no-store, must-revalidate',
	'Pragma': 'no-cache',
	'Expires': 0
}

server.on('request', function (req, res) {
	var uri = url.parse(req.url).pathname;
	var filename = path.join(__dirname, uri);
	fs.exists(filename, function (exists) {
		if (!exists) {
			console.log('not found:', filename);
			res.writeHead(404, { 'Content-Type': 'text/plain' });
			res.write('404 not found');
			res.end();
			return;
		}

		//static files
		if (
			-1 === filename.indexOf('.webp')
			&& -1 === filename.indexOf('.pbf')
			) {
			fs.readFile(filename, 'binary', function (err, file) {
				res.writeHead(200, no_cache_hdr);
				res.write(file, "binary");
				res.end();
				return;
			});
		} else if (filename.indexOf('.webp') >= 0) {
			fs.readFile(filename, 'binary', function (err, file) {
				if (err) {
					res.writeHead(500, { "Content-Type": "text/plain" });
					res.write(err + "\n");
					res.end();
					return;
				}
				res.writeHead(200, no_cache_hdr);
				res.write(file, "binary");
				res.end();
				return;
			});
		} else {


			//https://github.com/mapbox/mapnik-internal/blob/a4e328ae17f1897a0c61bb85a28fbc9391e46f5d/benchmarks/node-mapnik/vtile-memory-test/vtile-mem.js#L17-L29
			//pbf
			//		try {
			console.log('req.url:', req.url);
			var zxy = req.url.match(/\/(\d+)\/(\d+)\/(\d+)/);
			console.log(zxy[2], zxy[3], zxy[1]);

			fs.readFile(filename, 'binary', function (err, file) {
				zlib.inflate(file, function (err, data) {
					console.log(data);
					var pbf = new Pbf(new Pbf(data));
					var tile = new vt.VectorTile(pbf);
					console.log('Object.keys(tile.layers):', tile.layers);
					console.log('Object.keys(tile.layers):', Object.keys(tile.layers));
					//console.log('tile:\n', JSON.stringify(tile, null, '   '));
					console.log('tile:\n', tile);
					var layers = Object.keys(tile.layers);
					if (!Array.isArray(layers)) { layers = [layers]; }
					var collection = { type: 'FeatureCollection', features: [] };
					layers.forEach(function (lyr_name) {
						var lyr = tile.layers[lyr_name];
						for (var idx = 0; idx < lyr.length; idx++) {
							var feat = lyr.feature(idx).toGeoJSON(
								zxy[2],
								zxy[3],
								zxy[1]
								);
							feat.coordinates = lyr.feature(idx).loadGeometry();
							collection.features.push(feat);
						}
					});
					res.writeHead(200, { "Content-Type": "application/vnd.geo+json" });
					res.write(JSON.stringify(collection));
					console.log('res.end');
					res.end();
				});
			});


			// }
			// catch (ex) {
			// 	console.log('\n', req.url, '\n', ex, '\n');
			// 	res.writeHead(500, { "Content-Type": "text/plain" });
			// 	res.write(uri, '\n', ex, '\n');
			// }
		}
	});
});


server.on('listening', function () {
	console.log('open browser at http://localhost:' + port + '/show-tiles.html');
});

server.on('error', function (err) {
	console.log(err);
});