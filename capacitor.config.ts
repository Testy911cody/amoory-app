import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.talkboard.app",
  appName: "Talk Board",
  webDir: "dist",
  backgroundColor: "#F2F6F8",
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      backgroundColor: "#2E8C8C",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#2E8C8C"
    }
  },
  ios: {
    contentInset: "always"
  },
  android: {
    allowMixedContent: false
  }
};

export default config;
