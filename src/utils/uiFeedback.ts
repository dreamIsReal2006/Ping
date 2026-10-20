import { soundManager } from './audio';
import { hapticManager } from './haptics';

export const playButtonFeedback = () => {
  soundManager.startMusic();
  soundManager.playButton();
  hapticManager.triggerUi();
};
