import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";

/**
 * react-hook-form + zod ile tip güvenli form hook'u.
 *
 * @example
 * const schema = z.object({ email: z.string().email(), name: z.string().min(1) });
 * const form = useFormWithZod(schema, { defaultValues: { email: "", name: "" } });
 */
export function useFormWithZod<TSchema extends z.ZodType>(
  schema: TSchema,
  // @ts-expect-error Zod 4 + react-hook-form FieldValues uyumsuzluğu
  options?: Parameters<typeof useForm<z.infer<TSchema>>>[0]
) {
  type Output = z.infer<TSchema>;
  // Zod 4 ile @hookform/resolvers arasında tip uyumsuzluğu var; runtime doğru çalışır
  // @ts-expect-error Zod 4 + react-hook-form FieldValues uyumsuzluğu
  return useForm<Output>({
    resolver: zodResolver(schema as any),
    ...options,
  });
}
