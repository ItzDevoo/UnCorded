import { build } from "esbuild";
import { createRequire } from "module";
import { dirname } from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

// Resolve the exact paths for top-level react packages to guarantee
// all transitive imports resolve to the SAME files (no duplicates).
const reactResolves = {};
for (const pkg of [
  "react",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "react-dom",
  "react-dom/client",
]) {
  try {
    reactResolves[pkg] = require.resolve(pkg);
  } catch {
    // jsx-dev-runtime may not exist in prod
  }
}

await build({
  entryPoints: ["src/excalidraw-entry.ts"],
  bundle: true,
  format: "esm",
  outfile: "public/excalidraw-bundle.js",
  minify: true,
  define: {
    "process.env.NODE_ENV": '"production"',
  },
  plugins: [
    {
      name: "react-singleton",
      setup(buildCtx) {
        // Force every import of react/react-dom to the top-level install
        buildCtx.onResolve({ filter: /^react(-dom)?(\/.*)?$/ }, (args) => {
          const resolved = reactResolves[args.path];
          if (resolved) {
            return { path: resolved };
          }
          return null;
        });
      },
    },
  ],
});

console.log("Client bundle built → public/excalidraw-bundle.js");
