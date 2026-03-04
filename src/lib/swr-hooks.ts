/**
 * SWR hook yardımcıları
 * useSWR ile cache, dedupe ve background revalidation
 */

import useSWR, { type SWRConfiguration, type SWRResponse } from "swr";
import { fetcher } from "./swr-fetcher";

/** Varsayılan fetcher ile useSWR - API verisi çekmek için */
export function useApiData<T>(
  url: string | null,
  config?: SWRConfiguration<T>
): SWRResponse<T> {
  return useSWR<T>(url, fetcher, {
    revalidateOnFocus: false,
    ...config,
  });
}
