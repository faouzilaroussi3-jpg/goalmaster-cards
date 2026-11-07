/** Quiz foot: rules mirrored from the SQL (_quiz_next / start_quiz). */
export const QUIZ_SECONDS = 60;

export type QuizFormat = "text" | "photo_words" | "image_choice";
export function quizFormat(number: number): QuizFormat {
  return (["text", "photo_words", "image_choice"] as const)[Math.max(0, number - 1) % 3] ?? "text";
}

/**
 * Points for a correct answer. Question rarity is drawn with the Classique pack rates;
 * d = rarity position among those rarities (0 = Commune, 1 = rarest). Rarer = easier = fewer points.
 */
export function quizPoints(d: number): number {
  return 10 - Math.round(8 * Math.min(1, Math.max(0, d)));
}

/** Number of answer choices: hard questions get 4 close options, the rarest only 2. */
export function quizOptionCount(d: number): number {
  return d < 0.75 ? 4 : d < 0.95 ? 3 : 2;
}

/** Seconds left, clamped, using the server clock offset. */
export function quizSecondsLeft(endsAt: string, offsetMs: number, now = Date.now()): number {
  return Math.max(0, Math.ceil((new Date(endsAt).getTime() - (now + offsetMs)) / 1000));
}

export interface QuizQuestion {
  number: number;
  prompt: string;
  options: string[];
  rarity: string;
  label: string;
  color: string | null;
  points: number;
  format?: QuizFormat;
  image_url?: string;
  image_options?: { value: string; image_url: string }[];
}
