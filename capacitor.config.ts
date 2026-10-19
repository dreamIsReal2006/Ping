import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ping.rhythm',
  appName: 'Ping',
  webDir: 'dist',
  backgroundColor: '#050508',
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 0,
      backgroundColor: '#050508',
      showSpinner: false,
    },
    StatusBar: {
      overlaysWebView: false,
      backgroundColor: '#050508',
      style: 'LIGHT',
    },
  },
};

export default config;
