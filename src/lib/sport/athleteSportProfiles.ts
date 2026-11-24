import { normalizeEntitySport, type EntitySportOption } from '@/lib/sport/entitySportOptions';
import {
  field,
  statGroup,
  type SportFieldDef,
  type SportStatGroup,
} from '@/lib/sport/sportProfileTypes';

/**
 * Athlete TEAM fields per sport, expressed against the Football (soccer) base:
 * Dominant foot, Current team, Role, Sub-role, Jersey number (+ Height / Weight, always kept).
 * `false` removes a base field, a string relabels it, `undefined` keeps the base label.
 */
export type AthleteSportProfile = {
  footHand?: string | false;
  footHandOptions?: readonly string[];
  currentTeam?: string | false;
  role?: string | false;
  /** Used when Super Admin has no dropdown options for the sport. */
  roleOptions?: readonly string[];
  subRole?: string | false;
  subRoleOptions?: readonly string[];
  jersey?: string | false;
  verticalJumpLabel?: string;
  extra: SportFieldDef[];
  /** Buttons of the athlete Stats tab. */
  stats: SportStatGroup[];
  /** A field that switches extra fields / stats (Track & Field: Running, Jump, Throwing). */
  variant?: {
    field: SportFieldDef;
    byOption: Record<string, { extra: SportFieldDef[]; stats: SportStatGroup[] }>;
  };
};

const RIGHT_LEFT = ['Right', 'Left'] as const;
const STANCE = ['Orthodox', 'Southpaw'] as const;

/** Individual sports drop every team field of the soccer base. */
const INDIVIDUAL = {
  footHand: false,
  currentTeam: false,
  role: false,
  subRole: false,
  jersey: false,
} as const;

const stats = (labels: readonly string[]): SportStatGroup[] => [statGroup('Stats', labels)];

