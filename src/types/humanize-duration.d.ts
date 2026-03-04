declare module "humanize-duration" {
  interface HumanizerOptions {
    language?: string;
    largest?: number;
    round?: boolean;
    units?: string[];
    [key: string]: unknown;
  }
  type HumanizerFn = (ms: number, options?: Record<string, unknown>) => string;
  interface HumanizeDuration extends HumanizerFn {
    humanizer: (options?: HumanizerOptions) => HumanizerFn;
    getSupportedLanguages: () => string[];
  }
  const humanizeDuration: HumanizeDuration;
  export = humanizeDuration;
}
