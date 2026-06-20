import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.talkboard.app",
  appName: "Talk Board",
  // Capacitor bundles whatever is in this folder as the app's web content.
  webDir: "public",
  backgroundColor: "#F2F6F8",
  ios: {
    contentInset: "always"
  },
  android: {
    // allows the mic + audio playback to work in the WebView
    allowMixedContent: false
  }
};

export default config;
