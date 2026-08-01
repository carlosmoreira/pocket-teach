import type { GenerationEvent, GenerationPhase } from '@pocket-teach/api-types';

export type { GenerationEvent, GenerationPhase };

export type EmitGeneration = (event: GenerationEvent) => void;
