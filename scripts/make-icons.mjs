import sharp from "sharp";
import { readFileSync } from "node:fs";

const src = readFileSync("public/icons/logo-src.png");

async function make(size, out, { pad = 0, bg = "#0f766e", radius = 0 } = {}) {
  const trimmed = await sharp(src).trim().toBuffer();
  const inner = Math.round(size * (1 - pad * 2));
  const resized = await sharp(trimmed)
    .resize({ width: inner, height: inner, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  let base = await sharp({
    create: { width: size, height: size, channels: 4, background: bg },
  })
    .composite([{ input: resized, gravity: "centre" }])
    .png()
    .toBuffer();
  if (radius > 0) {
    const mask = Buffer.from(
      `<svg width="${size}" height="${size}"><rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="#fff"/></svg>`
    );
    base = await sharp(base).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
  }
  await sharp(base).toFile(out);
  console.log("wrote", out);
}

await make(512, "public/icons/icon-512.png", { pad: 0.06 });
await make(192, "public/icons/icon-192.png", { pad: 0.06 });
await make(180, "public/icons/apple-touch-icon.png", { pad: 0.08 });
// app convention icons (Next generates favicons from these)
await make(512, "src/app/icon.png", { pad: 0.06 });
await make(180, "src/app/apple-icon.png", { pad: 0.08 });
