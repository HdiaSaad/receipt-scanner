import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ma.oasisnest.screenshotcleaner',
  appName: 'Receipt Scanner',
  webDir: 'dist',
  server: {
    // For local development against local backend
    // Remove for production build
    // url: 'http://192.168.1.x:3000',
    // cleartext: true,
  },
  ios: {
    deploymentTarget: '15.0',
    backgroundColor: '#ffffff',
    contentInset: 'automatic',
    scrollEnabled: true,
  },
  plugins: {
    Camera: {
      presentationStyle: 'popover',
    },
  },
};

export default config;
