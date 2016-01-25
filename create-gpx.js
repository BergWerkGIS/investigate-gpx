var path = require('path');
var fs = require('fs');
var minimist = require('minimist');
var gdal = require('gdal');

var argv = minimist(process.argv.slice(2));
if (argv._.length < 1) {
	console.log('node create-gpx.js <out.gpx> --bounds=lng,lat,lng,lat --nr_of_points=<INT>');
	process.exit(1);
}
var out_file = argv._[0];
var nr_of_points = argv.nr_of_points || 700;
var bounds = argv.bounds ? argv.bounds.split(',').map(Number): [-180,-85.05112877980659,180,85.05112877980659];

console.log('creating', out_file, 'with', nr_of_points, 'points');
console.log('bounds:', bounds);

var wgs84 = gdal.SpatialReference.fromEPSG(4326);
var out_ds = gdal.open(out_file, 'w', 'GPX');
var lyr_trks = out_ds.layers.create('blabla', wgs84, gdal.wkbLineString, ['FORCE_GPX_TRACK=YES']);

var lat = bounds[1];
var lng = bounds[0];
var delta_lat = (bounds[3] - lat) / nr_of_points;
var delta_lng = (bounds[2] - lng) / nr_of_points;

var trk = new gdal.LineString();

for (var i = 0; i <= nr_of_points; i++){
	trk.points.add(lng, lat);
	lat += delta_lat;
	lng += delta_lng;
}

var feat = new gdal.Feature(lyr_trks);
feat.setGeometry(trk);
lyr_trks.features.add(feat);

lyr_trks.flush();
out_ds.flush();
out_ds.close();
console.log('created', out_file);

var center = ((bounds[0] + bounds[2]) / 2) + ',' + ((bounds[1] + bounds[3]) / 2);

var data_xml_name = out_file + '.data.xml';
console.log('creating', data_xml_name);
var xml = fs.readFileSync('data.xml.template', 'utf8');
xml = xml.replace(/{{filename}}/g, out_file);
xml = xml.replace(/{{basename}}/g, path.basename(out_file, '.gpx'));
//xml = xml.replace(/{{bounds}}/, bounds.join(','));
xml = xml.replace(/{{center}}/, center);
fs.writeFileSync(data_xml_name, xml, 'utf8');

var style_xml_name = out_file + '.style.xml';
console.log('creating', style_xml_name);
xml = fs.readFileSync('style.xml.template', 'utf8');
xml = xml.replace(/{{filename}}/g, out_file);
xml = xml.replace(/{{basename}}/g, path.basename(out_file, '.gpx'));
//xml = xml.replace(/{{bounds}}/, bounds.join(','));
xml = xml.replace(/{{center}}/, center);
fs.writeFileSync(style_xml_name, xml, 'utf8');

console.log('--- DONE ---');
