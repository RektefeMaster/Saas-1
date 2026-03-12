/**
 * Loading utility fonksiyonları
 * API çağrıları ve async işlemler için kullanışlı helper'lar
 */

import { useLoadingContext } from "./loading-context";

/**
 * API çağrısı yaparken otomatik loading yönetimi
 */
export async function withLoading<T>(
  fn: () => Promise<T>,
  message?: string,
  onProgress?: (progress: number) => void
): Promise<T> {
  // Bu fonksiyon component dışında kullanılamaz, sadece örnek
  // Gerçek kullanım için useLoadingContext hook'unu kullanın
  try {
    if (onProgress) {
      onProgress(10);
    }
    const result = await fn();
    if (onProgress) {
      onProgress(100);
    }
    return result;
  } catch (error) {
    if (onProgress) {
      onProgress(0);
    }
    throw error;
  }
}

/**
 * Örnek: Component içinde kullanım
 * 
 * ```tsx
 * import { useLoading } from "@/components/ui";
 * 
 * function MyComponent() {
 *   const { startLoading, stopLoading, setProgress, setMessage } = useLoading();
 * 
 *   const handleSubmit = async () => {
 *     startLoading("Form gönderiliyor...");
 *     try {
 *       setProgress(30);
 *       const data = await fetchData();
 *       setProgress(60);
 *       await processData(data);
 *       setProgress(100);
 *       stopLoading();
 *     } catch (error) {
 *       stopLoading();
 *       // Hata yönetimi
 *     }
 *   };
 * 
 *   return <button onClick={handleSubmit}>Gönder</button>;
 * }
 * ```
 */