const PROFILES: Record<EntitySportOption, AthleteSportProfile> = {
  Football: {
    extra: [],
    stats: stats(['Rebounds', 'Steals', 'Blocks', 'Fouls']),
  },
  Basket: {
    footHand: 'Dominant hand',
    footHandOptions: RIGHT_LEFT,
    verticalJumpLabel: 'Vertical leap',
    extra: [field('Wingspan')],
    stats: stats(['Rebounds', 'Steals', 'Blocks', 'Fouls']),
  },
  Baseball: {
    footHand: 'Dominant hand',
    footHandOptions: RIGHT_LEFT,
    extra: [field('Throwing hand', RIGHT_LEFT), field('Batting side', ['Right', 'Left', 'Switch'])],
    stats: stats(['Batting Average', 'Home Runs', 'RBIs', 'ERA (if pitcher)', 'Strikeouts']),
  },
  Calisthenics: {
    ...INDIVIDUAL,
    footHand: 'Dominant hand',
    footHandOptions: RIGHT_LEFT,
    extra: [field('Training category', ['Static', 'Dynamic', 'Weighted'])],
    stats: [
      statGroup('Max Reps', ['Pull-up', 'Push-up', 'Muscle-up', 'Dip']),
      statGroup('Max Hold Time', ['Front Lever', 'Planche', 'Human Flag']),
      statGroup('Skill', ['Skill Level']),
    ],
  },
  Pilates: {
    ...INDIVIDUAL,
    extra: [
      field('Experience level', ['Beginner', 'Intermediate', 'Advanced']),
      field('Instructor certification (if applicable)'),
      field('Specialization', ['Mat', 'Reformer', 'Clinical']),
    ],
    stats: stats(['Sessions Completed']),
  },
  Cricket: {
    footHand: 'Dominant hand',
    footHandOptions: RIGHT_LEFT,
    extra: [
      field('Batting style', ['Left', 'Right']),
      field('Bowling style', ['Fast', 'Spin', 'Medium']),
      field('Bowling arm', RIGHT_LEFT),
    ],
    stats: stats(['Runs', 'Wickets', 'Centuries', 'Strike Rate', 'Economy']),
  },
  Bodybuilding: {
    ...INDIVIDUAL,
    extra: [
      field('Category / Division', ['Classic', 'Open', 'Bikini', "Men's Physique", 'Other']),
      field('Competition weight class'),
    ],
    stats: stats(['Competitions', 'Titles', 'Best Placement', 'Body Fat % (Stage)']),
  },
  'Artistic Gymnastics': {
    ...INDIVIDUAL,
    footHand: 'Dominant hand',
    footHandOptions: RIGHT_LEFT,
    extra: [
      field('Discipline / Apparatus', [
        'Floor',
        'Pommel Horse',
        'Rings',
        'Vault',
        'Parallel Bars',
        'High Bar',
        'Uneven Bars',
        'Beam',
      ]),
      field('Category', ['MAG', 'WAG']),
    ],
    stats: stats(['D-Score', 'E-Score', 'Total Score', 'Competitions']),
  },
  Judo: {
    ...INDIVIDUAL,
    footHand: 'Dominant hand / Side',
    footHandOptions: ['Righty', 'Lefty'],
    extra: [field('Weight class'), field('Belt / Dan grade')],
    stats: stats(['Fights', 'Wins', 'Ippons', 'Shidos', 'World Ranking']),
  },
  Karate: {
    ...INDIVIDUAL,
    extra: [
      field('Style', ['Shotokan', 'Goju-ryu', 'Wado-ryu', 'Shito-ryu', 'Other']),
      field('Discipline', ['Kata', 'Kumite', 'Both']),
      field('Weight class (for Kumite)'),
      field('Belt / Dan grade'),
    ],
    stats: stats(['Fights', 'Wins', 'Katas Score']),
  },
  'Jiu-Jitsu': {
    ...INDIVIDUAL,
    extra: [
      field('Discipline', ['BJJ', 'Japanese', 'No-Gi']),
      field('Weight class'),
      field('Belt grade'),
    ],
    stats: stats(['Fights', 'Wins by Submission', 'Win Rate']),
  },
  Kickboxing: {
    ...INDIVIDUAL,
    extra: [
      field('Stance', STANCE),
      field('Weight class'),
      field('Style', ['K-1', 'Full Contact', 'Low Kick']),
    ],
    stats: stats(['Fights', 'Wins', 'KOs', 'Losses']),
  },
  Boxing: {
    ...INDIVIDUAL,
    extra: [field('Weight class'), field('Stance', STANCE), field('Guard')],
    stats: stats(['Fights', 'Wins', 'Wins by KO', 'Losses', 'Draws']),
  },
  Padel: {
    footHand: 'Dominant hand',
    footHandOptions: RIGHT_LEFT,
    extra: [field('Playing side', ['Left side of court', 'Right side of court']), field('Partner / Duo')],
    stats: stats(['Matches', 'Wins', 'Points (WPT ranking)']),
  },
  Rugby: {
    role: 'Role / Position',
    extra: [field('Format', ['XV', '7s', 'League'])],
    stats: stats(['Tries', 'Conversions', 'Drop Goals', 'Tackles']),
  },
  Swim: {
    ...INDIVIDUAL,
    extra: [
      field('Stroke', ['Freestyle', 'Backstroke', 'Breaststroke', 'Butterfly', 'Medley']),
      field('Distance specialty'),
    ],
    stats: stats(['Personal Best', 'Competitions', 'Medals']),
  },
  Tennis: {
    ...INDIVIDUAL,
    footHand: 'Dominant hand',
    footHandOptions: RIGHT_LEFT,
    extra: [
      field('Backhand', ['One-handed', 'Two-handed']),
      field('Playing surface preference', ['Hard', 'Clay', 'Grass', 'Indoor']),
    ],
    stats: stats(['Matches', 'Wins', 'Aces', 'ATP/WTA Ranking']),
  },
  'Track & Fields': {
    ...INDIVIDUAL,
    extra: [],
    stats: [
      statGroup('Running', ['Races', 'Wins', 'Medals']),
      statGroup('Jump', ['Personal Best', 'Season Best', 'Attempts']),
      statGroup('Throwing', ['Personal Best', 'Season Best', 'Throws']),
    ],
    variant: {
      field: field('Discipline group', ['Running', 'Jump', 'Throwing']),
      byOption: {
        Running: {
          extra: [
            field('Event', [
              '100m',
              '200m',
              '400m',
              '800m',
              '1500m',
              '5000m',
              '10000m',
              'Marathon',
              'Hurdles',
              'Steeplechase',
              'Relay',
            ]),
            field('Personal best'),
            field('Season best'),
          ],
          stats: [statGroup('Running', ['Races', 'Wins', 'Medals'])],
        },
        Jump: {
          extra: [
            field('Event', ['Long Jump', 'High Jump', 'Triple Jump', 'Pole Vault']),
            field('Takeoff foot / Dominant side', RIGHT_LEFT),
          ],
          stats: [statGroup('Jump', ['Personal Best', 'Season Best', 'Attempts'])],
        },
        Throwing: {
          extra: [
            field('Event', ['Shot Put', 'Discus', 'Javelin', 'Hammer']),
            field('Throwing hand', RIGHT_LEFT),
          ],
          stats: [statGroup('Throwing', ['Personal Best', 'Season Best', 'Throws'])],
        },
      },
    },
  },
  Volley: {
    footHand: false,
    role: 'Role (Position)',
    extra: [],
    stats: stats(['Sets Played', 'Points', 'Blocks', 'Serves/Aces']),
  },
  Rowing: {
    footHand: false,
    role: false,
    subRole: false,
    jersey: false,
    currentTeam: 'Crew / Club',
    extra: [
      field('Boat class', ['Single Scull', 'Double Scull', 'Pair', 'Four', 'Quad', 'Eight', 'Other']),
      field('Side', ['Port', 'Starboard', 'Sculler']),
    ],
    stats: stats(['Races', 'Wins', 'Best Time']),
  },
  'Canoe\\Kayak': {
    ...INDIVIDUAL,
    extra: [
      field('Discipline', ['Canoe', 'Kayak', 'SUP']),
      field('Distance', ['200m', '500m', '1000m', 'Slalom']),
      field('Boat class', ['C1', 'C2', 'K1', 'K2', 'K4']),
    ],
    stats: stats(['Races', 'Wins', 'Best Time']),
  },
  Skiing: {
    ...INDIVIDUAL,
    extra: [
      field('Discipline', ['Alpine', 'Cross-Country', 'Ski Jump', 'Freestyle', 'Snowboard']),
      field('Speciality', ['Slalom', 'Giant Slalom', 'Super-G', 'Downhill', 'Combined', 'Other']),
    ],
    stats: stats(['Races', 'Wins', 'Podiums', 'FIS Points']),
  },
  Surf: {
    ...INDIVIDUAL,
    footHand: 'Stance',
    footHandOptions: ['Regular', 'Goofy'],
    extra: [field('Tour (WSL, QS, etc.)')],
    stats: stats(['Events', 'Wins', 'Avg Score', 'Best Wave']),
  },
  'Roller Sports': {
    ...INDIVIDUAL,
    extra: [
      field('Discipline', ['Speed', 'Freestyle', 'Figure', 'Inline Hockey', 'Roller Derby']),
      field('Speciality / Category'),
    ],
    stats: stats(['Races', 'Wins', 'Podiums', 'Best Time / Score']),
  },
  'Ice\\Field Hockey': {
    footHand: 'Shoots',
    footHandOptions: RIGHT_LEFT,
    role: 'Role (Position)',
    extra: [],
    stats: stats(['Goals', 'Assists', 'Points', 'PIM (Penalty Minutes)']),
  },
  Polo: {
    footHand: 'Playing hand',
    footHandOptions: RIGHT_LEFT,
    role: false,
    subRole: false,
    jersey: false,
    extra: [field('Handicap'), field('Position (1-4)', ['1', '2', '3', '4'])],
    stats: stats(['Matches', 'Goals', 'Wins']),
  },
  Golf: {
    ...INDIVIDUAL,
    footHand: 'Plays',
    footHandOptions: ['Right handed', 'Left handed'],
    extra: [field('Tour (PGA, DP World, LIV, etc.)'), field('Handicap / OWGR rank')],
    stats: stats(['Tournaments', 'Wins', 'Top 10s', 'Avg Score']),
  },
  Sailing: {
    footHand: false,
    role: false,
    subRole: false,
    jersey: false,
    currentTeam: 'Team / Yacht club',
    extra: [
      field('Class (ILCA 7, 49er, Nacra 17, etc.)'),
      field('Role onboard', ['Helm', 'Crew', 'Tactician', 'Trimmer', 'Bow', 'Other']),
    ],
    stats: stats(['Regattas', 'Wins', 'World Sailing Ranking']),
  },
  Cycling: {
    footHand: 'Dominant leg / Lead leg',
    footHandOptions: RIGHT_LEFT,
    role: 'Rider type',
    roleOptions: ['GC', 'Sprinter', 'Climber', 'Domestique', 'Puncheur', 'TT Specialist'],
    subRole: 'Specialty',
    subRoleOptions: ['Lead-out man', 'Mountain domestique'],
    jersey: false,
    extra: [
      field('Discipline', ['Road', 'Track', 'MTB', 'BMX', 'Cyclo-cross', 'Gravel']),
      field('UCI ranking / Category', ['WorldTour', 'ProTeam', 'Continental']),
      field('FTP'),
      field('VO2max'),
      field('W/kg'),
      field('Bike brand'),
      field('GC position'),
      field('KOM'),
      field('Points classification'),
    ],
    stats: [
      statGroup('Specialty Stats', [
        'Wins',
        'Podiums',
        'Grand Tours Finished',
        'Stages Won',
        'KOM Titles',
        'Points Classification',
      ]),
    ],
  },
  'American Football': {
    footHand: 'Dominant foot (Kicker/Punter)',
    role: 'Position',
    roleOptions: ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K', 'P'],
    subRole: 'Formation role',
    subRoleOptions: ['X-Receiver', 'Slot', 'Nose Tackle', 'Edge Rusher'],
    jersey: 'Shirt number',
    extra: [
      field('Arm length'),
      field('Hand size'),
      field('40-yard dash'),
      field('Bench press'),
      field('Draft year'),
      field('Draft round'),
      field('Draft pick'),
      field('College'),
      field('Cap hit'),
      field('Roster status', ['Active', 'Injured Reserve', 'Practice Squad']),
    ],
    stats: [
      statGroup('Offensive Stats', [
        'Passing Yards',
        'Rushing Yards',
        'Receiving Yards',
        'Touchdowns',
        'Completion %',
        'QB Rating',
      ]),
      statGroup('Defensive Stats', [
        'Tackles',
        'Sacks',
        'Tackles for Loss',
        'Interceptions',
        'Pass Deflections',
        'Forced Fumbles',
      ]),
      statGroup('Special Teams Stats', ['FG Made/Att', 'FG%', 'Punt Average']),
    ],
  },
  'Beach Volley': {
    footHand: 'Dominant hand',
    footHandOptions: RIGHT_LEFT,
    currentTeam: 'Partner / Teammate',
    role: 'Role',
    roleOptions: ['Blocker', 'Defender'],
    subRole: 'Side',
    subRoleOptions: ['Left Side', 'Right Side'],
    jersey: 'Jersey number (1 or 2)',
    extra: [
      field('FIVB / World ranking'),
      field('Partner history'),
      field('Spike reach'),
      field('Block reach'),
      field('Surface', ['Sand']),
    ],
    stats: stats(['Aces', 'Blocks', 'Digs', 'Attack % / Kill %']),
  },
  Handball: {
    footHand: 'Dominant hand',
    footHandOptions: RIGHT_LEFT,
    role: 'Position',
    roleOptions: [
      'Goalkeeper',
      'Left Wing',
      'Right Wing',
      'Line Player / Pivot',
      'Left Back',
      'Centre Back',
      'Right Back',
    ],
    extra: [
      field('Throwing speed km/h'),
      field('Playing phase', ['Offense', 'Defense Specialist', 'Both']),
      field('EHF ranking'),
    ],
    stats: stats([
      'Goals Scored',
      'Shooting %',
      '7m Goals / %',
      'Assists',
      'Steals',
      'Blocks',
      'Saves % (GK)',
      '2-Minute Suspensions',
    ]),
  },
  'Table Tennis': {
    footHand: 'Dominant hand',
    footHandOptions: RIGHT_LEFT,
    currentTeam: 'Club + National team',
    role: 'Playing style',
    roleOptions: ['Attacker', 'Defender', 'All-rounder'],
    subRole: 'Rubber type',
    subRoleOptions: ['Pips-in', 'Pips-out', 'Anti'],
    jersey: false,
    extra: [
      field('Grip style', ['Shakehand', 'Penhold']),
      field('World ranking / ITTF ranking'),
      field('Blade'),
      field('Forehand rubber'),
      field('Backhand rubber'),
      field('Specialist', ['Singles', 'Doubles', 'Mixed Doubles']),
    ],
    stats: stats(['Win/Loss Ratio', 'Titles Won']),
  },
  Badminton: {
    footHand: 'Dominant hand',
    footHandOptions: RIGHT_LEFT,
    currentTeam: 'National team / Club + Doubles partner',
    role: 'Discipline',
    roleOptions: [
      "Men's Singles",
      "Women's Singles",
      "Men's Doubles",
      "Women's Doubles",
      'Mixed Doubles',
    ],
    subRole: 'Playing style',
    subRoleOptions: ['Attacking', 'Defensive', 'Control'],
    jersey: false,
    extra: [
      field('BWF world ranking'),
      field('Racket'),
      field('String tension'),
      field('Specialist', ['Singles', 'Doubles']),
    ],
    stats: stats(['Win/Loss Record', 'Titles', 'Win Streak']),
  },
  Weightlifting: {
    footHand: false,
    currentTeam: 'National team / Club',
    role: 'Weight category',
    roleOptions: ['55kg', '61kg', '67kg', '73kg', '81kg', '89kg', '96kg', '102kg', '+102kg'],
    subRole: 'Lifts',
    subRoleOptions: ['Snatch', 'Clean & Jerk', 'Both'],
    jersey: false,
    extra: [
      field('Bodyweight category (exact)'),
      field('IWF ranking'),
      field('Snatch PB'),
      field('Clean & Jerk PB'),
      field('Total (Snatch + Clean & Jerk)'),
      field('Sinclair / Robi points'),
    ],
    stats: [statGroup('Competition Stats', ['Best Lifts', 'Attempts', 'World Records'])],
  },
  Gymnastic: {
    footHand: 'Dominant hand / leg',
    footHandOptions: RIGHT_LEFT,
    currentTeam: 'National team / Club / Gym',
    role: 'Discipline',
    roleOptions: ['Artistic', 'Rhythmic', 'Trampoline', 'Aerobic'],
    subRole: 'Apparatus',
    subRoleOptions: [
      'Floor',
      'Pommel Horse',
      'Rings',
      'Vault',
      'Parallel Bars',
      'Horizontal Bar',
      'Beam',
      'Uneven Bars',
    ],
    jersey: false,
    extra: [
      field('FIG ranking'),
      field('Specialty apparatus'),
      field('All-Around vs Specialist', ['All-Around', 'Specialist']),
    ],
    stats: stats([
      'D-Score (Difficulty)',
      'E-Score (Execution)',
      'All-Around Score',
      'Personal Bests',
    ]),
  },
  Wrestling: {
    footHand: 'Stance',
    footHandOptions: STANCE,
    currentTeam: 'National team / Club',
    role: 'Style',
    roleOptions: ['Freestyle', 'Greco-Roman', 'Folkstyle'],
    subRole: 'Weight class',
    subRoleOptions: ['57kg', '65kg', '74kg', '86kg', '97kg', '125kg'],
    jersey: false,
    extra: [
      field('UWW ranking'),
      field('Weight class (exact)'),
      field('Record W-L'),
      field('Finishing (Pin, Decision, Tech Fall %)'),
    ],
    stats: stats(['Wins/Losses', 'Wins by Fall / Pin', 'Technical Superiority Wins']),
  },
  Triathlon: {
    footHand: false,
    currentTeam: 'National team / Sponsor team',
    role: 'Distance',
    roleOptions: ['Sprint', 'Olympic', '70.3', 'Ironman', 'XTERRA'],
    subRole: 'Strength',
    subRoleOptions: ['Swimmer', 'Biker', 'Runner'],
    jersey: false,
    extra: [
      field('World Triathlon / PTO ranking'),
      field('Swim split'),
      field('T1'),
      field('Bike split'),
      field('T2'),
      field('Run split'),
      field('Total time'),
      field('PB per distance'),
      field('Bike type'),
    ],
    stats: stats(['Total Races', 'Podiums', 'Avg. Transition Time (T1+T2)']),
  },
  'Motor Sports': {
    footHand: false,
    currentTeam: 'Constructor / Team / Garage',
    role: 'Series',
    roleOptions: ['F1', 'F2', 'F3', 'Formula E', 'MotoGP', 'Moto2', 'Moto3', 'WEC', 'NASCAR', 'WRC', 'Other'],
    subRole: 'Class / Rider type',
    jersey: 'Car / Race number',
    extra: [
      field('Vehicle (Car / Bike model)'),
      field('Engine'),
      field('Championship standing'),
      field('Championship points'),
      field('Super License points'),
      field('Grid / Qualifying position'),
      field('DNF rate'),
      field('Laps led'),
    ],
    stats: stats([
      'Starts',
      'Wins',
      'Podiums',
      'Pole Positions',
      'Fastest Laps',
      'Championships',
      'DNFs',
    ]),
  },
  Netball: {
    footHand: 'Dominant hand',
    footHandOptions: RIGHT_LEFT,
    role: 'Primary position',
    roleOptions: ['GS', 'GA', 'WA', 'C', 'WD', 'GD', 'GK'],
    subRole: 'Court zones / Playing style',
    jersey: 'Shirt number',
    extra: [
      field('Shooting accuracy %'),
      field('Centre pass receives'),
      field('World Netball ranking'),
    ],
    stats: stats([
      'Goals Scored',
      'Goal %',
      'Goal Assists',
      'Feeds',
      'Intercepts',
      'Deflections',
      'Rebounds',
      'Turnovers',
    ]),
  },
  Squash: {
    footHand: 'Dominant hand',
    footHandOptions: RIGHT_LEFT,
    currentTeam: 'National team / PSA club',
    role: 'Discipline',
    roleOptions: ['Singles', 'Doubles'],
    subRole: 'Playing style',
    subRoleOptions: ['Attacking', 'Retriever', 'Control'],
    jersey: false,
    extra: [
      field('PSA world ranking'),
      field('Racket'),
      field('String tension'),
      field('Best world ranking'),
      field('Tournament tier', ['Platinum', 'Gold', 'Silver', 'Bronze', 'Challenger']),
    ],
    stats: stats(['Win/Loss Record', 'Titles', 'Best Finish', 'Highest Ranking']),
  },
  Curling: {
    footHand: 'Sweeping side / Dominant hand',
    footHandOptions: RIGHT_LEFT,
    currentTeam: 'Curling team / Rink / Club',
    role: 'Position',
    roleOptions: ['Skip', 'Third', 'Second', 'Lead', 'Alternate'],
    subRole: 'Throwing hand + Delivery style',
    jersey: 'Team order',
    extra: [
      field('World Curling ranking'),
      field('Shooting percentage'),
      field('Skip % / Vice-Skip %'),
      field('Hammer conversion rate'),
      field('Brier / Worlds appearances'),
    ],
    stats: stats(['Shooting %', 'Hammer Efficiency', 'Steal Defense', 'Ends Won', 'Win/Loss']),
  },
  'Fitness\\Gym': {
    ...INDIVIDUAL,
    extra: [],
    stats: [],
  },
};

