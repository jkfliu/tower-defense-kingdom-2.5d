import { CANVAS_W, CANVAS_H } from './constants.js';
import GameScene from './scenes/GameScene.js';

const config = {
  type: Phaser.AUTO,
  width: CANVAS_W,
  height: CANVAS_H,
  parent: 'game-container',
  backgroundColor: '#1a1a2e',
  scene: GameScene,
  antialias: true,
};

new Phaser.Game(config);
