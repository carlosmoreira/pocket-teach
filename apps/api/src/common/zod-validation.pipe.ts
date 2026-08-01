import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

// Validate a request body against a zod schema (shared with the frontend via
// api-types), keeping the wire contract from forking into class-validator DTOs.
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({ error: 'invalid request body', issues: result.error.issues });
    }
    return result.data;
  }
}
