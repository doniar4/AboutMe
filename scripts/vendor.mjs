// Keep static hosting independent of npm and third-party script CDNs.
import { copyFile, mkdir } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
await mkdir(new URL('vendor/', root), { recursive: true });
for (const file of ['gsap.min.js']) {
  await copyFile(new URL(`node_modules/gsap/dist/${file}`, root), new URL(`vendor/${file}`, root));
}
