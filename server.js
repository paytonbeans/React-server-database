const crypto = require('crypto'); 

//some webserver libs
const express = require('express');
const bodyParser = require('body-parser');
const auth = require('basic-auth');

//promisification
const bluebird = require('bluebird');

//database connector
const redis = require('redis');
//make redis use promises
bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

//create db client
const client = redis.createClient();

const port = process.env.NODE_PORT || 3000;

//make sure client connects correctly.
client.on("error", function (err) {
    console.log("Error in redis client.on: " + err);
});

const setUser = function(userObj){
	return client.hmsetAsync("user:"+userObj.id, userObj ).then(function(){
		console.log('Successfully created (or overwrote) user '+userObj.id);
	}).catch(function(err){
		console.error("WARNING: errored while attempting to create tester user account");
	});

}

//make sure the test user credentials exist
let userObj = {
	salt: new Date().toString(),
	id: 'teacher'
};
userObj.hash = crypto.createHash('sha256').update('testing'+userObj.salt).digest('base64');
//this is a terrible way to do setUser
//I'm not waiting for the promise to resolve before continuing
//I'm just hoping it finishes before the first request comes in attempting to authenticate
setUser(userObj);


//start setting up webserver
const app = express();

//decode request body using json
app.use(bodyParser.json());

//allow the API to be loaded from an application running on a different host/port
app.use(function(req, res, next) {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
        res.header('Access-Control-Expose-Headers', 'X-Total-Count');
		res.header('Access-Control-Allow-Methods', "PUT, DELETE, POST, GET, HEAD");
        next();
});

//protect our API
app.use(function(req,res,next){
	switch(req.method){
		case "GET":
		case "POST":
		case "PUT":
		case "DELETE":
			//extract the given credentials from the request
			let creds = auth(req);
			
			//look up userObj using creds.name
			client.hgetallAsync("user:"+creds.name).then(
				(userObj)=>{
					//user exists
					let hash =  crypto.createHash('sha256').update(creds.pass+userObj.salt).digest('base64');
					if(userObj.hash == hash){
						//hashes match
						//allow request to continue to be processed
						next();
					}else{
						//hash doesnt match, reject request
						res.sendStatus(401);
					}
				},
				(err)=>{
					//user doesnt exist or something
					console.error("in authenticate app.use, hgetall returned error: ",err);
					res.sendStatus(401);
				}
			);
			break;
		default:
			//maybe an options check or something
			next();
			break;
	}
});

//this takes a set of items and filters, sorts and paginates the items.
//it gets it's commands from queryArgs and returns a new set of items
let filterSortPaginate = (type, queryArgs, items) =>{
	let keys;

	//create an array of filterable/sortable keys
	if(type == 'student'){
		keys = ['id','name'];
	}else{
		keys = ['id','student_id','type','max','grade'];
	}

	//applied to each item in items
	//returning true keeps item
	let filterer = (item) =>{
		for(let i = 0;i<keys.length;i++){
			//if this key exists in queryArgs
			//and it's value doesnt match whats's on the item
			//don't keep the item
			if(queryArgs[keys[i]] && !item[keys[i]].toLowerCase().includes(queryArgs[keys[i]].toLowerCase())){
				return false;
			}
		}
		return true;
	};

	//apply above function
	items = items.filter(filterer);
	console.log('items after filter:',items)
	//always sort, default to sorting on id
	if(!queryArgs._sort){
		queryArgs._sort = 'id';
	}
	//make sure the column can be sorted
	let direction = 1;
	if(!queryArgs._order){
		queryArgs._order = 'asc';
	}
	if(queryArgs._order.toLowerCase() == 'desc'){
		direction = -1;
	}

	//comparator...given 2 items returns which one is greater
	//used to sort items
	//written to use queryArgs._sort as the key when comparing
	let sorter = (a,b)=>{
		let result;
		if(a[queryArgs._sort].toLowerCase() > b[queryArgs._sort].toLowerCase()){
			result = 1;
		}else if(a[queryArgs._sort].toLowerCase() < b[queryArgs._sort].toLowerCase()){
			result = -1;
		}else{
			result = 0;
		}

		//if direction is descending this will reverse our result
		//and therefore reverse the list
		//but wont affect if they are equal
		return result * direction;
	};

	items.sort(sorter);
	console.log('items after sort:',items)
	//if we need to paginate
	if(queryArgs._start || queryArgs._end || queryArgs._limit){
		//start defaults to 0, end defaults to # of items
		let start = 0;
		let end = items.length;

		if(queryArgs._start){
			start = queryArgs._start;
		}

		if(queryArgs._end){
			end = queryArgs._end;
		}else if(queryArgs._limit){
			end = start + queryArgs._limit;
		}

		items = items.slice(start,end);
	}
	console.log('items after pagination:',items)
	return items;
};

