import { readFile, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const carDexSource = await readFile(resolve(root, 'assets/cars/cardeck.js'), 'utf8');
const context = { window: {} };
runInNewContext(carDexSource, context);
const cars = context.window.RT_CARDEX.cars;
assert.equal(cars.length, 38, 'expansion has 38 separate model/paint variants');
assert.deepEqual(Array.from(cars, car => car.id), Array.from({ length: 38 }, (_, i) => 37 + i), 'new IDs are sequential and preserve old IDs');
assert.equal(new Set(cars.map(car => car.name)).size, cars.length, 'vehicle names are unique');
assert.equal(new Set(cars.map(car => car.slug)).size, cars.length, 'sprite paths are unique');

const assets = new Set(await readdir(resolve(root, 'assets/cars/cardex')));
for (const car of cars) {
  assert.ok(context.window.RT_CARDEX.profiles[car.detail], `${car.name} has a race profile`);
  const file = `${car.slug}.png`;
  assert.ok(assets.has(file), `${car.name} has an individual local PNG sprite`);
  const png = await readFile(resolve(root, 'assets/cars/cardex', file));
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${car.name} is a valid PNG`);
  assert.ok(png.readUInt32BE(16) === 200 && png.readUInt32BE(20) === 145, `${car.name} sprite has sufficient resolution`);
  assert.equal(png[25], 6, `${car.name} sprite supports transparent RGBA pixels`);
}

const html = await readFile(resolve(root, 'index.html'), 'utf8');
const registryText = html.slice(html.indexOf('const SP='), html.indexOf('const DEV_MODE'));
const registryContext = { window: context.window };
runInNewContext(`${registryText}\nglobalThis.registryCount=SP.length;globalThis.registry=SP;`, registryContext);
assert.equal(registryContext.registryCount, 75, 'original registry plus new cars is 75');
assert.equal(registryContext.registry[26].n, 'BMW M3 GTR (Most Wanted)');
assert.equal(registryContext.registry[32].n, 'Nissan Skyline GT-R R34 (Brian)');
assert.equal(registryContext.registry[23].n, 'Tesla Cybertruck', 'trash-can artwork keeps the Tesla Cybertruck name');
for (const file of ['trash-can.png', 'smg-apex-gtx.png', 'smg-formula-x.png', 'nightfall-tumbler.png']) {
  const png = await readFile(resolve(root, 'assets/cars', file));
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${file} is a valid PNG`);
  assert.equal(png.readUInt32BE(16), 200);
  assert.equal(png.readUInt32BE(20), 145);
  assert.equal(png[25], 6, `${file} supports transparent RGBA pixels`);
}
assert.ok(html.includes("SPRITE_DATA['23']='assets/cars/trash-can.png'"));
assert.ok(html.includes("SPRITE_DATA['21']='assets/cars/nightfall-tumbler.png'"));
assert.ok(html.includes("SPRITE_DATA['35']='assets/cars/smg-apex-gtx.png'"));
assert.ok(html.includes("SPRITE_DATA['36']='assets/cars/smg-formula-x.png'"));

const cupsStart = html.indexOf('const CAR_CUPS=') + 'const CAR_CUPS='.length;
const startCupHandler = html.indexOf('function startCarCup', cupsStart);
const cupsEnd = html.lastIndexOf('];', startCupHandler) + 1;
assert.ok(cupsStart >= 'const CAR_CUPS='.length && cupsEnd > cupsStart, 'collector chapters exist');
const cups = runInNewContext(`(${html.slice(cupsStart, cupsEnd)})`);
assert.equal(cups.length, 8, 'eight story championships are defined');
const rewards = cups.flatMap(cup => cup.reward);
assert.equal(new Set(rewards).size, 38, 'each new car is awarded once');
assert.deepEqual(Array.from(rewards).sort((a,b) => a-b), Array.from(cars, car => car.id), 'chapter rewards cover all added cars');
assert.match(html.slice(startCupHandler, startCupHandler + 180), /i>0&&!G\.f\['cardex_cup_'/, 'later chapters require the previous chapter');
const score = await readFile(resolve(root, 'netlify/functions/score.mjs'), 'utf8');
assert.match(score, /slice\(0, 75\)/);
assert.match(score, /car\.i < 75/);
assert.match(score, /i < 75/);
assert.match(html, /function showroomMap\(/, 'Garage has a walkable showroom floor');
assert.match(html, /function showroomTalk\(/, 'salesman can open the car catalogue');
assert.match(html, /function showroomPurchase\(/, 'salesman can complete car purchases');
assert.match(html, /topSpeed=c=>/, 'cars have a computed top-speed stat');
assert.match(html, /function showroomPurchase\(/, 'salesman showroom supports direct purchases');
assert.match(html, /onclick="showroomMap\(\)">Enter Showroom Map/, 'Garage opens the walkable showroom');
assert.match(html, /SHOWROOM_DISPLAY=\[32,33,26,28,24,18\]/, 'showroom floor displays six road cars');
assert.match(html, /assets\/cars\/cardex\/'\+car\.slug\+'\.png/, 'the showroom points to model-specific PNGs');
console.log('CarDex checks passed: 75 total cars, 38 transparent PNG sprites, 8 sequential story championships, and leaderboard limits updated.');
