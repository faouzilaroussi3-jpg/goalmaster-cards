import { describe, expect, it } from "vitest";
import { quizFormat, quizOptionCount, quizPoints, quizSecondsLeft, QUIZ_SECONDS } from "@/lib/quiz";

describe("quiz rules", () => {
  it("lasts one minute", () => expect(QUIZ_SECONDS).toBe(60));
  it("alternates words, a photo with words and image choices", () => {
    expect([1, 2, 3, 4, 5, 6].map(quizFormat)).toEqual([
      "text", "photo_words", "image_choice", "text", "photo_words", "image_choice",
    ]);
  });
  it("Commune is hardest: most points and 4 choices", () => {
    expect(quizPoints(0)).toBe(10);
    expect(quizOptionCount(0)).toBe(4);
  });
  it("rarest question is the easiest: 2 choices, fewest points", () => {
    expect(quizPoints(1)).toBe(2);
    expect(quizOptionCount(1)).toBe(2);
  });
  it("counts time down from the server end", () => {
    expect(quizSecondsLeft(new Date(10_000).toISOString(), 0, 0)).toBe(10);
    expect(quizSecondsLeft(new Date(10_000).toISOString(), 0, 20_000)).toBe(0);
  });
});
