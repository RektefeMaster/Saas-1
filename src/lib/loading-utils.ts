/**
 * Loading utility fonksiyonları
 * API çağrıları ve async işlemler için kullanışlı helper'lar
 */

import { useLoadingContext } from "./loading-context";


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
