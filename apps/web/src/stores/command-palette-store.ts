import { createSignal } from "solid-js";

const [commandPaletteOpen, setCommandPaletteOpen] = createSignal(false);

export { commandPaletteOpen, setCommandPaletteOpen };
