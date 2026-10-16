import type { RoomSettings } from '@rene/contracts';

export interface WordPair {
  readonly id: string;
  readonly a: string;
  readonly b: string;
  readonly category: Exclude<RoomSettings['category'], 'all'>;
  readonly difficulty: Exclude<RoomSettings['difficulty'], 'all'>;
  /** Editorial evidence, kept exclusively on the server. */
  readonly clueAxes?: readonly string[];
}
