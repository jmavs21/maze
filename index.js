/**
 * Maze Game.
 */
(function () {
	let firebaseConfig = {
		apiKey: "AIzaSyA26HDdO0BHSkwwNX32RXRMrkVuBSbPhu4",
		authDomain: "maze-1987.firebaseapp.com",
		databaseURL: "https://maze-1987.firebaseio.com",
		projectId: "maze-1987",
		storageBucket: "maze-1987.appspot.com",
		messagingSenderId: "571118456914",
		appId: "1:571118456914:web:776e194f18a3b7c8"
	};
	if (typeof firebase === 'undefined') {
		document.getElementById("p1").innerHTML = "ERROR: No connection to Firebase.";
	}
	firebase.initializeApp(firebaseConfig);
	let db = firebase.firestore();
	let gameRef = db.collection("game");
	let playersRef = db.collection("players");

	let _canvas = document.getElementById("canvas");
	_canvas.width = document.getElementById("content").clientWidth;
	_canvas.height = _canvas.width;
	let _context = _canvas.getContext("2d");
	let _canvasSize = _canvas.width;
	let _colorMaze = "#000000";
	let _player = null;
	let _idPlayer = null;
	let _rows = null;
	let _startLevel;
	let _lastLevel;
	let _seed;
	let _wallSize;
	let _walls;
	let _graph;
	let _goal;

	window.onload = function () {
		validateGameSettings();
		gameListener();
	};

	window.onunload = window.onbeforeunload = function () {
		deletePlayer(_idPlayer);
		return null;
	};

	window.moveUp = function () {
		drawPlayerMove(-_rows, -_wallSize, true);
	}

	window.moveDown = function () {
		drawPlayerMove(_rows, _wallSize, true);
	}

	window.moveLeft = function () {
		drawPlayerMove(-1, -_wallSize, false);
	}

	window.moveRight = function () {
		drawPlayerMove(1, _wallSize, false);
	}

	document.body.addEventListener("keydown", function (event) {
		if (event.keyCode == 38 || event.keyCode == 87)       // up, w
		{
			event.preventDefault();
			moveUp();
		}
		else if (event.keyCode == 37 || event.keyCode == 65)  // left, a
		{
			event.preventDefault();
			moveLeft();
		}
		else if (event.keyCode == 40 || event.keyCode == 83)  // down, s
		{
			event.preventDefault();
			moveDown();
		}
		else if (event.keyCode == 39 || event.keyCode == 68)  // right, d
		{
			event.preventDefault();
			moveRight();
		}
	});

	function validateGameSettings() {
		gameRef.doc("settings").get().then(function (doc) {
			if (!doc.exists) {
				gameRef.doc("settings").set({
					startLevel: 8,
					lastLevel: 16,
					rows: 8,
					seed: 100
				});
			}
		}).catch(function (error) {
			console.log("Error GET game settings document:", error);
		});
	}

	function deletePlayer(id) {
		if (id !== null) {
			playersRef.doc(id).delete()
				.catch(function (error) {
					console.error("Players error DELETING player: ", error);
				});
		}
	}

	function deleteUnusedPlayers() {
		setTimeout(function () {
			playersRef.get().then((querySnapshot) => {
				querySnapshot.forEach((doc) => {
					if (doc.data().r !== _rows) {
						deletePlayer(doc.id);
					}
				});
			})
				.catch(function (error) {
					console.log("Error DELETING players: ", error);
				});
		}, 3000);
	}

	let gameListener = function () {
		gameRef.where("rows", ">=", 2)
			.onSnapshot(function (querySnapshot) {
				querySnapshot.forEach(function (doc) {
					let data = doc.data();
					_startLevel = data.startLevel;
					_lastLevel = data.lastLevel;
					_rows = data.rows;
					_seed = data.seed;
				});
				restartGame();
				updatePlayer();
				deleteUnusedPlayers();
			});
	};

	let playersListener = function () {
		playersRef.where("x", ">=", 0)
			.onSnapshot(function (querySnapshot) {
				let players = [];
				querySnapshot.forEach(function (doc) {
					players.push(new Player(0, new Position(doc.data().x, doc.data().y), doc.data().c));
				});
				drawPlayers(players);
			});
	};

	function updatePlayer() {
		if (_idPlayer === null) {
			addNewPlayer();
		} else {
			playersRef.doc(_idPlayer).update({
				x: _player.position.x,
				y: _player.position.y,
				r: _rows
			})
				.catch(function (error) {
					console.error("Player UPDATING error: ", error);
				});
		}
	}

	function updateGameSettings() {
		gameRef.doc("settings").update({
			rows: _rows,
			seed: _seed,
		})
			.catch(function (error) {
				console.error("Game settings UPDATING error: ", error);
			});
	}

	function addNewPlayer() {
		playersRef.add({
			x: _player.position.x,
			y: _player.position.y,
			c: _player.color,
			r: _rows
		})
			.then(function (playersRef) {
				_idPlayer = playersRef.id;
			})
			.catch(function (error) {
				console.error("Players document ADD error: ", error);
			})
			.then(playersListener);
	}

	function drawPlayers(players) {
		drawMaze();
		drawGoal(_goal.x, _goal.y);
		for (let player of players) {
			drawPlayer(player.position.x, player.position.y, player.color);
		}
	}

	function restartGame() {
		_wallSize = 1.0 / _rows;
		_walls = createAllWalls();
		shuffle(_walls);
		_graph = createGraphFromNonWalls(removeNonWalls());
		_player = createPlayerPosition();
		_goal = new Position(1.0 - _wallSize + (_wallSize / 3.3), 1.0 - _wallSize + (_wallSize / 3.3));
		drawMaze();
		drawPlayer(_player.position.x, _player.position.y, _player.color);
		drawGoal(_goal.x, _goal.y);
	}

	function createAllWalls() {
		let numOfWalls = (((_rows - 1) * _rows) * 2) | 0;
		let walls = [];
		let group = _rows - 1;
		let first = 0;
		let j = (numOfWalls / 2) | 0;
		let second = _rows;
		for (let i = 0; i < (numOfWalls / 2) | 0; i++) {
			walls[i] = new Wall(first, ++first, true);
			if (i % group === group - 1)
				first++;
			walls[j++] = new Wall(i, second++, false);
		}
		return walls;
	}

	function shuffle(walls) {
		for (let i = 0; i < walls.length; i++) {
			swap(i, getRandom(0, i), walls);
		}
	}

	function swap(i, j, walls) {
		let tmp = walls[i];
		walls[i] = walls[j];
		walls[j] = tmp;
	}

	function getRandom(min, max) {
		return Math.floor(pseudorandom() * (max - min + 1)) + min;
	}

	function pseudorandom() {
		let x = Math.sin(_seed++) * 10000;
		return x - Math.floor(x);
	}

	function removeNonWalls() {
		let nonWalls = [];
		let uf = new UnionFind(_rows * _rows);
		for (let i = 0; i < _walls.length; i++) {
			let wall = _walls[i];
			if (!uf.connected(wall.v, wall.w)) {
				uf.union(wall.v, wall.w);
				nonWalls.push(wall);
				_walls[i] = null;
			}
		}
		let mazeWalls = [];
		for (let i = 0; i < _walls.length; i++) {
			if (_walls[i] !== null) {
				mazeWalls.push(_walls[i]);
			}
		}
		_walls = mazeWalls;
		return nonWalls;
	}

	function createGraphFromNonWalls(nonWalls) {
		let graph = new Graph(_rows * _rows);
		for (let wall of nonWalls) {
			graph.addEdge(wall.v, wall.w);
			graph.addEdge(wall.w, wall.v);
		}
		return graph;
	}

	function createPlayerPosition() {
		let x = (Math.random() * (_wallSize / 2.0)) + (_wallSize / 4.0);
		let y = (Math.random() * (_wallSize / 2.0)) + (_wallSize / 4.0);
		let color = _player === null ? getRandomColor() : _player.color;
		return new Player(0, new Position(x, y), color);
	}

	function getRandomColor() {
		let letters = '0123456789ABCDEF';
		let color = '#';
		for (let i = 0; i < 6; i++) {
			color += letters[Math.floor(Math.random() * 16)];
		}
		return color;
	}

	function drawMaze() {
		_context.clearRect(0, 0, _canvas.width, _canvas.height);
		for (let wall of _walls) {
			let v = wall.v;
			let xWidth = _wallSize * (v % _rows);
			let yHeight = ((v / _rows) | 0) * _wallSize + _wallSize;
			if (wall.isVertical) {
				drawLine(xWidth + _wallSize, yHeight, xWidth + _wallSize, yHeight - _wallSize);
			} else {
				drawLine(xWidth, yHeight, xWidth + _wallSize, yHeight);
			}
		}
		drawLine(0.0, 0.0, 1.0, 0.0); // bottom line
		drawLine(0.0, 0.0, 0.0, 1.0); // left line
		drawLine(1.0, 0.0, 1.0, 1.0); // right line
		drawLine(0.0, 1.0, 1.0, 1.0); // upper line
	}

	function scale(value) {
		return _canvasSize * value;
	}

	function drawLine(x0, y0, x1, y1) {
		_context.beginPath();
		_context.strokeStyle = _colorMaze;
		_context.moveTo(scale(x0), scale(y0));
		_context.lineTo(scale(x1), scale(y1));
		_context.stroke();
	}

	function drawPlayer(x, y, color) {
		_context.beginPath();
		_context.fillStyle = color;
		_context.arc(scale(x), scale(y), scale(_wallSize) / 5, 0, 2 * Math.PI);
		_context.fill();
	}

	function drawGoal(x, y) {
		_context.beginPath();
		_context.fillStyle = _colorMaze;
		_context.rect(scale(x), scale(y), scale(_wallSize) / 2.5, scale(_wallSize) / 2.5);
		_context.fill();
	}

	function drawPlayerMove(toCell, wallWidth, isVerticalMove) {
		if (_graph.adjacents(_player.v).has(_player.v + toCell)) {
			_player.v = _player.v + toCell;
			if (isVerticalMove)
				_player.position.y = _player.position.y + wallWidth;
			else
				_player.position.x = _player.position.x + wallWidth;
			drawMaze();
			drawPlayer(_player.position.x, _player.position.y, _player.color);
			drawGoal(_goal.x, _goal.y);
			wasGoalReached();
			updatePlayer();
		}
	}

	function wasGoalReached() {
		if (_player.v === _graph.V - 1) {
			if (_rows >= _lastLevel) {
				_rows = _startLevel;
				_seed = getRandom(1, 1000);
			}
			else {
				_rows++;
			}
			updateGameSettings();
		}
	}

	class Wall {
		constructor(v, w, isVertical) {
			this.v = v;
			this.w = w;
			this.isVertical = isVertical;
		}
		toString() {
			return this.v + "-" + this.w;
		}
	}

	class Player {
		constructor(v, position, color) {
			this.v = v;
			this.position = position;
			this.color = color;
		}
		toString() {
			return this.v + "," + this.position + "," + this.color;
		}
	}

	class Position {
		constructor(x, y) {
			this.x = x;
			this.y = y;
		}
		toString() {
			return "(" + this.x + "," + this.y + ")";
		}
	}

	class Graph {
		constructor(V) {
			this.adj = [];
			this.V = V;
			this.E = 0;
			for (let v = 0; v < this.V; v++) {
				this.adj[v] = new Set();
			}
		}
		addEdge(v, w) {
			this.validateVertex(v);
			this.validateVertex(w);
			this.adj[v].add(w);
			this.E++;
		}
		adjacents(v) {
			this.validateVertex(v);
			return this.adj[v];
		}
		validateVertex(v) {
			if (v < 0 || v >= this.V)
				throw "IllegalArgumentException: vertex " + v + " is not between 0 and " + (this.V - 1);
		}
		toString() {
			let s = [];
			s.push(this.V + " vertices, " + this.E + " edges \n");
			for (let v = 0; v < this.V; v++) {
				s.push(v + ": ");
				for (let w of this.adj[v]) {
					s.push(w + " ");
				}
				s.push("\n");
			}
			return s.join("");
		}
	}

	class UnionFind {
		constructor(n) {
			this.parent = [];
			this.rank = [];
			for (let i = 0; i < n; i++) {
				this.parent[i] = i;
				this.rank[i] = 0;
			}
		}
		connected(p, q) {
			return this.find(p) === this.find(q);
		}
		find(p) {
			while (p !== this.parent[p]) {
				this.parent[p] = this.parent[this.parent[p]];
				p = this.parent[p];
			}
			return p;
		}
		union(p, q) {
			let pP = this.find(p);
			let qP = this.find(q);
			if (pP === qP) return;
			if (this.rank[pP] < this.rank[qP])
				this.parent[pP] = qP;
			else if (this.rank[qP] < this.rank[pP])
				this.parent[qP] = pP;
			else {
				this.parent[qP] = pP;
				this.rank[pP]++;
			}
		}
		validate(p) {
			if (p < 0 || p >= this.parent.length)
				throw "IllegalArgumentException Index " + p + " is not between 0 and " + (this.parent.length - 1);
		}
	}
})();