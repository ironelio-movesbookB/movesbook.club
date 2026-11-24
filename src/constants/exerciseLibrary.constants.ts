/**
 * My Library of Exercises — default topics per category chip.
 */

/** 15 muscle-group topics for Isotonic … Crossfit. */
export const EXERCISE_MUSCLE_DEFAULT_TOPICS = [
  'Shoulders',
  'Trapezius',
  'Pectorals',
  'Lats',
  'Anterior arms',
  'Posterior arms',
  'Forearms',
  'Abdominals',
  'Intercostals',
  'Lumbosacral',
  'Quadriceps',
  'Glutes',
  'Hamstrings',
  'Calves',
  'Tibialis',
] as const;

/** Categories that show the 15 muscle-group topics by default. */
export const EXERCISE_CATEGORIES_WITH_MUSCLE_DEFAULT_TOPICS = [
  'Isotonic\\weights',
  'Stretching',
  'Pilates',
  'Gymnastic',
  'Calistenic',
  'Spartan',
  'Crossfit',
] as const;

/** 4 body-region topics for Aerobic sports. */
export const EXERCISE_AEROBIC_DEFAULT_TOPICS = [
  'Upper limbs',
  'Torso',
  'Lower limbs',
  'Others',
] as const;

/** 14 topics for Martial arts. */
export const EXERCISE_MARTIAL_ARTS_DEFAULT_TOPICS = [
  'Kihon',
  'Kata',
  'Kumite',
  'Bunkai',
  'Core',
  'Lower Kinetic Chain',
  'Upper part',
  'Karate',
  'Judo',
  'Ju Jitsu',
  'Kung Fu',
  'Tai Chi',
  'Taekwondo',
  'Kickboxing',
] as const;

/** Typology options for Add OGP exercise (persisted on ExerciseOgpArticle.typology). */
export const EXERCISE_OGP_TYPOLOGY_SINGLE = 'Single exercises';
export const EXERCISE_OGP_TYPOLOGY_PLAYLIST = 'Playlist of exercises';

export const EXERCISE_OGP_TYPOLOGIES = [
  EXERCISE_OGP_TYPOLOGY_SINGLE,
  EXERCISE_OGP_TYPOLOGY_PLAYLIST,
] as const;

export type ExerciseOgpTypology = (typeof EXERCISE_OGP_TYPOLOGIES)[number];

/** True when typology is Playlist of exercises. Null/empty/other → single. */
export function isExerciseOgpPlaylistTypology(typology: string | null | undefined): boolean {
  return (typology ?? '').trim() === EXERCISE_OGP_TYPOLOGY_PLAYLIST;
}

const MUSCLE_DEFAULT_CATEGORY_SET = new Set<string>(EXERCISE_CATEGORIES_WITH_MUSCLE_DEFAULT_TOPICS);

const EMPTY_DEFAULT_TOPICS: readonly string[] = [];

/** Built-in default topic names for a library category. */
export function getExerciseDefaultTopics(category: string): readonly string[] {
  if (MUSCLE_DEFAULT_CATEGORY_SET.has(category)) {
    return EXERCISE_MUSCLE_DEFAULT_TOPICS;
  }
  if (category === 'Aerobic sports') {
    return EXERCISE_AEROBIC_DEFAULT_TOPICS;
  }
  if (category === 'Martial arts') {
    return EXERCISE_MARTIAL_ARTS_DEFAULT_TOPICS;
  }
  return EMPTY_DEFAULT_TOPICS;
}
