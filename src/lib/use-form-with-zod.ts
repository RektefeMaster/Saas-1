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
  options?: Parameters<typeof useForm<z.infer<TSchema>>>[0]
) {
  return useForm<z.infer<TSchema>>({
    resolver: zodResolver(schema),
    ...options,
  });
}
