import { Capacitor, registerPlugin } from "@capacitor/core";
import { Style } from "@capacitor/status-bar";

const SplashScreen = registerPlugin("SplashScreen");
const StatusBar = registerPlugin("StatusBar");
const App = registerPlugin("App");

/** Close topmost open panel, or exit app on Android back. */
function handleBackButton() {
  const panels = [...document.querySelectorAll(".panel:not([hidden])")];
  if (panels.length) {
    const closeBtn = panels[panels.length - 1].querySelector(".icon-btn[id$='Close']");
    if (closeBtn) closeBtn.click();
    return;
  }
  if (Capacitor.getPlatform() === "android") {
    App.minimizeApp?.() ?? App.exitApp?.();
  }
}

export async function initNativeShell() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    if (Capacitor.getPlatform() === "android") {
      await StatusBar.setBackgroundColor({ color: "#2E8C8C" });
    }
    await StatusBar.setStyle({ style: Style.Light });
    await SplashScreen.hide();
  } catch {
    /* plugins optional on web preview builds */
  }

  App.addListener("backButton", () => handleBackButton());
}
