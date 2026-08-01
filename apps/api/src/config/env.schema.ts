import { z } from 'zod';

export const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8787),
  GATEWAY_TOKEN: z.string().min(1).default('dev-token'),
  PROVIDER: z.string().min(1).default('claude'),
  MODEL: z.string().min(1).default('claude-sonnet-5'),
  ANTHROPIC_API_KEY: z.string().optional(),
  // Root directory holding one git-backed workspace per project (ADR 0001).
  WORKSPACE_ROOT: z.string().min(1).default('./data/workspaces'),
});

export type Env = z.infer<typeof EnvSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = EnvSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment:\n${issues}`);
  }
  return parsed.data;
}
