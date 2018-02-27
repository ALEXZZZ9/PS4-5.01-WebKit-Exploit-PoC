const path = require('path');
const fs = require('fs');
const mkdirp = require('mkdirp');

module.exports = function(req, res) {
	let writeContinue = req.get('Write-Continue') === 'true';
	let fileName = req.get('Content-Disposition') || 'dump.bin';
	let filePath = __dirname + '/dumps/' + fileName;
	let dir = path.dirname(filePath);

	console.log(`Dumping to ${filePath}`);
	
	try {
		fs.statSync(dir);
	} catch (e) {
		mkdirp.sync(dir);
	}
	
	if (!writeContinue && fs.existsSync(filePath)) {
		fs.unlinkSync(filePath);
	}

	req.pipe(fs.createWriteStream(filePath, {
		defaultEncoding: 'binary',
		flags: 'a'
	}));

	req.on('end', function() {
		console.log(`Dump done`);
		return res.sendStatus(200);
	});
}


