import { cp, mkdir, writeFile } from "node:fs/promises";

const root = new URL("../github-pages-dist/", import.meta.url);
const index = new URL("index.html", root);

for (const route of ["join", "host", "archive", "1012", "host/1012"]) {
  const directory = new URL(`${route}/`, root);
  await mkdir(directory, { recursive: true });
  await cp(index, new URL("index.html", directory));
}

await cp(index, new URL("404.html", root));
await writeFile(new URL(".nojekyll", root), "", "utf8");

await mkdir(new URL("bottledream/", root), { recursive: true });
await cp(new URL("../bottledream/", import.meta.url), new URL("bottledream/", root), { recursive: true });
