import { registerRootComponent } from "expo";

import { App } from "./src/App";

// registerRootComponent calls AppRegistry.registerComponent("main", () => App) and
// keeps the environment correct whether the app is loaded in Expo Go or a native build.
registerRootComponent(App);
