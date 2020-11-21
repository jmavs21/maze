/**
 * Maze Game.
 */
(() => {
  if (typeof firebase === 'undefined')
    document.getElementById('p1').innerHTML = 'No connection to Firebase!';

  const db = firebase.firestore();

  const gameRef = db.collection('game');
  const playersRef = db.collection('players');

  const _canvas = document.getElementById('canvas');
  _canvas.width = document.getElementById('content').clientWidth;
  _canvas.height = _canvas.width;
  const _context = _canvas.getContext('2d');
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

  window.onload = async () => await startGameState();

  window.onunload = window.onbeforeunload = () => {
    deletePlayer(_idPlayer);
    return null;
  };

  window.moveUp = async () => await drawPlayerMove(-_rows, -_wallSize, true);
  window.moveDown = async () => await drawPlayerMove(_rows, _wallSize, true);
  window.moveLeft = async () => await drawPlayerMove(-1, -_wallSize, false);
  window.moveRight = async () => await drawPlayerMove(1, _wallSize, false);

  document.body.addEventListener('keydown', async (e) => {
    if (e.key === 'ArrowUp' || e.key === 'W' || e.key === 'w') {
      e.preventDefault();
      await window.moveUp();
    } else if (e.key === 'ArrowLeft' || e.key === 'A' || e.key === 'a') {
      e.preventDefault();
      await window.moveLeft();
    } else if (e.key === 'ArrowDown' || e.key === 'S' || e.key === 's') {
      e.preventDefault();
      await window.moveDown();
    } else if (e.key === 'ArrowRight' || e.key === 'D' || e.key === 'd') {
      e.preventDefault();
      await window.moveRight();
    }
  });

  window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled Firebase reject:', e.reason);
  });

  const startGameState = async () => {
    await createSettingsIfNeeded();
    createSettingsListener();
  };

  const createSettingsIfNeeded = async () => {
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

  const createSettingsListener = () => {
    gameRef.where('rows', '>=', 2).onSnapshot(setGameWithSettings);
  };

  const setGameWithSettings = async (settings) => {
    settings.forEach((setting) => {
      const data = setting.data();
      _startLevel = data.startLevel;
      _lastLevel = data.lastLevel;
      _rows = data.rows;
      _seed = data.seed;
    });
    drawGame();
    await updatePlayer();
    await deleteUnusedPlayers();
  };

  const updatePlayer = async () => {
    if (_idPlayer === null) {
      await addNewPlayer();
      createPlayersListener();
    } else {
      await playersRef.doc(_idPlayer).update({
        x: _player.position.x,
        y: _player.position.y,
        r: _rows,
      });
    }
  };

  const addNewPlayer = async () => {
    const newPlayerRef = await playersRef.add({
      x: _player.position.x,
      y: _player.position.y,
      c: _player.color,
      r: _rows,
    });
    _idPlayer = newPlayerRef.id;
  };

  const createPlayersListener = () => {
    playersRef.where('x', '>=', 0).onSnapshot(setPlayers);
  };

  const setPlayers = (queryPlayers) => {
    const players = [];
    queryPlayers.forEach((player) => {
      const data = player.data();
      players.push(new Player(0, new Position(data.x, data.y), data.c));
    });
    drawPlayers(players);
  };

  const deleteUnusedPlayers = async () => {
    await waitForActiveGames();
    const players = await playersRef.get();
    players.docs.map((player) => {
      if (player.data().r !== _rows) deletePlayer(player.id);
    });
  };

  const waitForActiveGames = () => new Promise((res) => setTimeout(res, 3000));

  const deletePlayer = (id) => {
    if (id !== null) playersRef.doc(id).delete();
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

  const updateGameSettings = async () => {
    await gameRef.doc('settings').update({
      rows: _rows,
      seed: _seed,
    });
  };

  const drawGame = () => {
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
    const group = _rows - 1;
    const numOfWalls = Math.floor(group * _rows * 2);
    const walls = [];
    let vertical = 0;
    let horizontal = _rows;
    const half = Math.floor(numOfWalls / 2);
    for (let i = 0, j = half; i < half; i++) {
      walls[i] = new Wall(vertical, ++vertical, true);
      if (i % group === group - 1) vertical++;
      walls[j++] = new Wall(i, horizontal++, false);
    }
    return walls;
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
    _context.clearRect(0, 0, _canvas.width, _canvas.width);
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

  const drawLine = (x0, y0, x1, y1) => {
    _context.beginPath();
    _context.strokeStyle = _colorMaze;
    _context.moveTo(scale(x0), scale(y0));
    _context.lineTo(scale(x1), scale(y1));
    _context.stroke();
  };

  const scale = (value) => {
    return _canvas.width * value;
  };

  const drawPlayers = (players) => {
    drawMaze();
    drawGoal(_goal.x, _goal.y);
    for (let player of players) {
      drawPlayer(player.position.x, player.position.y, player.color);
    }
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

  class Wall {
    constructor(v, w, isVertical) {
      this.v = v;
      this.w = w;
      this.isVertical = isVertical;
    }
  }

  class Position {
    constructor(x, y) {
      this.x = x;
      this.y = y;
    }
  }

  class Player {
    constructor(v, position, color) {
      this.v = v;
      this.position = position;
      this.color = color;
    }
  }

  class Graph {
    constructor(V) {
      this.V = V;
      this.adj = [];
      for (let v = 0; v < this.V; v++) {
        this.adj[v] = new Set();
      }
    }
    addEdge(v, w) {
      this.adj[v].add(w);
      this.adj[w].add(v);
    }
    adjacents(v) {
      return this.adj[v];
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
  }
})();
