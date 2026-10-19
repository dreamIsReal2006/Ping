/**
 * Haptic Vibration Controller for "Ping".
 * Designed to provide sensory decompression feedback matching mobile X-axis and Z-axis linear motors.
 * Supports Navigator.vibrate API, customizable vibration patterns, and visual screen-shake fallback.
 */

export type HapticMode = 'dual_axis' | 'z_axis_sharp' | 'x_axis_deep' | 'off';

class HapticEngine {
  private mode: HapticMode = 'dual_axis';
  private enabled: boolean = true;
  private onVisualShakeCallback: ((intensity: number) => void) | null = null;

  public setMode(mode: HapticMode) {
    this.mode = mode;
  }

  public getMode(): HapticMode {
    return this.mode;
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.enabled && this.mode !== 'off';
  }

  public setVisualShakeCallback(callback: ((intensity: number) => void) | null) {
    this.onVisualShakeCallback = callback;
  }

  public hasNativeSupport(): boolean {
    return typeof navigator !== 'undefined' && 'vibrate' in navigator;
  }

  /**
   * Hit feedback - modeled for mobile linear resonant actuators
   */
  public triggerHit(judgment: 'PERFECT' | 'GREAT' | 'GOOD' = 'PERFECT') {
    if (!this.enabled || this.mode === 'off') return;

    const hasVibe = this.hasNativeSupport();

    if (hasVibe) {
      try {
        if (this.mode === 'z_axis_sharp') {
          // Sharp, crisp 12ms pulse - mimics Z-axis linear solenoid impact
          const duration = judgment === 'PERFECT' ? 14 : judgment === 'GREAT' ? 10 : 8;
          navigator.vibrate(duration);
        } else if (this.mode === 'x_axis_deep') {
          // Deeper 24ms pulse with slight follow-through resonance
          const duration = judgment === 'PERFECT' ? [26] : [18];
          navigator.vibrate(duration);
        } else {
          // Dual-Axis Dynamic Simulation:
          // Quick sharp micro-pulse (Z-axis click) followed immediately by a subtle lingering resonance (X-axis follow-through)
          if (judgment === 'PERFECT') {
            navigator.vibrate([12, 14, 18]);
          } else if (judgment === 'GREAT') {
            navigator.vibrate([10, 15, 12]);
          } else {
            navigator.vibrate([8]);
          }
        }
      } catch {
        // Safe catch for browser gesture restrictions
      }
    }

    // Trigger visual screen kick for visual weight (essential for 60fps tactile feeling)
    if (this.onVisualShakeCallback) {
      const shakePower = judgment === 'PERFECT' ? 5 : judgment === 'GREAT' ? 3.5 : 2;
      this.onVisualShakeCallback(shakePower);
    }
  }

  /**
   * Double-tap burst for multi-ring circles
   */
  public triggerDoubleTap() {
    if (!this.enabled || this.mode === 'off') return;

    if (this.hasNativeSupport()) {
      try {
        navigator.vibrate([15, 20, 25]);
      } catch {
        // Safe catch
      }
    }

    if (this.onVisualShakeCallback) {
      this.onVisualShakeCallback(6);
    }
  }

  /**
   * Miss / Game Over warning vibration
   */
  public triggerMiss() {
    if (!this.enabled || this.mode === 'off') return;

    if (this.hasNativeSupport()) {
      try {
        navigator.vibrate([35, 45, 50, 45, 60]);
      } catch {
        // Safe catch
      }
    }

    if (this.onVisualShakeCallback) {
      this.onVisualShakeCallback(9);
    }
  }

  /**
   * Test current vibration profile for user preview
   */
  public testVibration(mode: HapticMode) {
    if (mode === 'off') return;
    if (this.hasNativeSupport()) {
      try {
        if (mode === 'z_axis_sharp') {
          navigator.vibrate([14]);
        } else if (mode === 'x_axis_deep') {
          navigator.vibrate([26]);
        } else {
          navigator.vibrate([12, 14, 18]);
        }
      } catch {
        // Safe catch
      }
    }
    if (this.onVisualShakeCallback) {
      this.onVisualShakeCallback(4);
    }
  }
}

export const hapticManager = new HapticEngine();
