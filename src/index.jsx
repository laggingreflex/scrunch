import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import Markdown from 'react-markdown';
import ReadMe from '../README.md?raw';

/**
 * Removes rows of mostly uniform color from images, effectively scrunching images with text or screenshots to reduce vertical space. Ideal for sharing on mobile, where conserving screen real estate is crucial, it visually compresses images while maintaining key information.
 */

let timeout;
const root = createRoot(document.getElementById('app') || document.body);
root.render(<App />);

/* Components */

function App() {
  const [inputImageBuffer, setInputImageBuffer] = useState(null);
  const [outputImageBlob, setOutputImageBlob] = useState(null);
  const [maxDifferentPixels, setMaxDifferentPixels] = useState(5);


  useEffect(() => {
    if (!inputImageBuffer) return;
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      processImage(inputImageBuffer, maxDifferentPixels)
        .then((blob) => {
          setOutputImageBlob(
            URL.createObjectURL(blob)
          );
        })
        .catch((error) => {
          console.error('Error processing image:', error);
        });
    }, 333);
  }, [inputImageBuffer, maxDifferentPixels]);

  return (
    <div
      className={['app', 'loading']
        .filter(Boolean)
        .join(' ')}
    >
      <h1>Scrunch</h1>
      <Markdown>{ReadMe}</Markdown>
      <form>
        <input
          placeholder='Upload an image'
          type="file"
          accept=".png,.jpg,.jpeg,.gif,.webp"
          onChange={async e => {
            const file = e.target.files[0];
            if (!file) return;
            const contents = await readFileFromInput(file);
            console.log(contents);
            setInputImageBuffer(contents);
          }}
        ></input>
        {/* <input type="text" placeholder="File URL" onChange={onInput} ></input> */}
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          defaultValue="5"
          onChange={(e) => setMaxDifferentPixels(Number(e.target.value))}
        ></input>
      </form>
      {outputImageBlob && (
        <div className='output' >
          <h3>Processed Image:</h3>
          <img src={outputImageBlob} alt="Processed output"
            onClick={() => triggerDownload(outputImageBlob, 'processed-image.png')}
          />
        </div>
      )}
    </div>
  );

  async function onInput() {
    const file = refFile.current.files[0];
    if (!file) return;
    const contents = await readFileFromInput(file);
    console.log(contents);
    const processedImage = await processImage(contents, maxDifferentPixels);
    console.log(processedImage);

    // Create a URL for the processed image and display it in an <img> tag
    const processedImageUrl = URL.createObjectURL(processedImage);
    setProcessedImageUrl(processedImageUrl);
  }
}

/* Helpers */

/**
 * Processes the image to remove rows that have very few different pixels.
 *
 * @param {ArrayBuffer} imageBuffer - The image file buffer.
 * @param {number} maxDifferentPixels - The threshold for the number of different pixels to consider a row non-blank.
 * @param {number} quantizationFactor - Factor to reduce color depth for pixel comparison.
 * @returns {Promise<Blob>} - Processed image Blob with blank rows removed.
 */
export async function processImage(imageBuffer, maxDifferentPixels = 10, quantizationFactor = 16) {
  try {
    // Create a canvas to draw the image and process it
    const img = await loadImageFromBuffer(imageBuffer);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = img.width;
    canvas.height = img.height;

    // Draw the image onto the canvas
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { width, height } = canvas;
    const data = imageData.data;
    const channels = 4; // RGBA

    let nonBlankRows = [];

    // Iterate over rows
    for (let y = 0; y < height; y++) {
      let uniquePixels = new Set();
      const rowStart = y * width * channels;

      for (let x = 0; x < width; x++) {
        const pixelStart = rowStart + x * channels;

        // Quantize and pack pixel values into a single integer
        let pixelValue = 0;
        for (let c = 0; c < channels - 1; c++) { // Exclude alpha channel
          const value = Math.floor(data[pixelStart + c] / quantizationFactor); // Quantize
          pixelValue = (pixelValue << 4) | value; // Pack into integer
        }
        uniquePixels.add(pixelValue);

        if (uniquePixels.size > maxDifferentPixels) {
          break; // No need to check further if threshold is exceeded
        }
      }

      // If the row is not blank, add it to nonBlankRows
      if (uniquePixels.size > maxDifferentPixels) {
        const rowEnd = rowStart + width * channels;
        for (let i = rowStart; i < rowEnd; i++) {
          nonBlankRows.push(data[i]);
        }
      }
    }

    // Create a new canvas for the processed image
    const newCanvas = document.createElement('canvas');
    const newCtx = newCanvas.getContext('2d');

    const newHeight = nonBlankRows.length / (width * channels);
    newCanvas.width = width;
    newCanvas.height = newHeight;

    // Create new image data and populate with non-blank rows
    const newImageData = newCtx.createImageData(width, newHeight);
    newImageData.data.set(new Uint8ClampedArray(nonBlankRows));

    // Draw the processed image onto the new canvas
    newCtx.putImageData(newImageData, 0, 0);

    // Convert the canvas to a Blob to prepare for output
    return new Promise((resolve) => {
      newCanvas.toBlob((blob) => resolve(blob), 'image/png');
    });
  } catch (error) {
    console.error('Error processing image:', error);
    throw error;
  }
}

/* Utils */

function readFileFromInput(file) {
  const reader = new FileReader();
  const contentsPromise = new Promise((resolve, reject) => {
    reader.onload = (e) => resolve(e.target?.result);
    reader.onerror = (e) => reject(e.target?.error);
  });
  reader.readAsArrayBuffer(file);
  return contentsPromise;
}

function loadImageFromBuffer(buffer) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([buffer]);
    const url = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url); // Clean up URL object
      resolve(img);
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };

    img.src = url;
  });
}

function triggerDownload(blob, filename) {
  const link = document.createElement('a');
  link.href = blob;
  link.download = `processed-${filename}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
