/**
 * Image compression utilities for reducing upload size
 */

/**
 * Compress image to reduce file size
 */
export async function compressImage(
  file: File,
  maxWidth: number = 1920,
  maxHeight: number = 1920,
  quality: number = 0.85,
  maxSizeKB: number = 500
): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = width * ratio;
          height = height * ratio;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }

            // If still too large, reduce quality further
            if (blob.size > maxSizeKB * 1024 && quality > 0.5) {
              canvas.toBlob(
                (smallerBlob) => {
                  if (!smallerBlob) {
                    resolve(new File([blob], file.name, { type: file.type }));
                    return;
                  }
                  resolve(new File([smallerBlob], file.name, { type: file.type }));
                },
                file.type,
                quality * 0.7
              );
            } else {
              resolve(new File([blob], file.name, { type: file.type }));
            }
          },
          file.type,
          quality
        );
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Convert file to base64 with compression
 */
export async function fileToBase64(
  file: File,
  compress: boolean = true
): Promise<string> {
  let processedFile = file;

  if (compress && file.type.startsWith('image/')) {
    try {
      processedFile = await compressImage(file);
    } catch (error) {
      console.warn('Image compression failed, using original:', error);
    }
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix if present
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(processedFile);
  });
}

/**
 * Check if image needs compression
 */
export function shouldCompressImage(file: File, maxSizeKB: number = 500): boolean {
  return file.size > maxSizeKB * 1024 && file.type.startsWith('image/');
}

