import { soundManager } from './audio';
import { hapticManager } from './haptics';

export const playButtonFeedback = () => {
  soundManager.resumeMusic();
  soundManager.playButton();
  hapticManager.triggerUi();
};
