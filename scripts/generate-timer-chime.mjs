import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const sampleRate = 22_050;
const durationSeconds = 0.42;
const frameCount = Math.round(sampleRate * durationSeconds);
const outputPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'timer-ready.wav');
const pcm = Buffer.alloc(frameCount * 2);

function envelope(time, start, duration) {
  if (time < start || time >= start + duration) return 0;
  const local = time - start;
  const attack = Math.min(1, local / 0.012);
  const release = Math.min(1, (duration - local) / 0.045);
  return Math.min(attack, release);
}

for (let frame = 0; frame < frameCount; frame += 1) {
  const time = frame / sampleRate;
  const first = Math.sin(2 * Math.PI * 523.25 * time) * envelope(time, 0.02, 0.20);
  const second = Math.sin(2 * Math.PI * 659.25 * time) * envelope(time, 0.14, 0.23);
  const sample = Math.max(-1, Math.min(1, (first + second) * 0.13));
  pcm.writeInt16LE(Math.round(sample * 32_767), frame * 2);
}

const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + pcm.length, 4);
header.write('WAVE', 8);
header.write('fmt ', 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(1, 22);
header.writeUInt32LE(sampleRate, 24);
header.writeUInt32LE(sampleRate * 2, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write('data', 36);
header.writeUInt32LE(pcm.length, 40);

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, Buffer.concat([header, pcm]));
console.log(`Wrote ${outputPath} (${44 + pcm.length} bytes)`);
