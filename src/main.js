import { CANVAS_W, CANVAS_H } from './constants.js';
import CampaignMapScene from './scenes/CampaignMapScene.js';
import LevelScene from './scenes/LevelScene.js';

const config = {
  type: Phaser.AUTO,
  width: CANVAS_W,
  height: CANVAS_H,
  parent: 'game-container',
  backgroundColor: '#1a1a2e',
  scene: [CampaignMapScene, LevelScene],
  antialias: true,
};

new Phaser.Game(config);
