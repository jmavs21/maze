# Maze Game

A randomly generated online maze game, that can be play in real time with multiple players.

No need to register or create an account, just open the following link on your web browser.
* Link to [Maze Game](https://maze-1987.firebaseapp.com)

## How to play

Goal of the game is to move your player (circle) to the goal (black square).
Move your circle by pressing the buttons in the game or just press arrows/WASD keys.

## Implementation details

The random generation of the maze was implemented using the following algorithm: [Randomized Kruskal's algorithm](https://en.wikipedia.org/wiki/Maze_generation_algorithm#Randomized_Kruskal's_algorithm)

The game was implemented using the following tools:

#### * HTML

[HTML5 Canvas](https://www.w3schools.com/html/html5_canvas.asp) was used for 2D drawing.

#### * JavaScript

VanillaJS was used to generate and draw the maze and managing calls to Firebase API.

#### * CSS

[CSS Grid](https://www.w3schools.com/css/css_grid.asp) was used to reposition the web elements for better presentation on desktop and mobile.

#### * Firebase
[Cloud Firestore](https://firebase.google.com/docs/firestore) from Firebase was used as a backend demo to record players position and maze settings.

## How to use source code

Follow these instructions if you would like to use the source code for local deployment and testing.

##### Prerequisite: You will need a [Google account](https://accounts.google.com/signup)

1. Create a new Firebase project
* Login to your Firebase console using your Google account: [Firebase console](https://console.firebase.google.com/)
* Select __Add project__ and follow the on-screen instructions.

2. Install [Firebase CLI](https://firebase.google.com/docs/cli)
```sh
npm install -g firebase-tools
```

3. Sign in with your Google account
```sh
firebase login
```

4. Initialize your [Firebase project](https://firebase.google.com/docs/hosting/quickstart#initialize)
```sh
firebase init
```
* __Note__: verify that a __public__ folder was created.

5. Clone the maze repository
```sh
git clone https://github.com/jmavs21/maze.git
```

6. Move the cloned files to the __public__ folder created on Step 4

7. Update __index.js__ file with your Firebase configuration (firebaseConfig variable)
* __Note__: These values are in your [Firebase console](https://console.firebase.google.com/) -> Project settings -> Config

8. Use the following command to test locally
```sh
firebase serve -o 0.0.0.0
```

9. Use this command to deploy your Firebase project to the cloud
```sh
firebase deploy
```

10. To view your database go to your [Firebase console](https://console.firebase.google.com/) -> Database

11. The first time you enter the application the __game__ collection is going to be created with the __settings__ document and default values.


