import { render } from "solid-js/web";
import App from "./App.js";
import { initPwa } from "./lib/pwa.js";
import "./index.css";

initPwa();

const root = document.getElementById("app");
if (!root) throw new Error("Root element not found");

render(() => <App />, root);
