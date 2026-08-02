/**
 * Panel modül sıralaması. Ayrı dosya, çünkü kural test edilebilir olmalı:
 * eksik bir `moduleOrder` listesi bir kez Ayarlar'ı ortaya, Gelen Kutusu'nu
 * en alta atmıştı.
 */

/**
 * Sıralama ancak görünen **tüm** modülleri kapsıyorsa uygulanır. Kısmi liste
 * kullanıcı niyeti taşımaz; kapsamayan anahtarları sona atmak menüyü bozar.
 */
export function applyModuleOrder<T extends { key: string }>(
  visible: T[],
  moduleOrder: string[] | null
): T[] {
  if (!moduleOrder || moduleOrder.length === 0) return visible;
  if (!visible.every((item) => moduleOrder.includes(item.key))) return visible;

  const rank = new Map(moduleOrder.map((key, index) => [key, index]));
  return [...visible].sort((a, b) => (rank.get(a.key) ?? 0) - (rank.get(b.key) ?? 0));
}
