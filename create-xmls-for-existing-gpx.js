var path = require('path');
var fs = require('fs');
var minimist = require('minimist');
var gdal = require('gdal');


var gpx_file_name = process.argv[2];

var envelope;
var ds = gdal.open(gpx_file_name);

ds.layers.forEach(function (lyr) {
	try {
		if (0 !== lyr.features.count(true)) {
			var env = lyr.getExtent(true);
			console.log(lyr.name, env);
			if (!envelope) {
				envelope = env;
			} else {
				envelope.merge(env);
			}
		}
	}
	catch (e) {
		console.log(e);
		console.log(gdal.lastError);
	}
});

var bounds = [envelope.minX, envelope.minY, envelope.maxX, envelope.maxY];
console.log('full env:', bounds.join(','));

var center = ((bounds[0] + bounds[2]) / 2) + ',' + ((bounds[1] + bounds[3]) / 2);

var data_xml_name = gpx_file_name + '.data.xml';
console.log('creating', data_xml_name);
var xml = fs.readFileSync('data.xml.template', 'utf8');
xml = xml.replace(/{{filename}}/g, gpx_file_name);
xml = xml.replace(/{{basename}}/g, path.basename(gpx_file_name, '.gpx'));
//xml = xml.replace(/{{bounds}}/, bounds.join(','));
xml = xml.replace(/{{center}}/, center);
fs.writeFileSync(data_xml_name, xml, 'utf8');

var style_xml_name = gpx_file_name + '.style.xml';
console.log('creating', style_xml_name);
var xml = fs.readFileSync('style.xml.template', 'utf8');
xml = xml.replace(/{{filename}}/g, gpx_file_name);
xml = xml.replace(/{{basename}}/g, path.basename(gpx_file_name, '.gpx'));
//xml = xml.replace(/{{bounds}}/, bounds.join(','));
xml = xml.replace(/{{center}}/, center);
fs.writeFileSync(style_xml_name, xml, 'utf8');


console.log('--- DONE ---');
