/** Shared sport list for team / club / coach group entity profiles + member Settings. */
export const ENTITY_SPORT_OPTIONS = [
  'American Football',
  'Artistic Gymnastics',
  'Badminton',
  'Baseball',
  'Basket',
  'Beach Volley',
  'Bodybuilding',
  'Boxing',
  'Calisthenics',
  'Canoe\\Kayak',
  'Cricket',
  'Curling',
  'Cycling',
  'Fitness\\Gym',
  'Football',
  'Golf',
  'Gymnastic',
  'Handball',
  'Ice\\Field Hockey',
  'Jiu-Jitsu',
  'Judo',
  'Karate',
  'Kickboxing',
  'Motor Sports',
  'Netball',
  'Padel',
  'Pilates',
  'Polo',
  'Roller Sports',
  'Rowing',
  'Rugby',
  'Sailing',
  'Skiing',
  'Squash',
  'Surf',
  'Swim',
  'Table Tennis',
  'Tennis',
  'Track & Fields',
  'Triathlon',
  'Volley',
  'Weightlifting',
  'Wrestling',
] as const;

export type EntitySportOption = (typeof ENTITY_SPORT_OPTIONS)[number];

export const DEFAULT_ENTITY_SPORT: EntitySportOption = 'Football';

const SPORT_ALIASES: Record<string, EntitySportOption> = {
  football: 'Football',
  soccer: 'Football',
  basketball: 'Basket',
  'track & field': 'Track & Fields',
  'track and field': 'Track & Fields',
  athletics: 'Track & Fields',
  'body building': 'Bodybuilding',
  gym: 'Fitness\\Gym',
  fitness: 'Fitness\\Gym',
  'calisthenic\\pilates': 'Calisthenics',
  calisthenic: 'Calisthenics',
  // Retired combined entry: saved values fall back to the first split sport.
  'martial arts': 'Karate',
  ski: 'Skiing',
  swimming: 'Swim',
  gymnastics: 'Gymnastic',
  'artistic gymnastic': 'Artistic Gymnastics',
  volleyball: 'Volley',
  'beach volleyball': 'Beach Volley',
  'ice hockey': 'Ice\\Field Hockey',
  'field hockey': 'Ice\\Field Hockey',
  'ice / field hockey': 'Ice\\Field Hockey',
  hockey: 'Ice\\Field Hockey',
  canoe: 'Canoe\\Kayak',
  kayak: 'Canoe\\Kayak',
  'canoe / kayak': 'Canoe\\Kayak',
  'jiu jitsu': 'Jiu-Jitsu',
  bjj: 'Jiu-Jitsu',
  'kick boxing': 'Kickboxing',
  boxe: 'Boxing',
  surfing: 'Surf',
  sail: 'Sailing',
  roller: 'Roller Sports',
  motorsport: 'Motor Sports',
  motorsports: 'Motor Sports',
  'motor sport': 'Motor Sports',
  'table-tennis': 'Table Tennis',
};

/** Normalize stored / legacy sport labels to the current catalog. */
export function normalizeEntitySport(
  value: string | null | undefined,
  fallback: EntitySportOption = DEFAULT_ENTITY_SPORT,
): EntitySportOption {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;
  const exact = ENTITY_SPORT_OPTIONS.find((s) => s.toLowerCase() === raw.toLowerCase());
  if (exact) return exact;
  const aliased = SPORT_ALIASES[raw.toLowerCase()];
  if (aliased) return aliased;
  return fallback;
}

export function isFootballSport(value: string | null | undefined): boolean {
  return normalizeEntitySport(value) === 'Football';
}

export function isBasketSport(value: string | null | undefined): boolean {
  return normalizeEntitySport(value) === 'Basket';
}
