import { z } from 'zod';

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8787),
  GATEWAY_TOKEN: z.string().min(1).default('dev-token'),
  PROVIDER: z.string().min(1).default('claude'),
  PLANNER_MODEL: z.string().min(1).default('claude-sonnet-5'),
  WRITER_MODEL: z.string().min(1).default('claude-sonnet-5'),
  // Optional in chunk 1 (logic is stubbed). Required once the AI SDK lands.
  ANTHROPIC_API_KEY: z.string().optional(),
});

export type Config = z.infer<typeof EnvSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid gateway environment:\n${issues}`);
  }
  return parsed.data;
}
