/**
 * Maze Game.
 */
(() => {
  if (typeof firebase === 'undefined') {
    document.getElementById('p1').innerHTML =
      'Error: no connection to Firebase.';
  }

  const db = firebase.firestore();

  const gameRef = db.collection('game');
  const playersRef = db.collection('players');

  const _canvas = document.getElementById('canvas');
  _canvas.width = document.getElementById('content').clientWidth;
  _canvas.height = _canvas.width;
  const _context = _canvas.getContext('2d');
  const _canvasSize = _canvas.width;
  const _colorMaze = '#000000';

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

  window.onload = async () => {
    try {
      await validateGameSettings();
      await gameListener();
    } catch (err) {
      console.log('Error with firebase: ', err);
    }
  };

  window.onunload = window.onbeforeunload = async () => {
    await deletePlayer(_idPlayer);
    return null;
  };

  window.moveUp = async () => await drawPlayerMove(-_rows, -_wallSize, true);
  window.moveDown = async () => await drawPlayerMove(_rows, _wallSize, true);
  window.moveLeft = async () => await drawPlayerMove(-1, -_wallSize, false);
  window.moveRight = async () => await drawPlayerMove(1, _wallSize, false);

  document.body.addEventListener('keydown', (event) => {
    if (event.keyCode == 38 || event.keyCode == 87) {
      // up, w
      event.preventDefault();
      window.moveUp();
    } else if (event.keyCode == 37 || event.keyCode == 65) {
      // left, a
      event.preventDefault();
      window.moveLeft();
    } else if (event.keyCode == 40 || event.keyCode == 83) {
      // down, s
      event.preventDefault();
      window.moveDown();
    } else if (event.keyCode == 39 || event.keyCode == 68) {
      // right, d
      event.preventDefault();
      window.moveRight();
    }
  });

  const validateGameSettings = async () => {
    const settingsRef = gameRef.doc('settings');
    const settings = await settingsRef.get();
    if (!settings.exists) {
      settingsRef.set({
        startLevel: 8,
        lastLevel: 16,
        rows: 8,
        seed: 100,
      });
    }
  };

  const deletePlayer = async (id) => {
    if (id !== null) await playersRef.doc(id).delete();
  };

  const deleteUnusedPlayers = () => {
    setTimeout(async () => {
      const players = await playersRef.get();
      players.forEach(async (player) => {
        if (player.data().r !== _rows) await deletePlayer(player.id);
      });
    }, 3000);
  };

  const gameListener = async () => {
    gameRef.where('rows', '>=', 2).onSnapshot(updateSettings);
  };

  const updateSettings = async (settings) => {
    settings.forEach((setting) => {
      const data = setting.data();
      _startLevel = data.startLevel;
      _lastLevel = data.lastLevel;
      _rows = data.rows;
      _seed = data.seed;
    });
    restartGame();
    updatePlayer();
    deleteUnusedPlayers();
  };

  const playersListener = () => {
    playersRef.where('x', '>=', 0).onSnapshot(createPlayers);
  };

  const createPlayers = (queryPlayers) => {
    const players = [];
    queryPlayers.forEach((player) => {
      const data = player.data();
      players.push(new Player(0, new Position(data.x, data.y), data.c));
    });
    drawPlayers(players);
  };

  const updatePlayer = async () => {
    if (_idPlayer === null) {
      await addNewPlayer();
    } else {
      await playersRef.doc(_idPlayer).update({
        x: _player.position.x,
        y: _player.position.y,
        r: _rows,
      });
    }
  };

  const updateGameSettings = async () => {
    await gameRef.doc('settings').update({
      rows: _rows,
      seed: _seed,
    });
  };

  const addNewPlayer = async () => {
    const newPlayerRef = await playersRef.add({
      x: _player.position.x,
      y: _player.position.y,
      c: _player.color,
      r: _rows,
    });
    _idPlayer = newPlayerRef.id;
    playersListener();
  };

  const drawPlayers = (players) => {
    drawMaze();
    drawGoal(_goal.x, _goal.y);
    for (let player of players) {
      drawPlayer(player.position.x, player.position.y, player.color);
    }
  };

  const restartGame = () => {
    _wallSize = 1.0 / _rows;
    _walls = createAllWalls();
    shuffle(_walls);
    _graph = createGraphFromNonWalls(removeNonWalls());
    _player = createPlayerPosition();
    _goal = new Position(
      1.0 - _wallSize + _wallSize / 3.3,
      1.0 - _wallSize + _wallSize / 3.3
    );
    drawMaze();
    drawPlayer(_player.position.x, _player.position.y, _player.color);
    drawGoal(_goal.x, _goal.y);
  };

  const createAllWalls = () => {
    const numOfWalls = Math.floor((_rows - 1) * _rows * 2);
    const walls = [];
    const group = _rows - 1;
    let first = 0;
    const half = Math.floor(numOfWalls / 2);
    let j = half;
    let second = _rows;
    for (let i = 0; i < half; i++) {
      walls[i] = new Wall(first, ++first, true);
      if (i % group === group - 1) first++;
      walls[j++] = new Wall(i, second++, false);
    }
    return walls;
  };

  const shuffle = (walls) => {
    for (let i = 0; i < walls.length; i++) {
      swap(i, getRandom(0, i), walls);
    }
  };

  const swap = (i, j, walls) => {
    const tmp = walls[i];
    walls[i] = walls[j];
    walls[j] = tmp;
  };

  const getRandom = (min, max) => {
    return Math.floor(pseudorandom() * (max - min + 1)) + min;
  };

  const pseudorandom = () => {
    const x = Math.sin(_seed++) * 10000;
    return x - Math.floor(x);
  };

  const removeNonWalls = () => {
    const nonWalls = [];
    const uf = new UnionFind(_rows * _rows);
    for (let i = 0; i < _walls.length; i++) {
      const wall = _walls[i];
      if (!uf.connected(wall.v, wall.w)) {
        uf.union(wall.v, wall.w);
        nonWalls.push(wall);
        _walls[i] = null;
      }
    }
    const mazeWalls = [];
    for (let i = 0; i < _walls.length; i++) {
      if (_walls[i] !== null) {
        mazeWalls.push(_walls[i]);
      }
    }
    _walls = mazeWalls;
    return nonWalls;
  };

  const createGraphFromNonWalls = (nonWalls) => {
    const graph = new Graph(_rows * _rows);
    for (const wall of nonWalls) {
      graph.addEdge(wall.v, wall.w);
      graph.addEdge(wall.w, wall.v);
    }
    return graph;
  };

  const createPlayerPosition = () => {
    const x = Math.random() * (_wallSize / 2.0) + _wallSize / 4.0;
    const y = Math.random() * (_wallSize / 2.0) + _wallSize / 4.0;
    const color = _player === null ? getRandomColor() : _player.color;
    return new Player(0, new Position(x, y), color);
  };

  const getRandomColor = () => {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  };

  const drawMaze = () => {
    _context.clearRect(0, 0, _canvas.width, _canvas.height);
    for (const wall of _walls) {
      const v = wall.v;
      const xWidth = _wallSize * (v % _rows);
      const yHeight = Math.floor(v / _rows) * _wallSize + _wallSize;
      if (wall.isVertical) {
        drawLine(
          xWidth + _wallSize,
          yHeight,
          xWidth + _wallSize,
          yHeight - _wallSize
        );
      } else {
        drawLine(xWidth, yHeight, xWidth + _wallSize, yHeight);
      }
    }
    drawLine(0.0, 0.0, 1.0, 0.0); // bottom line
    drawLine(0.0, 0.0, 0.0, 1.0); // left line
    drawLine(1.0, 0.0, 1.0, 1.0); // right line
    drawLine(0.0, 1.0, 1.0, 1.0); // upper line
  };

  const scale = (value) => {
    return _canvasSize * value;
  };

  const drawLine = (x0, y0, x1, y1) => {
    _context.beginPath();
    _context.strokeStyle = _colorMaze;
    _context.moveTo(scale(x0), scale(y0));
    _context.lineTo(scale(x1), scale(y1));
    _context.stroke();
  };

  const drawPlayer = (x, y, color) => {
    _context.beginPath();
    _context.fillStyle = color;
    _context.arc(scale(x), scale(y), scale(_wallSize) / 5, 0, 2 * Math.PI);
    _context.fill();
  };

  const drawGoal = (x, y) => {
    _context.beginPath();
    _context.fillStyle = _colorMaze;
    _context.rect(
      scale(x),
      scale(y),
      scale(_wallSize) / 2.5,
      scale(_wallSize) / 2.5
    );
    _context.fill();
  };

  const drawPlayerMove = async (toCell, wallWidth, isVerticalMove) => {
    if (_graph.adjacents(_player.v).has(_player.v + toCell)) {
      _player.v = _player.v + toCell;
      if (isVerticalMove) _player.position.y = _player.position.y + wallWidth;
      else _player.position.x = _player.position.x + wallWidth;
      drawMaze();
      drawPlayer(_player.position.x, _player.position.y, _player.color);
      drawGoal(_goal.x, _goal.y);
      await wasGoalReached();
      await updatePlayer();
    }
  };

  const wasGoalReached = async () => {
    if (_player.v === _graph.V - 1) {
      if (_rows >= _lastLevel) {
        _rows = _startLevel;
        _seed = getRandom(1, 1000);
      } else {
        _rows++;
      }
      await updateGameSettings();
    }
  };

  class Wall {
    constructor(v, w, isVertical) {
      this.v = v;
      this.w = w;
      this.isVertical = isVertical;
    }
    toString() {
      return this.v + '-' + this.w;
    }
  }

  class Player {
    constructor(v, position, color) {
      this.v = v;
      this.position = position;
      this.color = color;
    }
    toString() {
      return this.v + ',' + this.position + ',' + this.color;
    }
  }

  class Position {
    constructor(x, y) {
      this.x = x;
      this.y = y;
    }
    toString() {
      return '(' + this.x + ',' + this.y + ')';
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
        throw (
          'IllegalArgumentException: vertex ' +
          v +
          ' is not between 0 and ' +
          (this.V - 1)
        );
    }
    toString() {
      const s = [];
      s.push(this.V + ' vertices, ' + this.E + ' edges \n');
      for (let v = 0; v < this.V; v++) {
        s.push(v + ': ');
        for (let w of this.adj[v]) {
          s.push(w + ' ');
        }
        s.push('\n');
      }
      return s.join('');
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
      const pP = this.find(p);
      const qP = this.find(q);
      if (pP === qP) return;
      if (this.rank[pP] < this.rank[qP]) this.parent[pP] = qP;
      else if (this.rank[qP] < this.rank[pP]) this.parent[qP] = pP;
      else {
        this.parent[qP] = pP;
        this.rank[pP]++;
      }
    }
    validate(p) {
      if (p < 0 || p >= this.parent.length)
        throw (
          'IllegalArgumentException Index ' +
          p +
          ' is not between 0 and ' +
          (this.parent.length - 1)
        );
    }
  }
})();
