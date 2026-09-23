import { createCanvas } from '@napi-rs/canvas';

const WIDTH = 900;
const HEIGHT = 560;
const MIN_FONT_SIZE = 14;
const MAX_FONT_SIZE = 80;
const WORD_PADDING = 4;
const BACKGROUND = '#2b2d31';
const PALETTE = ['#5865F2', '#EB459E', '#57F287', '#FEE75C', '#ED4245', '#FFFFFF', '#F0B232'];

// Archimedean spiral step: angle grows every attempt, radius grows with it, so
// candidate points move steadily outward from the center in a spiral pattern.
const SPIRAL_ANGLE_STEP = 0.35;
const SPIRAL_RADIUS_STEP = 2.2;
const MAX_SPIRAL_RADIUS = Math.hypot(WIDTH, HEIGHT);

function scaleFontSize(count, minCount, maxCount) {
  if (maxCount === minCount) return (MIN_FONT_SIZE + MAX_FONT_SIZE) / 2;
  const t = (count - minCount) / (maxCount - minCount);
  return MIN_FONT_SIZE + t * (MAX_FONT_SIZE - MIN_FONT_SIZE);
}

function measure(ctx, text, fontSize) {
  ctx.font = `${Math.round(fontSize)}px sans-serif`;
  const metrics = ctx.measureText(text);
  const ascent = metrics.actualBoundingBoxAscent ?? fontSize * 0.8;
  const descent = metrics.actualBoundingBoxDescent ?? fontSize * 0.2;
  return {
    width: metrics.width + WORD_PADDING * 2,
    height: ascent + descent + WORD_PADDING * 2,
  };
}

function overlaps(a, b) {
  return !(
    a.x + a.width / 2 <= b.x - b.width / 2 ||
    a.x - a.width / 2 >= b.x + b.width / 2 ||
    a.y + a.height / 2 <= b.y - b.height / 2 ||
    a.y - a.height / 2 >= b.y + b.height / 2
  );
}

function withinBounds(box) {
  return (
    Math.abs(box.x) + box.width / 2 <= WIDTH / 2 &&
    Math.abs(box.y) + box.height / 2 <= HEIGHT / 2
  );
}

// Finds the first non-colliding, in-bounds spot for `box` by walking an
// outward spiral from the center and testing exact rectangle overlap against
// every word already placed. Returns null if nothing fit before the spiral
// exceeds the canvas — the word is then dropped, same as a normal word cloud
// does when it runs out of room.
function findPosition(box, placed) {
  for (let angle = 0; ; angle += SPIRAL_ANGLE_STEP) {
    const radius = SPIRAL_RADIUS_STEP * angle;
    if (radius > MAX_SPIRAL_RADIUS) return null;

    const candidate = { ...box, x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
    if (!withinBounds(candidate)) continue;
    if (placed.some((other) => overlaps(candidate, other))) continue;
    return candidate;
  }
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
    ctx.font = `${Math.round(word.size)}px sans-serif`;
    ctx.fillStyle = PALETTE[i % PALETTE.length];
    ctx.fillText(word.text, word.x, word.y);
  });

  return canvas.toBuffer('image/png');
}

export function renderWordCloud(rows) {
  const counts = rows.map((row) => row.count);
  const minCount = Math.min(...counts);
  const maxCount = Math.max(...counts);

  // Biggest words get first pick of the best (most central) real estate.
  const sorted = [...rows].sort((a, b) => b.count - a.count);

  const measureCanvas = createCanvas(1, 1);
  const measureCtx = measureCanvas.getContext('2d');

  const placed = [];
  for (const row of sorted) {
    const size = scaleFontSize(row.count, minCount, maxCount);
    const dimensions = measure(measureCtx, row.word, size);
    const position = findPosition(dimensions, placed);
    if (!position) continue; // no room left; drop this word, same as a normal word cloud would

    placed.push({ ...position, text: row.word, size });
  }

  return draw(placed);
}
