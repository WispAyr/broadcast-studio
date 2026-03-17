/**
 * Lightweight DOM-to-Canvas renderer using SVG foreignObject.
 * Captures a DOM element's visual content into a canvas for WebGL texturing.
 * No external dependencies required.
 */

const CAPTURE_WIDTH = 1920;
const CAPTURE_HEIGHT = 1080;

/**
 * Capture a DOM element to a canvas using SVG foreignObject serialization.
 * Falls back to simple solid-color fill if serialization fails.
 */
export async function captureElementToCanvas(element, targetCanvas) {
  const width = targetCanvas.width || CAPTURE_WIDTH;
  const height = targetCanvas.height || CAPTURE_HEIGHT;
  const ctx = targetCanvas.getContext('2d');

  try {
    // Clone the element to avoid modifying the live DOM
    const clone = element.cloneNode(true);
    clone.style.width = width + 'px';
    clone.style.height = height + 'px';
    clone.style.position = 'absolute';
    clone.style.overflow = 'hidden';

    // Serialize to XML
    const serializer = new XMLSerializer();
    const html = serializer.serializeToString(clone);

    // Build SVG with foreignObject
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <foreignObject width="100%" height="100%">
          ${html}
        </foreignObject>
      </svg>
    `;

    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const img = new Image();
    img.width = width;
    img.height = height;

    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    URL.revokeObjectURL(url);
  } catch {
    // Fallback: draw current computed background
    const bg = getComputedStyle(element).backgroundColor || '#000';
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
  }
}

/**
 * Start a periodic capture loop.
 * Returns a stop function.
 */
export function startCaptureLoop(element, targetCanvas, fps = 10) {
  let running = true;
  let animFrame = null;
  let lastCapture = 0;
  const interval = 1000 / fps;

  const loop = async (timestamp) => {
    if (!running) return;
    if (timestamp - lastCapture >= interval) {
      lastCapture = timestamp;
      try {
        await captureElementToCanvas(element, targetCanvas);
      } catch {
        // Skip frame on error
      }
    }
    animFrame = requestAnimationFrame(loop);
  };

  animFrame = requestAnimationFrame(loop);

  return () => {
    running = false;
    if (animFrame) cancelAnimationFrame(animFrame);
  };
}