app.get('/students/:id',function(req,res){
	//get student
	let id = req.params.id;

	//do a redis lookup for the hash associated with a given id
	client.hgetallAsync("student:"+id).then(function(data){
		//if data is falsy, no hash exists for that user
		if(!data){
			res.sendStatus(404);
			return;
		}
		//otherwise send requested data back
		res.status(200).json({
			id: data.id,
			name: data.name,
			_ref: "/students/"+data.id,
		});
	}).catch(function(err){
		res.status(500).json({
			error: err
		});
	});
});
app.get('/students',function(req,res){
	//get contents of set of usernames
	client.smembersAsync('students').then(function(students){
		//even if the redis key 'students' doesn't exist, smembers will still give us an empty array

		//if we get an empty array just bail
		if(students.length == 0){
			res.header("X-Total-Count", 0);

			//return results
			res.status(200).json([]);
			return;
		}

		let promises = [];
		let studentObjs = [];
		let totalCount;

		//its bad practice to make functions inside a loop
		//so we're making it here and reusing it below
		let studentHandler = (studentName,studentObj) => {
			console.log('got studentObj',studentObj)
			if(!studentObj){
				throw "unknown student'"+studentName+"'.";
			}
			studentObj._ref = "/students/"+studentName;
			studentObj.id = studentName;
			studentObjs.push(studentObj);
		};

		//for each username in the set 'students'
		for(let i = 0;i<students.length;i++){
			//get the hash for that username, use studentHandler to save hash into studentObjs
			//add resulting promise to promises array so we can promise.all later
			promises.push(client.hgetallAsync("student:"+students[i]).then(studentHandler.bind(null,students[i])));
		}
		//when all the hash lookups have returned and studentHandler has finished for every lookup
		Promise.all(promises).then(function(){
			//save total count
			totalCount = studentObjs.length;
			
			//filter and sort
			studentObjs = filterSortPaginate('student', req.query, studentObjs);
			res.header("X-Total-Count", totalCount);

			//return results
			res.status(200).json(studentObjs);
		}).catch(function(err){
			console.log('error promises.all'.err);
			res.status(500).json(err);
		});

	}).catch(function(err){
		console.log('error smembers: ',err)
		res.status(500).json({
			error: err
		});
	});
});

app.post('/students',function(req,res){
	//add student
	if(!req.body){
		res.status(400).json({
			error: "No request body"
		});
		return;
	}

	if(!req.body.id){
		res.status(400).json({
			error: "No id"
		});
		return;
	}

	if(!req.body.name){
		res.status(400).json({
			error: "No name"
		});
		return;
	}

	let {id, name} = req.body;

	//add id to set stored in redis key 'students'
	client.saddAsync('students', id).then(function(worked){
		//if worked is falsy, the id already existed in the set
		if(!worked){
			res.status(400).json({
				error: "id already exists"
			});
			return;
		}

		//otherwise id was added to the set, now make the hash for that id
		client.hmsetAsync('student:'+id,{
			id: id,
			name: name
		}).then(function(worked){
			if(!worked){
				res.status(500).json({
					error: "couldn't save student."
				});
				return;
			}
			res.status(200).json({
				id: id,
				name: name,
				_ref: "/students/"+id
			});
		});
	});
});
app.delete('/students/:id',function(req,res){
	//could also use a client.multi, but I'm lazy
	//delete id from set and delete the hash for that id
	//probably should do an exists check so we can return a 404 if the id didn't exist to start
	//but I'm lazy
	Promise.all([
		client.delAsync("student:"+req.params.id),
		client.sremAsync("students",req.params.id)
	]).then(function(){
		res.json({id: req.params.id});
	}).catch(function(err){
		res.status(500).json({
			error: err
		});
	});

});
app.put('/students/:id',function(req,res){
	if(!req.body.name){
		res.status(400).json({
			error: "missing new name"
		});
		return;
	}

	

	if(!req.params.id){
		res.status(400).json({
			error: "id required in path"
		});
		return;
	}

	client.hexistsAsync("student:"+req.params.id, "name").then(function(exists){
		//if user's hash doesnt exist
		if(exists === 0){
			res.status(404);
			res.end();
			return;
		}
		//otherwise, set the new name
		client.hsetAsync("student:"+req.params.id, "name", req.body.name).then(function(){
			res.json({_ref: './student:${req.params.id}', id: req.params.id});
			res.end();
		}).catch(function(err){
			res.status(500).json({
				error: err
			});
		});
	});
});

