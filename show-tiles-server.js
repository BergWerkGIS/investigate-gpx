var http = require('http');
var url = require('url');
var path = require('path');
var fs = require('fs');

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
			res.writeHead(404, { 'Content-Type': 'text/plain'});
			res.write('404 not found');
			res.end();
			return;
		}
		fs.readFile(filename, 'binary', function (err, file) {
			if (err) {
				res.writeHead(500, {"Content-Type": "text/plain"});
				res.write(err + "\n");
				res.end();
				return;
			}
			res.writeHead(200, no_cache_hdr);
			res.write(file, "binary");
			res.end();
		});
	});
});

server.on('listening', function(){
	console.log('open browser at http://localhost:' + port + '/show-tiles.html');
});

server.on('error', function(err){
	console.log(err);
});