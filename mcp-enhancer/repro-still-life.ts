// Repro (Say Ahhh): a studio still life at 9:16 stays a still life (no people, no room).
import fs from 'node:fs/promises';
import { generateForFrame } from '../lib/generate';
const out = process.argv[2] ?? '.qa';
const prompt = 'Studio still life, no people: a giant glossy sculpted mouth prop in deep royal blue lacquer, opened extremely wide vertically like saying "ahhh", upper and lower rows of glossy white teeth, a large smooth dark navy interior between them. Centered in the upper two thirds, filling the width, on a seamless saturated royal blue backdrop that fills the whole frame. Soft overhead light, crisp specular highlights.';
for (let i = 1; i <= 2; i++) {
  const png = await generateForFrame({ prompt, width: 1080, height: 1920, copySpace: 'bottom' });
  await fs.writeFile(`${out}/still-life-${i}.png`, png);
  console.log('saved', `${out}/still-life-${i}.png`);
}
