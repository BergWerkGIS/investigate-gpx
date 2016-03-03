var http = require('http');
var url = require('url');
var path = require('path');
var fs = require('fs');
var Pbf = require('pbf');
var vt = require('vector-tile');
var zlib = require('zlib');
var mapnik = require('mapnik');

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
			console.log('req.url:', req.url);
			var zxy = req.url.match(/\/(\d+)\/(\d+)\/(\d+)/);
			var z = +zxy[1];
			var x = +zxy[2];
			var y = +zxy[3]
			var simplify_distance = 10.0;

			fs.readFile(filename, function (err, file) {
				if (err) { throw err; }
				zlib.gunzip(file, function (err, data) {
					if (err) { throw err; }
					var tile = new mapnik.VectorTile(z, x, y, { buffer_size: 0 });
					tile.setData(file, function (err) {
						if (err) { throw err; }
						var t2 = new mapnik.VectorTile(z, x, y, { buffer_size: 0 });
						//if (z > 15) { simplify_distance = 0.0; }
						t2.composite([tile], {reencode:true, simplify_distance: simplify_distance });
						var collection = { type: 'FeatureCollection', features: [] };
						t2.paintedLayers().forEach(function (lyr_name) {
							//already returns a featurecollection, e.g.:
							//{"type":"FeatureCollection","name":"b000","features":[{"type":"Feature","id":1,"geometry"
							//console.log(tile.toGeoJSON(lyr_name).features);
							var feats = JSON.parse(t2.toGeoJSON(lyr_name)).features;
							feats.forEach(function (feat) {
								collection.features.push(feat);
							});
						})

						// //returns features with tile coordinates
						// tile.toJSON().forEach(function (lyr) {
						// 	console.log(lyr.name);
						// 	collection.features.push(lyr.features);
						// });

						res.writeHead(200, { "Content-Type": "application/vnd.geo+json" });
						res.write(JSON.stringify(collection));
						res.end();
					});
				});
			});
		}
	});
});


server.on('listening', function () {
	console.log('open browser at http://localhost:' + port + '/show-tiles.html');
});

server.on('error', function (err) {
	console.log(err);
});