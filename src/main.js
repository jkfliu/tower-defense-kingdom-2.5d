import { CANVAS_W, CANVAS_H, DEV_MODE } from './constants.js';
import CampaignMapScene from './scenes/CampaignMapScene.js';
import LevelScene from './scenes/LevelScene.js';

const params   = new URLSearchParams(window.location.search);
const devLevel = DEV_MODE ? parseInt(params.get('level'), 10) : NaN;
const jumpLevel = Number.isFinite(devLevel) ? devLevel - 1 : null;

const config = {
  type: Phaser.AUTO,
  width: CANVAS_W,
  height: CANVAS_H,
  parent: 'game-container',
  backgroundColor: '#1a1a2e',
  scene: [CampaignMapScene, LevelScene],
  antialias: true,
  callbacks: {
    postBoot(game) {
      if (jumpLevel !== null) {
        game.scene.stop('CampaignMapScene');
        game.scene.start('LevelScene', { levelId: jumpLevel });
      }
    },
  },
};

new Phaser.Game(config);

if (DEV_MODE) {
  document.getElementById('info-dev').style.display = 'inline';
}
