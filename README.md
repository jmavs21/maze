# Maze Game

A randomly generated online maze game, that can be play in real time with multiple players.

No need to register, just open the following link on your web browser.

- Link to [Maze Game Demo](https://maze-1987.firebaseapp.com)

![](maze-flow.gif)

## How to play

Goal of the game is to move your player (circle) to the goal (black square).
Move your circle by pressing the buttons in the game or just press arrows/WASD keys.

## Implementation details

The random generation of the maze was implemented using the [randomized Kruskal's algorithm](https://en.wikipedia.org/wiki/Maze_generation_algorithm#Randomized_Kruskal's_algorithm)

With the following tools:

- JavaScript ES6

- [Cloud Firestore](https://firebase.google.com/docs/firestore) from Firebase as a backend demo to record players position and maze settings.

- [HTML5 Canvas](https://www.w3schools.com/html/html5_canvas.asp) for 2D drawing.

- [CSS Grid](https://www.w3schools.com/css/css_grid.asp) for better presentation on desktop and mobile.

## How to use

Follow these instructions if you would like to use the source code for local deployment and testing.

##### Prerequisite: you will need a [Google account](https://accounts.google.com/signup)

1.- Create a new Firebase project

Login to your [Firebase console](https://console.firebase.google.com/) using your Google account, then select **Add project** and follow the on-screen instructions.

2.- Install [Firebase CLI](https://firebase.google.com/docs/cli)

```sh
npm install -g firebase-tools
```

3.- Sign in with your Google account

```sh
firebase login
```

4.- Initialize your [Firebase project](https://firebase.google.com/docs/hosting/quickstart#initialize)

```sh
firebase init
```

**Note**: verify that a **public** folder was created.

5.- Clone the maze repository

```sh
git clone https://github.com/jmavs21/maze.git
```

6.- Move the cloned files to the **public** folder created on Step 4.

7.- Update **index.html** file with your Firebase configuration (firebaseConfig variable)

**Note**: These values are in your [Firebase console](https://console.firebase.google.com/) -> Project -> Project settings -> Firebase SDK snippet -> Config

8.- Use the following command to test locally

```sh
firebase serve -o 0.0.0.0
```

9.- Use this command to deploy your Firebase project to the cloud

```sh
firebase deploy
```

10.- To view the collections go to your [Firebase console](https://console.firebase.google.com/) -> Project -> Cloud Firestore

11.- The first time you start the game the **game** collection is going to be created with the **settings** document default values.
