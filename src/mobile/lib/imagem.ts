// src/mobile/lib/imagem.ts
// Redimensiona uma imagem (foto do comprovante) no cliente antes de subir,
// para não pesar no 4G. Retorna um Blob JPEG (~maxLado px, qualidade 0.7).
export async function resizeImage(file: File, maxLado = 1280, quality = 0.7): Promise<Blob> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });
  let { width, height } = img;
  if (width > maxLado || height > maxLado) {
    if (width >= height) { height = Math.round(height * (maxLado / width)); width = maxLado; }
    else { width = Math.round(width * (maxLado / height)); height = maxLado; }
  }
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Falha ao processar imagem'))), 'image/jpeg', quality));
}
