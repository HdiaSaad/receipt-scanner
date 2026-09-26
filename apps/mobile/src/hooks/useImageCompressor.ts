const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 0.8;

export function useImageCompressor() {
  async function compress(base64: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          if (width > height) {
            height = Math.round((height * MAX_DIMENSION) / width);
            width = MAX_DIMENSION;
          } else {
            width = Math.round((width * MAX_DIMENSION) / height);
            height = MAX_DIMENSION;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
        // Strip "data:image/jpeg;base64," prefix
        resolve(dataUrl.split(',')[1]);
      };
      img.onerror = reject;
      img.src = `data:image/jpeg;base64,${base64}`;
    });
  }

  return { compress };
}
