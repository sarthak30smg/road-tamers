import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const context = { window: {} };
runInNewContext(await readFile(resolve(root, 'assets/cars/cardeck.js'), 'utf8'), context);
const output = resolve(root, 'assets/cars/cardex');
await mkdir(output, { recursive: true });
for (const car of context.window.RT_CARDEX.cars) {
  const svg = context.window.RT_CARDEX.svg(car, car.color);
  await writeFile(resolve(output, `${car.slug}.svg`), svg, 'utf8');
}
console.log(`Generated ${context.window.RT_CARDEX.cars.length} transparent CarDex SVG sprites in ${output}`);
