import { GAME_W, GAME_H, DEV_MODE } from './constants.js';
import CampaignMapScene from './scenes/CampaignMapScene.js';
import LevelScene from './scenes/LevelScene.js';

const params   = new URLSearchParams(window.location.search);
const devLevel = DEV_MODE ? parseInt(params.get('level'), 10) : NaN;
const jumpLevel = Number.isFinite(devLevel) ? devLevel - 1 : null;

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: '#1a1a2e',
  scene: [CampaignMapScene, LevelScene],
  antialias: true,
  // Responsive: the fixed GAME_W×GAME_H design scales to fit the viewport,
  // preserving aspect ratio (letterboxed). Pointer coords stay in design space, so
  // input math is unaffected.
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_W,
    height: GAME_H,
  },
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
