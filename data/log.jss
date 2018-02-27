
module.exports = function(req, res) {

	console.log(`${req.q.msg}`);
	
	res.sendStatus(200);
}
