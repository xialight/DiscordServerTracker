import cloud from 'd3-cloud';
import { createCanvas } from '@napi-rs/canvas';

const WIDTH = 900;
const HEIGHT = 560;
const MIN_FONT_SIZE = 14;
const MAX_FONT_SIZE = 80;
const BACKGROUND = '#2b2d31';
const PALETTE = ['#5865F2', '#EB459E', '#57F287', '#FEE75C', '#ED4245', '#FFFFFF', '#F0B232'];

function scaleFontSize(count, minCount, maxCount) {
  if (maxCount === minCount) return (MIN_FONT_SIZE + MAX_FONT_SIZE) / 2;
  const t = (count - minCount) / (maxCount - minCount);
  return MIN_FONT_SIZE + t * (MAX_FONT_SIZE - MIN_FONT_SIZE);
}

function draw(placedWords) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.translate(WIDTH / 2, HEIGHT / 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  placedWords.forEach((word, i) => {
    ctx.save();
    ctx.translate(word.x, word.y);
    ctx.rotate((word.rotate * Math.PI) / 180);
    ctx.font = `${Math.round(word.size)}px sans-serif`;
    ctx.fillStyle = PALETTE[i % PALETTE.length];
    ctx.fillText(word.text, 0, 0);
    ctx.restore();
  });

  return canvas.toBuffer('image/png');
}

export function renderWordCloud(rows) {
  const counts = rows.map((row) => row.count);
  const minCount = Math.min(...counts);
  const maxCount = Math.max(...counts);

  const words = rows.map((row) => ({
    text: row.word,
    size: scaleFontSize(row.count, minCount, maxCount),
  }));

  return new Promise((resolve, reject) => {
    cloud()
      .size([WIDTH, HEIGHT])
      .canvas(() => createCanvas(1, 1))
      .words(words)
      .padding(4)
      // d3-cloud's collision masking isn't precise for rotated text with this canvas
      // backend and produces visible overlaps, so keep every word horizontal.
      .rotate(0)
      .font('sans-serif')
      .fontSize((d) => d.size)
      .spiral('archimedean')
      .on('end', (placedWords) => {
        try {
          resolve(draw(placedWords));
        } catch (error) {
          reject(error);
        }
      })
      .start();
  });
}
