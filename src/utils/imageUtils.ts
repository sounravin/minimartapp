/**
 * High-performance client-side image resizing and compression helper.
 * Uses ObjectURL and HTML5 Canvas downsampling to prevent memory crashes 
 * when taking high-resolution photos on iPhone / iOS devices (12MP-48MP images).
 */

export interface ResizeOptions {
  maxDimension?: number; // Maximum width or height in pixels
  quality?: number;      // Compression quality (0.1 to 1.0)
  mimeType?: string;     // Target output mime type (default: image/jpeg)
}

export const compressAndResizeImage = (
  file: File | Blob,
  options: ResizeOptions = {}
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const { maxDimension = 600, quality = 0.8, mimeType = 'image/jpeg' } = options;

    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('Invalid image file provided'));
      return;
    }

    // Use URL.createObjectURL instead of FileReader readAsDataURL to avoid high memory allocation
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      try {
        let { width, height } = img;

        // Calculate downscaled dimensions maintaining aspect ratio
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Failed to get 2D context from canvas'));
          return;
        }

        // Apply smooth downscaling rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Draw downscaled image onto canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Convert canvas to optimized Data URL
        const compressedDataUrl = canvas.toDataURL(mimeType, quality);

        // Clean up object URL memory in iOS WebKit immediately
        URL.revokeObjectURL(objectUrl);

        resolve(compressedDataUrl);
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image for compression'));
    };

    img.src = objectUrl;
  });
};
