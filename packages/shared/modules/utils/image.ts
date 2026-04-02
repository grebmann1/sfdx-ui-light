/**
 * Compress an image data URL by resizing and re-encoding it.
 *
 * @param {string} imageDataUrl
 * @param {{ scale?: number, quality?: number, format?: string }} [options]
 * @returns {Promise<{ dataUrl: string, mimeType: string }>}
 */
export async function compressImage(
    imageDataUrl: string,
    options: { scale?: number; quality?: number; format?: string } = {
        scale: 1.0,
        quality: 0.8,
        format: 'image/jpeg',
    }
): Promise<{ dataUrl: string; mimeType: string }> {
    const { scale = 1.0, quality = 0.8, format = 'image/jpeg' } = options;
    const normalizedScale = Number.isFinite(scale) && scale > 0 ? scale : 1.0;
    const normalizedQuality =
        Number.isFinite(quality) && quality >= 0 && quality <= 1 ? quality : 0.8;

    const image = await loadImage(imageDataUrl);
    const width = Math.max(1, Math.round(image.naturalWidth * normalizedScale));
    const height = Math.max(1, Math.round(image.naturalHeight * normalizedScale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error('Failed to get 2D context for image compression');
    }

    context.drawImage(image, 0, 0, width, height);
    const dataUrl = canvas.toDataURL(format, normalizedQuality);
    return { dataUrl, mimeType: format };
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Failed to load image for compression'));
        image.src = src;
    });
}