app.post('/grades',function(req,res){
	//add grade
	if(!req.body){
		res.status(400).json({
			error: "missing body"
		});
		return;
	}
	if(!req.body.student_id || !req.body.grade || 
		!req.body.max || !req.body.type){
		res.status(400).json({
			error: "all fields are required (student_id, grade, max, type)"
		});
		return;
	}


	//user a counter to keep track of grade id. increment it and get the value
	client.incrAsync("grades").then(function(id){
		//this is the obj we're saving into the hash
		let grade = {
			student_id: req.body.student_id,
			grade: req.body.grade,
			max: req.body.max,
			type: req.body.type
		};

		//save grade into hash
		client.hmsetAsync("grade:"+id,grade).then(function(){
			grade._ref = "/grades/"+id;
			grade.id = ""+id;
			res.status(200).json(grade);
		}).catch(function(err){
			res.status(500).json({
				error: err
			});
		});
	}).catch(function(err){
		res.status(500).json({
			error: err
		});
	});
});
app.get('/grades/:id',function(req,res){
	//get grade
	//retrieve the hash using the ID
	//shoud probably do an hexists check first but I'm lazy.
	client.hgetallAsync("grade:"+req.params.id).then(function(data){
		data.id = req.params.id;
		data._ref = "/grades/"+req.params.id;
		res.status(200).json(data);
	}).catch(function(err){
		res.status(404);
		res.end();
	});
});
app.put('/grades/:id',function(req,res){
	//modify grade
	if(!req.body){
		res.status(400).json({
			error: "missing body"
		});
	}

	//need a body and need at least 1 thing to change
	if(!req.body.student_id && !req.body.grade && 
		!req.body.max && !req.body.type){
		res.status(400).json({
			error: "missing body"
		});
		return;
	}

	//build up the attrs to edit
	let grade = {};
	if(req.body.student_id){
		grade.student_id = req.body.student_id;
	}
	if(req.body.max){
		grade.max = req.body.max;
	}
	if(req.body.grade){
		grade.grade = req.body.grade;
	}
	if(req.body.type){
		grade.type = req.body.type;
	}
	console.log('changes for grade:',grade);
	//make sure grade exists before trying to modify it
	client.hexistsAsync("grade:"+req.params.id, "grade").then(function(exists){
		//if grade doesnt exist
		if(exists === 0){
			res.status(404);
			res.end();
			return;
		}

		//else grade exists, update the object
		client.hmsetAsync("grade:"+req.params.id, grade).then(function(){
			res.status(200);
			res.end();
		}).catch(function(){
			res.status(500).json({
				error: "error saving grade"
			});
		});
	}).catch(function(){
		res.status(500).json({
			error: "error checking to see if grade "+req.params.id+" exists"
		});
	});
});
app.delete('/grades/:id',function(req,res){
	//delete grade
	//delete the hash
	client.delAsync("grade:"+req.params.id).then(function(result){
		//if hash doesn't exist, 404
		if(result === 0){
			res.status(404);
			res.end();
			return;
		}
		res.json({id: req.params.id});
	}).catch(function(){
		res.status(500);
		res.end();
	});
});

app.get('/grades',function(req,res){
	//get all grades
	//get grades by username
	//get grades by type
	//get grades by username & type

	//get the counter
	client.getAsync("grades").then(function(counter){
		//if no counter, no grades exist
		if(!counter || counter === 0){
			res.header("X-Total-Count", 0);
			res.status(200).json([]);
			return;
		}

		let promises = [];
		let gradeObjs = [];

		//dont make functions in a loop
		let gradeHandler = function(id, grade){
			if(grade !== null){
				grade._ref = "/grades/"+id;
				grade.id = ""+id;
				gradeObjs.push(grade);
			}
		};

		//use counter to loop through all possible grade ids
		for(let i = 1;i<=counter;i++){
			promises.push(client.hgetallAsync("grade:"+i).then(gradeHandler.bind(null,i)));
		}

		//once database returns and handler finishes for every request
		Promise.all(promises).then(function(){

			//save total count
			totalCount = gradeObjs.length;
			
			//filter and sort
			gradeObjs = filterSortPaginate('grade', req.query, gradeObjs);
			res.header("X-Total-Count", totalCount);

			//return results
			res.status(200).json(gradeObjs);

		}).catch(function(err){
			res.status(500).json({error: err});
		});
	});
});
app.delete('/db',function(req,res){
	client.flushallAsync().then(function(){
		//make sure the test user credentials exist
		let userObj = {
			salt: new Date().toString(),
			id: 'teacher'
		};
		userObj.hash = crypto.createHash('sha256').update('testing'+userObj.salt).digest('base64');
		//this is a terrible way to do setUser
		//I'm not waiting for the promise to resolve before continuing
		//I'm just hoping it finishes before the first request comes in attempting to authenticate
		setUser(userObj).then(()=>{
			res.sendStatus(200);
		});
	}).catch(function(err){
		res.status(500).json({error: err});
	});
});

app.listen(port, function () {
  console.log('Example app listening on port '+port+'!');
});
