(() => {
  class Player {
    constructor(id, v, position, color) {
      this.id = id;
      this.v = v;
      this.position = position;
      this.color = color;
    }
  }

  class Position {
    constructor(x, y) {
      this.x = x;
      this.y = y;
    }
  }

  class Settings {
    constructor(startLevel, lastLevel, rows, seed) {
      this.startLevel = startLevel;
      this.lastLevel = lastLevel;
      this.rows = rows;
      this.seed = seed;
    }
  }

  class Maze {
    constructor([wallSize, walls, graph, goal]) {
      this.wallSize = wallSize;
      this.walls = walls;
      this.graph = graph;
      this.goal = goal;
    }
  }

  class Wall {
    constructor(v, w, isVertical) {
      this.v = v;
      this.w = w;
      this.isVertical = isVertical;
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
    isConnected(p, q) {
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

  if (typeof firebase === 'undefined')
    document.getElementById('p1').innerHTML = 'No connection to Firebase!';

  const db = firebase.firestore();
  const gameRef = db.collection('game');
  const playersRef = db.collection('players');
  let unsubscribeSettingsListener = null;
  let unsubscribePlayersListener = null;

  const canvas = document.getElementById('canvas');
  canvas.width = document.getElementById('content').clientWidth;
  canvas.height = canvas.width;
  const context = canvas.getContext('2d');
  const colorMaze = '#000000';

  const settings = new Settings(8, 16, 8, 100);
  let maze = null;
  let player = null;

  window.onload = async () => await startGameState();

  window.onunload = window.onbeforeunload = () => {
    deletePlayer(player.id);
    unsubscribeSettingsListener();
    unsubscribePlayersListener();
    return null;
  };

  window.moveUp = async () =>
    await movePlayer(-settings.rows, -maze.wallSize, true);
  window.moveDown = async () =>
    await movePlayer(settings.rows, maze.wallSize, true);
  window.moveLeft = async () => await movePlayer(-1, -maze.wallSize, false);
  window.moveRight = async () => await movePlayer(1, maze.wallSize, false);

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
    await createSettingsDocIfNeeded();
    subscribeSettingsListener();
  };

  const createSettingsDocIfNeeded = async () => {
    const settingsRef = gameRef.doc('settings');
    const settingsDoc = await settingsRef.get();
    if (!settingsDoc.exists) {
      settingsRef.set({
        startLevel: settings.startLevel,
        lastLevel: settings.lastLevel,
        rows: settings.rows,
        seed: settings.seed,
      });
    }
  };

  const subscribeSettingsListener = () => {
    unsubscribeSettingsListener = gameRef
      .where('rows', '>=', 2)
      .onSnapshot(settingsOnSnapshot);
  };

  const settingsOnSnapshot = async (settingsDoc) => {
    settingsDoc.forEach((setting) => {
      const data = setting.data();
      settings.startLevel = data.startLevel;
      settings.lastLevel = data.lastLevel;
      settings.rows = data.rows;
      settings.seed = data.seed;
    });
    maze = new Maze(buildMazeUsingRandomizedKruskals());
    player = resetPlayer(maze.wallSize);
    if (isNewPlayer()) {
      await createPlayerDocAndSetId();
      subscribePlayersListener();
    } else {
      await updatePlayerPosition();
    }
    await deleteUnusedPlayers();
  };

  const resetPlayer = (wallSize) => {
    const x = Math.random() * (wallSize / 2.0) + wallSize / 4.0;
    const y = Math.random() * (wallSize / 2.0) + wallSize / 4.0;
    const position = new Position(x, y);
    if (player === null) {
      return new Player(null, 0, position, getRandomColor());
    }
    player.v = 0;
    player.position = position;
    return player;
  };

  const getRandomColor = () => {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  };

  const isNewPlayer = () => player.id === null;

  const createPlayerDocAndSetId = async () => {
    const playerRef = await playersRef.add({
      x: player.position.x,
      y: player.position.y,
      c: player.color,
      r: settings.rows,
    });
    player.id = playerRef.id;
  };

  const subscribePlayersListener = () => {
    unsubscribePlayersListener = playersRef
      .where('x', '>=', 0)
      .onSnapshot(playersOnSnapshot);
  };

  const playersOnSnapshot = (queryPlayers) => {
    const players = [];
    queryPlayers.forEach((p) => {
      const data = p.data();
      players.push(new Player(null, 0, new Position(data.x, data.y), data.c));
    });
    drawMazeWithPlayers(players);
  };

  const updatePlayerPosition = async () => {
    await playersRef.doc(player.id).update({
      x: player.position.x,
      y: player.position.y,
      r: settings.rows,
    });
  };

  const deleteUnusedPlayers = async () => {
    await waitForActiveGames();
    const players = await playersRef.get();
    players.docs.map((p) => {
      if (p.data().r !== settings.rows) deletePlayer(p.id);
    });
  };

  const waitForActiveGames = () => new Promise((res) => setTimeout(res, 3000));

  const deletePlayer = (id) => {
    if (id !== null) playersRef.doc(id).delete();
  };

  const movePlayer = async (nextCell, wallSize, isVerticalMove) => {
    if (maze.graph.adjacents(player.v).has(player.v + nextCell)) {
      player.v = player.v + nextCell;
      if (isVerticalMove) player.position.y = player.position.y + wallSize;
      else player.position.x = player.position.x + wallSize;
      if (!(await wasGoalReached())) await updatePlayerPosition();
    }
  };

  const wasGoalReached = async () => {
    if (player.v === maze.graph.V - 1) {
      if (settings.rows >= settings.lastLevel) {
        settings.rows = settings.startLevel;
        settings.seed = getRandom(1, 1000);
      } else {
        settings.rows++;
      }
      await gameRef.doc('settings').update({
        rows: settings.rows,
        seed: settings.seed,
      });
      return true;
    }
    return false;
  };

  const drawMazeWithPlayers = (players) => {
    drawMaze();
    drawGoal(maze.goal.x, maze.goal.y);
    for (let p of players) {
      drawPlayer(p.position.x, p.position.y, p.color);
    }
  };

  const drawMaze = () => {
    context.clearRect(0, 0, canvas.width, canvas.width);
    for (const wall of maze.walls) {
      const v = wall.v;
      const xWidth = maze.wallSize * (v % settings.rows);
      const yHeight =
        Math.floor(v / settings.rows) * maze.wallSize + maze.wallSize;
      if (wall.isVertical) {
        drawLine(
          xWidth + maze.wallSize,
          yHeight,
          xWidth + maze.wallSize,
          yHeight - maze.wallSize
        );
      } else {
        drawLine(xWidth, yHeight, xWidth + maze.wallSize, yHeight);
      }
    }
    drawLine(0.0, 0.0, 1.0, 0.0); // bottom line
    drawLine(0.0, 0.0, 0.0, 1.0); // left line
    drawLine(1.0, 0.0, 1.0, 1.0); // right line
    drawLine(0.0, 1.0, 1.0, 1.0); // upper line
  };

  const drawLine = (x0, y0, x1, y1) => {
    context.beginPath();
    context.strokeStyle = colorMaze;
    context.moveTo(scale(x0), scale(y0));
    context.lineTo(scale(x1), scale(y1));
    context.stroke();
  };

  const scale = (value) => {
    return canvas.width * value;
  };

  const drawGoal = (x, y) => {
    context.beginPath();
    context.fillStyle = colorMaze;
    context.rect(
      scale(x),
      scale(y),
      scale(maze.wallSize) / 2.5,
      scale(maze.wallSize) / 2.5
    );
    context.fill();
  };

  const drawPlayer = (x, y, color) => {
    context.beginPath();
    context.fillStyle = color;
    context.arc(scale(x), scale(y), scale(maze.wallSize) / 5, 0, 2 * Math.PI);
    context.fill();
  };

  const buildMazeUsingRandomizedKruskals = () => {
    const wallSize = 1.0 / settings.rows;
    const allWals = createAllWalls();
    shuffle(allWals);
    const [walls, spaces] = getWallsAndSpaces(allWals);
    const graph = createGraphFromSpaces(spaces);
    const goal = new Position(
      1.0 - wallSize + wallSize / 3.3,
      1.0 - wallSize + wallSize / 3.3
    );
    return [wallSize, walls, graph, goal];
  };

  const createAllWalls = () => {
    const group = settings.rows - 1;
    const numOfWalls = Math.floor(group * settings.rows * 2);
    const allWals = [];
    let vertical = 0;
    let horizontal = settings.rows;
    const half = Math.floor(numOfWalls / 2);
    for (let i = 0, j = half; i < half; i++) {
      allWals[i] = new Wall(vertical, ++vertical, true);
      if (i % group === group - 1) vertical++;
      allWals[j++] = new Wall(i, horizontal++, false);
    }
    return allWals;
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
    const x = Math.sin(settings.seed++) * 10000;
    return x - Math.floor(x);
  };

  const getWallsAndSpaces = (allWals) => {
    const spaces = [];
    const uf = new UnionFind(settings.rows * settings.rows);
    for (let i = 0; i < allWals.length; i++) {
      const wall = allWals[i];
      if (!uf.isConnected(wall.v, wall.w)) {
        uf.union(wall.v, wall.w);
        spaces.push(wall);
        allWals[i] = null;
      }
    }
    const walls = [];
    for (let i = 0; i < allWals.length; i++) {
      if (allWals[i] !== null) walls.push(allWals[i]);
    }
    return [walls, spaces];
  };

  const createGraphFromSpaces = (spaces) => {
    const graph = new Graph(settings.rows * settings.rows);
    for (const wall of spaces) {
      graph.addEdge(wall.v, wall.w);
    }
    return graph;
  };
})();