/** Every English text of the athlete profiles, for the Section languages. */
export function athleteSportProfileTexts(): string[] {
  const out: string[] = [];
  const addFields = (defs: SportFieldDef[]) =>
    defs.forEach((d) => out.push(d.label, ...(d.options ?? [])));
  const addStats = (groups: SportStatGroup[]) =>
    groups.forEach((g) => out.push(g.title, ...g.items.map((i) => i.label)));
  for (const p of Object.values(PROFILES)) {
    for (const v of [p.footHand, p.currentTeam, p.role, p.subRole, p.jersey, p.verticalJumpLabel]) {
      if (typeof v === 'string') out.push(v);
    }
    out.push(...(p.footHandOptions ?? []), ...(p.roleOptions ?? []), ...(p.subRoleOptions ?? []));
    addFields(p.extra);
    addStats(p.stats);
    if (p.variant) {
      addFields([p.variant.field]);
      for (const o of Object.values(p.variant.byOption)) {
        addFields(o.extra);
        addStats(o.stats);
      }
    }
  }
  return out;
}

export function athleteSportProfile(sport: string | null | undefined): AthleteSportProfile {
  return PROFILES[normalizeEntitySport(sport)];
}

/** Extra fields, including the ones of the chosen variant (if any). */
export function athleteSportExtraFields(
  profile: AthleteSportProfile,
  values: Record<string, string>,
): SportFieldDef[] {
  if (!profile.variant) return profile.extra;
  const picked = profile.variant.byOption[values[profile.variant.field.key] ?? ''];
  return [profile.variant.field, ...profile.extra, ...(picked?.extra ?? [])];
}

/** Stat groups; a chosen variant narrows them to its own list. */
export function athleteSportStatGroups(
  profile: AthleteSportProfile,
  values: Record<string, string>,
): SportStatGroup[] {
  if (!profile.variant) return profile.stats;
  const picked = profile.variant.byOption[values[profile.variant.field.key] ?? ''];
  return picked ? picked.stats : profile.stats;
}
