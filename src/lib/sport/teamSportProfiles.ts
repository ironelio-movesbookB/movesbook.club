import { normalizeEntitySport, type EntitySportOption } from '@/lib/sport/entitySportOptions';
import {
  field,
  statGroup,
  type SportFieldDef,
  type SportStatGroup,
} from '@/lib/sport/sportProfileTypes';

/**
 * Football team profile fields not covered by the other Team Profile tabs
 * (Name, Logo, Colors, Country, City, Headquarters, Year of foundation, President,
 * Coach, League and Main sponsor already live there).
 */
const BASE_PROFILE_FIELDS = [
  { key: 'facility', label: 'Facility' },
  { key: 'ownership', label: 'Ownership' },
  { key: 'management', label: 'Management' },
  { key: 'technicalStaff', label: 'Technical staff' },
  { key: 'championship', label: 'Championship' },
  { key: 'squad', label: 'Squad' },
  { key: 'players', label: 'Players' },
  { key: 'typicalLineup', label: 'Typical lineup' },
  { key: 'formation', label: 'Formation' },
  { key: 'honors', label: 'Honors' },
  { key: 'trophies', label: 'Trophies' },
] as const;

/** Season-independent items of the Statistics tab. */
const BASE_INFO_FIELDS = [
  { key: 'marketValue', label: 'Market value' },
  { key: 'sponsors', label: 'Sponsors' },
  { key: 'youthAcademy', label: 'Youth academy' },
  { key: 'bTeam', label: 'B-team' },
] as const;

type BaseKey =
  | (typeof BASE_PROFILE_FIELDS)[number]['key']
  | (typeof BASE_INFO_FIELDS)[number]['key'];

export type TeamSportProfile = {
  /** Label of the main playing field (Football: Stadium). */
  venue: string;
  rename?: Partial<Record<BaseKey, string>>;
  remove?: BaseKey[];
  add: SportFieldDef[];
  seasonStats: SportStatGroup[];
};

const season = (labels: readonly string[]): SportStatGroup[] => [
  statGroup('Season statistics', labels),
];

const MEN_WOMEN = ['Men', 'Women', 'Mixed'] as const;
/** Most non-soccer sports drop the starting XI and the transfer market value. */
const NO_LINEUP_NO_VALUE: BaseKey[] = ['typicalLineup', 'marketValue'];

const PROFILES: Record<EntitySportOption, TeamSportProfile> = {
  Football: {
    venue: 'Stadium',
    add: [],
    seasonStats: season([
      'Matches played',
      'W-D-L',
      'Goals scored',
      'Goals conceded',
      'League position',
      'Cards',
    ]),
  },
  Basket: {
    venue: 'Arena',
    rename: {
      ownership: 'Owner',
      management: 'Front office',
      squad: 'Roster',
      formation: 'Starting five / System',
      honors: 'Palmares',
      youthAcademy: 'Youth team',
      bTeam: 'Development team (G-League)',
    },
    add: [field('Conference'), field('Division'), field('Salary cap'), field('Draft picks')],
    seasonStats: season(['W-L', 'PPG', 'RPG', 'APG', 'Standings', 'Fouls']),
  },
  Baseball: {
    venue: 'Ballpark',
    rename: {
      management: 'Front office',
      technicalStaff: 'Manager / Coaching staff',
      squad: 'Roster',
      formation: 'Lineup / Batting order',
      typicalLineup: 'Rotation & Bullpen',
      honors: 'Palmares',
      trophies: 'Trophies (World Series etc.)',
      youthAcademy: 'Youth system',
      bTeam: 'Farm system',
    },
    add: [
      field('Ballpark dimensions'),
      field('Conference / League', ['AL', 'NL', 'Other']),
      field('Division'),
      field('Farm teams levels (AAA, AA, A)'),
      field('Pitching rotation / Starting pitchers'),
      field('Designated hitter rule usage', ['Yes', 'No']),
    ],
    seasonStats: season([
      'W-L',
      'Runs scored',
      'Runs allowed',
      'ERA',
      'Batting average',
      'Position',
    ]),
  },
  Calisthenics: {
    venue: 'Training spot / Home gym',
    rename: {
      championship: 'Federation / Competitions circuit (e.g. WSWCF)',
      squad: 'Squad / Athletes',
      formation: 'Competition category',
      honors: 'Palmares / Competition results',
    },
    remove: ['ownership', 'management', 'technicalStaff', 'typicalLineup', 'marketValue', 'youthAcademy', 'bTeam'],
    add: [
      field('Coach / Founder / Leader'),
      field('Disciplines', ['Freestyle', 'Strength', 'Endurance', 'Power']),
      field('Team style / Focus'),
      field('Content / Media (YouTube, Battles)'),
      field('Social media'),
    ],
    seasonStats: [statGroup('Competition statistics', ['Battles won', 'Points', 'Ranking'])],
  },
  Pilates: {
    venue: 'Studio / Facilities (Reformers, Mats)',
    rename: {
      ownership: 'Owner / Founder / Director',
      management: 'Studio manager / Owner',
      technicalStaff: 'Lead instructor / Instructors',
      championship: 'Network / Affiliation (e.g. Balanced Body, STOTT)',
      squad: 'Instructors team',
      players: 'Members community',
      honors: 'Certifications / Awards / Recognition',
    },
    remove: ['formation', 'typicalLineup', 'trophies', 'marketValue', 'sponsors', 'youthAcademy', 'bTeam'],
    add: [
      field('Class types offered (Mat, Reformer, Clinical, Pre/Post Natal)'),
      field('Instructor certifications'),
      field('Membership types / Subscription'),
      field('Schedule / Timetable'),
    ],
    seasonStats: [],
  },
  Cricket: {
    venue: 'Cricket ground / Stadium',
    rename: {
      ownership: 'Owner / Board',
      squad: 'Squad / Roster',
      formation: 'Playing XI / Batting order',
      typicalLineup: 'Bowling lineup',
      honors: 'Palmares',
      bTeam: 'Development squad',
    },
    add: [
      field('Pitch type / Home conditions'),
      field('Format specialization', ['Test', 'ODI', 'T20 / Franchise']),
      field('Captain'),
      field('Overseas players / Central contracts'),
    ],
    seasonStats: season([
      'W-L-D/Tie',
      'Runs scored',
      'Runs conceded',
      'Wickets',
      'Overs',
      'Net run rate',
      'Position',
    ]),
  },
  Bodybuilding: {
    venue: 'Home gym / Base',
    rename: {
      ownership: 'Owner / Founder',
      management: 'Team manager / Head coach',
      technicalStaff: 'Head coach / Prep coach / Posing coach',
      championship: 'Federation (IFBB, NPC, etc.) / Circuit',
      squad: 'Squad / Athletes',
      honors: 'Palmares / Titles',
    },
    remove: ['formation', 'typicalLineup', 'marketValue', 'youthAcademy', 'bTeam'],
    add: [
      field("Categories (Men's Open, Classic Physique, Bikini, etc.)"),
      field('Prep system / Nutritionists'),
      field('Supplements sponsor'),
    ],
    seasonStats: [statGroup('Competition statistics', ['Shows entered', 'Placings', 'Pro cards'])],
  },
  'Artistic Gymnastics': {
    venue: 'Gym / Training center / Arena',
    rename: {
      squad: 'Squad / Gymnasts roster',
      formation: 'Team lineup (per apparatus)',
      typicalLineup: 'All-Around vs Specialists',
      honors: 'Palmares / Medals',
      bTeam: 'Junior team',
    },
    remove: ['marketValue'],
    add: [
      field('Disciplines / Apparatus (MAG: Floor, Pommel, Rings, Vault, P-bars, H-Bar / WAG: Vault, Bars, Beam, Floor)'),
      field('Categories', ['Senior', 'Junior', 'Elite']),
      field('Code of Points / Difficulty level'),
      field('National federation affiliation'),
    ],
    seasonStats: season(['Team score', 'Apparatus scores', 'World ranking', 'Qualification status']),
  },
  Judo: {
    venue: 'Dojo / Arena',
    rename: {
      management: 'Management / Sensei',
      championship: 'Championship (IJF circuit)',
      squad: 'Squad / Judokas',
      formation: 'Team lineup by weight categories',
      honors: 'Palmares / Titles / Medals',
      bTeam: 'Junior team',
    },
    remove: NO_LINEUP_NO_VALUE,
    add: [field('Weight classes'), field('Dan grades / Belts'), field('Fighting system', ['Shiai', 'Kata'])],
    seasonStats: season(['Team matches won', 'Individual bouts won', 'Ippons', 'Ranking position']),
  },
  Karate: {
    venue: 'Dojo / Honbu dojo / Arena',
    rename: {
      technicalStaff: 'Master / Staff',
      championship: 'Championship (WKF / Style affiliation)',
      squad: 'Squad / Athletes',
      formation: 'Team composition (Kumite by weight / Kata team)',
      honors: 'Palmares / Medals',
      bTeam: 'Junior team',
    },
    remove: NO_LINEUP_NO_VALUE,
    add: [
      field('Style', ['Shotokan', 'Goju-ryu', 'Shito-ryu', 'Wado-ryu', 'Other']),
      field('Discipline', ['Kata', 'Kumite', 'Both']),
      field('Weight categories / Dan grade'),
      field('Belt system'),
    ],
    seasonStats: season(['Matches won', 'Katas score', 'Points', 'Team ranking']),
  },
  'Jiu-Jitsu': {
    venue: 'Academy / Dojo / Mat',
    rename: {
      technicalStaff: 'Professor / Staff',
      championship: 'Championship (IBJJF / AJP / ADCC)',
      squad: 'Squad / Competitors',
      formation: 'Team lineup by belt & weight',
      honors: 'Palmares / Titles / Medals',
      bTeam: 'Kids team',
    },
    remove: NO_LINEUP_NO_VALUE,
    add: [
      field('Belt system / Graduation'),
      field('Gi / No-Gi divisions'),
      field('Weight classes'),
      field('Lineage'),
    ],
    seasonStats: season(['Matches won', 'Submissions', 'Points', 'Team trophy standing']),
  },
  Kickboxing: {
    venue: 'Gym / Fight gym / Arena',
    rename: {
      championship: 'Championship (WAKO, Glory, ONE, K-1 etc.)',
      squad: 'Squad / Fighters',
      formation: 'Fight card lineup by weight class',
      honors: 'Palmares / Titles / Belts',
      bTeam: 'Junior team',
    },
    remove: NO_LINEUP_NO_VALUE,
    add: [
      field('Weight classes / Divisions'),
      field('Disciplines', ['K-1', 'Low Kick', 'Full Contact']),
      field('Belt / Ranking system'),
    ],
    seasonStats: season(['Record (W-L-D)', 'KOs', 'Team ranking']),
  },
  Boxing: {
    venue: 'Gym / Boxing club / Arena',
    rename: {
      management: 'Management / Promoter',
      technicalStaff: 'Trainer / Staff / Cutman',
      championship: 'Championship / Promotion',
      squad: 'Squad / Boxers roster',
      formation: 'Fight card lineup by weight class',
      honors: 'Palmares / Titles / Belts',
      bTeam: 'Junior team',
    },
    remove: NO_LINEUP_NO_VALUE,
    add: [
      field('Weight classes (Heavyweight, Middleweight, etc.)'),
      field('Federation / Sanctioning body', ['WBC', 'WBA', 'IBF', 'WBO', 'IBA Amateur']),
      field('Category', ['Amateur', 'Pro', 'Olympic']),
      field('Stance', ['Orthodox', 'Southpaw']),
    ],
    seasonStats: season(['Record (W-L-D)', 'KOs', 'Win streak', 'Team ranking / Gym ranking']),
  },
  Padel: {
    venue: 'Padel club / Courts',
    rename: {
      squad: 'Squad / Players / Pairs',
      formation: 'Team lineup / Pairs formation (Pair 1, Pair 2, Pair 3)',
      honors: 'Palmares / Titles',
      youthAcademy: 'Padel academy',
    },
    remove: ['typicalLineup', 'marketValue', 'bTeam'],
    add: [
      field('Number of courts (Indoor/Outdoor, Panoramic)'),
      field('Surface type'),
      field('Level / Categories', ['Open', 'Beginners', 'Mixed']),
      field('FIP ranking'),
    ],
    seasonStats: season(['Matches won', 'Sets won', 'Games won', 'Team points / Ranking']),
  },
  Rugby: {
    venue: 'Stadium',
    rename: {
      squad: 'Squad / Roster',
      formation: 'Formation (15 / 7s) / Starting XV',
      typicalLineup: 'Bench (23)',
      honors: 'Palmares',
      bTeam: 'Junior team',
    },
    add: [
      field('Position roles (Forwards / Backs)'),
      field('Rugby code', ['Union XV', 'League XIII', 'Sevens']),
      field('Federation / Conference'),
      field('World Rugby ranking'),
    ],
    seasonStats: season([
      'W-D-L',
      'Points for',
      'Points against',
      'Tries',
      'Bonus points (offensive)',
      'Bonus points (defensive)',
      'Table points',
      'Yellow/Red cards',
    ]),
  },
  Swim: {
    venue: 'Aquatic center / Pool (25m / 50m)',
    rename: {
      championship: 'Championship / Circuit',
      squad: 'Squad / Swimmers roster',
      formation: 'Team lineup by event / Relay teams',
      honors: 'Palmares / Medals / Records',
      bTeam: 'Junior team',
    },
    remove: NO_LINEUP_NO_VALUE,
    add: [
      field('Strokes / Specialties (Freestyle, Backstroke, Breaststroke, Butterfly, Medley)'),
      field('Distances (50m, 100m, 200m, etc.)'),
      field('Categories', ['Junior', 'Senior', 'Elite', 'Masters']),
      field('Federation (World Aquatics, LEN)'),
    ],
    seasonStats: season(['Team points', 'Medals count', 'World ranking', 'Best times', 'Records']),
  },
  Tennis: {
    venue: 'Tennis club / Courts',
    rename: {
      technicalStaff: 'Captain / Staff',
      championship: 'Championship (Davis Cup / BJK Cup / UTS / National league)',
      squad: 'Squad / Players roster',
      formation: 'Team lineup / Singles order (Singles 1, 2 / Doubles)',
      honors: 'Palmares / Titles',
      bTeam: 'Junior team',
    },
    remove: NO_LINEUP_NO_VALUE,
    add: [
      field('Federation affiliation', ['ATP', 'WTA', 'ITF']),
      field('Surface', ['Hard', 'Clay', 'Grass', 'Indoor']),
      field('Number of courts'),
      field('Categories / Rankings (ATP/WTA points, ITF ranking)'),
      field('Singles / Doubles / Mixed'),
    ],
    seasonStats: season(['Tie Win-Loss', 'Matches Win-Loss', 'Sets Win-Loss', 'Team ranking']),
  },
  'Track & Fields': {
    venue: 'Athletic stadium / Track / Field',
    rename: {
      championship: 'Championship / Circuit (Diamond League, National champs)',
      squad: 'Squad / Athletes roster',
      formation: 'Team lineup by discipline / Relay teams',
      honors: 'Palmares / Medals / Titles',
      bTeam: 'Junior team',
    },
    remove: NO_LINEUP_NO_VALUE,
    add: [
      field('Disciplines / Events (Sprints, Middle distance, Long distance, Hurdles, Jumps, Throws, Combined events, Relays)'),
      field('Categories', ['Men', 'Women', 'Indoor', 'Outdoor']),
      field('Federation (World Athletics, Continental)'),
      field('Records (World, National, Club)'),
    ],
    seasonStats: season([
      'Team points / Scoring table',
      'Medals',
      'Personal bests (PB)',
      'Season bests (SB)',
      'Records',
    ]),
  },
  Volley: {
    venue: 'Arena / Stadium',
    rename: {
      squad: 'Squad / Roster',
      formation: 'Formation / Starting six (4-2, 5-1, 6-2) / Libero system',
      honors: 'Palmares',
      bTeam: 'Junior team',
    },
    remove: ['typicalLineup'],
    add: [
      field('Roster by role (Setter, Outside hitter, Opposite, Middle blocker, Libero)'),
      field('Federation', ['FIVB', 'CEV', 'National']),
      field('Court type', ['Indoor', 'Beach', 'Sitting']),
      field('Ranking / CEV coefficient'),
    ],
    seasonStats: season([
      'W-L',
      '3-0 / 3-1 / 3-2 wins',
      'Sets won/lost',
      'Points',
      'Set ratio',
    ]),
  },
  Rowing: {
    venue: 'Boathouse / Lake / River / Course (2000m)',
    rename: {
      championship: 'Championship / Regatta circuit',
      squad: 'Squad / Rowers roster',
      formation: 'Boat lineup / Crews (1x, 2x, 2-, 4x, 4-, 8+) + Cox',
      honors: 'Palmares / Titles / Medals',
      bTeam: 'Junior team',
    },
    remove: NO_LINEUP_NO_VALUE,
    add: [
      field('Boat classes (1x, 2x, 2-, 4x, 4-, 8+ / Lightweight / Para)'),
      field('Categories (Sweep / Scull, Men / Women, U23 / Junior)'),
      field('Federation (World Rowing, National)'),
      field('Discipline', ['Coastal', 'Indoor', 'Olympic']),
    ],
    seasonStats: season(['Regatta wins', 'Podiums', 'Team points', 'Best times', 'World ranking']),
  },
  'Canoe\\Kayak': {
    venue: 'Canoe club / Boathouse / Course (Flatwater, Whitewater, Slalom)',
    rename: {
      championship: 'Championship / Circuit',
      squad: 'Squad / Athletes roster',
      formation: 'Team lineup by boat class / Crew',
      honors: 'Palmares / Medals / Titles',
      bTeam: 'Junior team',
    },
    remove: NO_LINEUP_NO_VALUE,
    add: [
      field('Disciplines (Sprint / Slalom / Wildwater / Marathon / Canoe Polo / Dragon Boat)'),
      field('Boat classes (C1, C2, C4, K1, K2, K4)'),
      field('Distances (200m, 500m, 1000m, 5000m)'),
      field('Categories (Men / Women / Para / U23)'),
      field('Federation (ICF, ECA, National)'),
    ],
    seasonStats: season(['Wins / Podiums', 'Team points', 'Best times', 'Ranking']),
  },
  Skiing: {
    venue: 'Ski club / Base / Home slopes / Resort',
    rename: {
      championship: 'Championship / Circuit (World Cup)',
      squad: 'Squad / Skiers roster',
      formation: 'Team lineup by discipline',
      honors: 'Palmares / Titles / Medals',
      bTeam: 'Junior team',
    },
    remove: NO_LINEUP_NO_VALUE,
    add: [
      field('Disciplines (Alpine, Nordic, Freestyle, Snowboard, Biathlon)'),
      field('Categories (Men / Women, FIS points)'),
      field('Federation (FIS, IBU for Biathlon)'),
      field('Equipment / Ski brand'),
    ],
    seasonStats: season([
      'World Cup points',
      'Podiums',
      'Victories',
      'Overall ranking',
      'Best times',
    ]),
  },
  Surf: {
    venue: 'Home break / Surf spot / Beach',
    rename: {
      technicalStaff: 'Staff / Shaper',
      championship: 'Championship / Circuit (WSL, National)',
      squad: 'Squad / Surfers roster',
      formation: 'Team lineup / Heat strategy',
      honors: 'Palmares / Titles / Trophies',
      bTeam: 'Groms team',
    },
    remove: NO_LINEUP_NO_VALUE,
    add: [
      field('Disciplines', ['Shortboard', 'Longboard', 'Big Wave', 'SUP', 'Bodyboard']),
      field('Categories', ['Men', 'Women', 'Junior', 'Masters']),
      field('Federation (ISA, WSL, National)'),
      field('Stance', ['Regular', 'Goofy']),
      field('Board specs'),
    ],
    seasonStats: season(['Heat wins', 'Average score', 'Ranking', 'Championship Tour points']),
  },
  'Roller Sports': {
    venue: 'Rink / Track',
    rename: {
      squad: 'Squad / Athletes roster',
      formation: 'Team lineup by discipline',
      bTeam: 'Junior team',
    },
    remove: NO_LINEUP_NO_VALUE,
    add: [
      field('Disciplines', ['Speed', 'Freestyle', 'Figure', 'Inline Hockey', 'Roller Derby']),
      field('Speciality / Category'),
    ],
    seasonStats: season(['Wins', 'Podiums', 'Team points', 'Best time / Score', 'Ranking']),
  },
  'Ice\\Field Hockey': {
    venue: 'Arena / Stadium',
    rename: {
      formation: 'Line system (Ice: 3 lines + D pairs / Field: 4-4-2, 3-5-2)',
      typicalLineup: 'Power play / Penalty kill units',
      honors: 'Palmares / Titles',
    },
    remove: ['bTeam'],
    add: [
      field('Position roles (Ice: Goalie, Defenseman, Center, Winger / Field: Goalkeeper, Defender, Midfielder, Forward)'),
      field('Federation', ['IIHF', 'FIH']),
      field('Surface', ['Ice rink', 'Astro turf']),
      field('Categories (Indoor / Outdoor for Field)'),
    ],
    seasonStats: season([
      'W-L-OTL',
      'Goals for/against',
      'Points',
      'PIM (Ice)',
      'Penalty corners (Field)',
    ]),
  },
  Polo: {
    venue: 'Polo field / Club',
    rename: {
      management: 'Management / Patron',
      championship: 'Championship / Circuit (High, Medium, Low goal)',
      formation: 'Team lineup by position (1-4) / Handicap combination',
      typicalLineup: 'Starting 4',
      honors: 'Palmares / Titles',
      marketValue: 'Horse value',
    },
    remove: ['bTeam'],
    add: [
      field('Handicap (individual -2 to 10, team total)'),
      field('Horses / String / Pony list'),
      field('Federation', ['FIP', 'HPA', 'USPA']),
      field('Categories', ['Arena', 'Beach', 'Snow', 'Grass']),
      field('Discipline (Polo type)'),
    ],
    seasonStats: season([
      'Chukkers won',
      'Goals scored',
      'Team handicap',
      'Ranking',
      'Fouls / Penalties (30, 40, 60 yard)',
    ]),
  },
  Golf: {
    venue: 'Home course / Golf club',
    rename: {
      technicalStaff: 'Coach / Caddie staff',
      championship: 'Championship / Tour (PGA, DP World, LIV)',
      squad: 'Squad / Golfers roster',
      formation: 'Team lineup (Singles / Foursomes / Fourball)',
      honors: 'Palmares / Titles / Majors',
      bTeam: 'Junior team',
    },
    remove: NO_LINEUP_NO_VALUE,
    add: [
      field('Format', ['Stroke Play', 'Match Play', 'Ryder Cup style']),
      field('Categories', ['Men', 'Women', 'Amateur', 'Senior']),
      field('Federation', ['R&A', 'USGA', 'PGA']),
      field('Handicap / OWGR'),
    ],
    seasonStats: season([
      'Wins',
      'Top 10s',
      'Cuts made',
      'FedEx / Race to Dubai points',
      'Scoring average',
      'World ranking',
    ]),
  },
  Sailing: {
    venue: 'Yacht club / Home marina / Waters',
    rename: {
      management: 'Management / Skipper',
      technicalStaff: 'Coach / Shore team',
      championship: "Championship / Regatta circuit (America's Cup, SailGP, The Ocean Race)",
      squad: 'Squad / Sailors roster',
      formation: 'Crew roles (Helmsman, Tactician, Trimmer, Grinder, Bow)',
      honors: 'Palmares / Titles / Trophies',
      bTeam: 'Junior team',
    },
    remove: NO_LINEUP_NO_VALUE,
    add: [
      field('Boat / Class (AC75, F50, IMOCA, ILCA, 470, 49er, etc.)'),
      field('Disciplines', ['Fleet', 'Match Racing', 'Offshore', 'Olympic Classes']),
      field('Categories', ['Men', 'Women', 'Mixed', 'Youth']),
      field('Federation (World Sailing, National)'),
      field('Boat specs / Sail number'),
    ],
    seasonStats: season(['Regatta wins', 'Podiums', 'Series points', 'Leaderboard position']),
  },
  Cycling: {
    venue: 'Service course / HQ base / Training camp',
    rename: {
      management: 'Management / General manager',
      technicalStaff: 'Sport director / Staff',
      championship: 'Circuit (UCI WorldTour, ProTeam, Continental)',
      squad: 'Squad / Riders roster',
      formation: 'Rider roles: Leader (GC/Sprinter/Climber), Domestique, Rouleur, Puncheur',
      honors: 'Palmares / Titles / Wins',
      bTeam: 'Development team',
      marketValue: 'UCI points value',
    },
    remove: ['typicalLineup'],
    add: [
      field('Kit'),
      field('Discipline', ['Road', 'Track', 'MTB', 'Cyclocross', 'BMX', 'Gravel']),
      field('UCI license level'),
      field('Bikes / Equipment supplier'),
      field('Federation (UCI)'),
      field('Categories', ['Men', 'Women', 'U23']),
    ],
    seasonStats: season(['Stage wins', 'GC wins', 'Monuments', 'UCI points', 'Ranking']),
  },
  'American Football': {
    venue: 'Stadium',
    rename: {
      management: 'GM / Management',
      technicalStaff: 'Coordinators / Staff (Head Coach, OC, DC, ST)',
      championship: 'Championship / Conference / Division (NFL, NCAA, XFL, etc.)',
      formation: 'Offensive formation (Shotgun, I-Form, Spread)',
      typicalLineup: 'Defensive formation (3-4, 4-3, Nickel) + Special teams',
      honors: 'Palmares / Super Bowls / Titles',
      youthAcademy: 'Draft / Farm team',
      bTeam: 'Practice squad',
      marketValue: 'Contract / Cap hit',
    },
    add: [
      field('Helmet'),
      field('Positions (QB, RB, WR, TE, OL, DL, LB, CB, S, K, P)'),
      field('Roster cuts (53-man roster, Practice squad, IR)'),
      field('Draft picks'),
      field('Salary cap'),
      field('Federation', ['NFL', 'NCAA', 'Other']),
    ],
    seasonStats: season([
      'W-L-T',
      'Points for/against',
      'Division standings',
      'Playoffs',
      'Flags / Penalties (yards)',
    ]),
  },
  'Beach Volley': {
    venue: 'Home beach / Training center',
    rename: {
      championship: 'Championship / Tour (FIVB World Tour, AVP, National)',
      formation: 'Service formation / Defensive system (Left/Right, Blocker/Defender roles)',
      honors: 'Palmares / Titles / Medals',
    },
    remove: ['typicalLineup', 'marketValue', 'bTeam'],
    add: [
      field('Team size', ['2 players (no subs)']),
      field('Surface', ['Sand', 'Indoor beach']),
      field('Federation (FIVB)'),
      field('Categories', MEN_WOMEN),
      field('FIVB ranking'),
    ],
    seasonStats: season(['Match wins-losses', 'Set wins-losses', 'Points ratio', 'Ranking points']),
  },
  Handball: {
    venue: 'Arena / Stadium',
    rename: {
      formation: 'System 6-0, 5-1, 3-2-1 (Defense) + 7v6 attack',
      honors: 'Palmares / Titles',
    },
    remove: ['bTeam'],
    add: [
      field('Position roles (Goalkeeper, Left/Right wing, Left/Right back, Centre back, Pivot)'),
      field('Federation', ['IHF', 'EHF']),
      field('Categories (Indoor / Beach handball, Men / Women)'),
    ],
    seasonStats: season(['W-D-L', 'Goals for/against', 'Points', '2min suspensions', '7m penalties']),
  },
  'Table Tennis': {
    venue: 'Club hall / Arena / Training center',
    rename: {
      championship: 'Championship (e.g. Bundesliga, Super League, ITTF Club Champ)',
      formation: 'Line-up order (Singles 1, Singles 2, Doubles)',
      typicalLineup: 'Playing hand (Right/Left) / Grip style',
      honors: 'Palmares / Titles',
    },
    remove: ['marketValue', 'bTeam'],
    add: [
      field('Discipline', ['Singles', 'Doubles', 'Mixed', 'Team Event']),
      field('Category', MEN_WOMEN),
      field('Equipment: Blade / Rubber supplier'),
      field('ITTF world ranking per player'),
      field('Federation (ITTF)'),
    ],
    seasonStats: season(['Team match W-L', 'Individual match W-L', 'Sets W-L', 'Points W-L']),
  },
  Badminton: {
    venue: 'Badminton hall / Arena',
    rename: {
      championship: 'Championship (Thomas & Uber Cup, Sudirman Cup, National league, BWF World Tour)',
      formation: 'Team tie line-up: MS1, MS2, WS1, WS2, MD, WD',
      typicalLineup: 'Playing hand / Singles-Doubles specialist',
      honors: 'Palmares / Titles',
    },
    remove: ['marketValue', 'bTeam'],
    add: [
      field('Discipline', ['Singles', 'Doubles', 'Mixed Doubles', 'Team']),
      field('Categories', MEN_WOMEN),
      field('Equipment: Racket / Shuttle supplier'),
      field('BWF world ranking per player'),
      field('Federation (BWF)'),
    ],
    seasonStats: season(['Tie W-L', 'Match W-L', 'Game W-L', 'Points W-L']),
  },
  Weightlifting: {
    venue: 'Weightlifting hall / Training center',
    rename: {
      championship: 'Championship (National league, Bundesliga Gewichtheben)',
      squad: 'Squad / Lifters roster',
      formation: 'Weight classes lineup (55kg, 61kg, 73kg, 89kg, 102kg etc.)',
      typicalLineup: 'Lifter category + Snatch / Clean & Jerk specialist',
      honors: 'Palmares / Titles / Medals',
    },
    remove: ['marketValue', 'bTeam'],
    add: [
      field('Discipline', ['Snatch', 'Clean & Jerk', 'Total']),
      field('Weight category'),
      field('Best lifts (Personal records)'),
      field('Sinclair / Robi points'),
      field('Federation (IWF)'),
      field('Categories', ['Men', 'Women']),
    ],
    seasonStats: season(['Team Sinclair points', 'Match wins', 'Total kg lifted', 'Records']),
  },
  Gymnastic: {
    venue: 'Gym / Training center / Arena',
    rename: {
      technicalStaff: 'Staff / Choreographer / Physio',
      championship: 'Championship (Serie A Gymnastics, Bundesliga, NCAA Gymnastics)',
      squad: 'Squad / Gymnasts roster',
      formation: 'Apparatus line-up (Artistic men / women, Rhythmic: Hoop, Ball, Clubs, Ribbon)',
      honors: 'Palmares / Titles / Medals',
    },
    remove: ['typicalLineup', 'marketValue', 'bTeam'],
    add: [
      field('Discipline', ['Artistic', 'Rhythmic', 'Trampoline', 'Acrobatic', 'Aerobic']),
      field('Categories (Men / Women, Senior / Junior)'),
      field('Specialties', ['All-Around', 'Apparatus Specialist']),
      field('Federation (FIG)'),
      field('Code of Points'),
    ],
    seasonStats: season(['Team score', 'Apparatus scores', 'D-Score / E-Score', 'Ranking']),
  },
  Wrestling: {
    venue: 'Wrestling hall / Mat arena',
    rename: {
      championship: 'Championship (Bundesliga Ringen, NCAA Wrestling, Team World Cup)',
      squad: 'Squad / Wrestlers roster',
      formation: 'Weight classes line-up (57kg, 65kg, 74kg, 86kg, 97kg, 125kg etc.)',
      typicalLineup: 'Style (Freestyle / Greco-Roman / Folkstyle) + Weight class',
      honors: 'Palmares / Titles / Medals',
    },
    remove: ['marketValue', 'bTeam'],
    add: [
      field('Discipline', ['Freestyle', 'Greco-Roman', 'Folkstyle/Collegiate', 'Beach', 'Sumo']),
      field('Weight category'),
      field('Bout result types (Fall, Tech Fall, Decision)'),
      field('Federation (UWW)'),
      field('Categories', ['Men', 'Women']),
    ],
    seasonStats: season(['Team dual W-L', 'Bout W-L', 'Classification points', 'Technical points']),
  },
  Triathlon: {
    venue: 'Home base / Training center',
    rename: {
      championship: 'Championship (Super League Triathlon, Bundesliga Triathlon, Mixed Team Relay Series)',
      squad: 'Squad / Athletes roster',
      formation: 'Relay order: Leg 1-4 / Discipline specialist',
      honors: 'Palmares / Titles / Medals',
    },
    remove: ['typicalLineup', 'marketValue', 'bTeam'],
    add: [
      field('Discipline format', [
        'Sprint',
        'Olympic',
        'Middle',
        'Long/Ironman',
        'Mixed Team Relay',
        'Duathlon',
        'Aquathlon',
      ]),
      field('Distance per discipline'),
      field('Individual best times / PBs / Splits (Swim/Bike/Run/T1-T2)'),
      field('Federation (World Triathlon)'),
      field('Categories (Men / Women / Mixed Relay, Elite / U23 / Junior)'),
      field('Equipment: Bike brand, Wetsuit supplier'),
    ],
    seasonStats: season(['Team points', 'Individual times', 'Split times', 'Ranking']),
  },
  'Motor Sports': {
    venue: 'Garage / Paddock / Factory / Circuit base',
    rename: {
      management: 'Team principal / Management',
      technicalStaff: 'Race engineer, Chief mechanic, Strategist',
      championship: 'Championship (F1, MotoGP, WEC, WRC, Formula E, NASCAR)',
      squad: 'Drivers / Riders lineup + Reserve / Test driver',
      formation: 'Car/Bike package: Chassis + Power unit / Constructor',
      typicalLineup: 'Driver 1 / Driver 2 + Role (Lead, Second driver)',
      honors: 'Palmares / Constructors & Drivers championships',
      youthAcademy: 'Driver academy',
      bTeam: 'Junior team',
    },
    add: [
      field('Livery'),
      field('Series / Discipline (F1, Moto2, Rally, Endurance, Karting)'),
      field('Vehicle number + Engine / Manufacturer'),
      field('Circuit / Race calendar'),
      field('Federation', ['FIA', 'FIM']),
      field('Categories', ['Factory Team', 'Customer Team', 'Privateer']),
      field('Tyre / Fuel supplier'),
    ],
    seasonStats: season([
      'Races entered',
      'Wins',
      'Podiums',
      'Poles',
      'Fastest laps',
      'DNF',
      'Constructors points',
      'Drivers points',
    ]),
  },
  Netball: {
    venue: 'Arena / Stadium',
    rename: {
      championship: 'Championship / Division (Super League, Suncorp Super Netball, ANZ Premiership)',
      formation: 'Court formation: 7 positions (GS, GA, WA, C, WD, GD, GK) - Starting 7 + Bench',
      honors: 'Palmares / Titles',
      youthAcademy: 'Youth academy / Pathway',
    },
    remove: ['bTeam'],
    add: [
      field('Position roles (Shooter, Midcourt, Defender)'),
      field('Federation (World Netball)'),
      field('Categories (Women / Mixed, Indoor)'),
      field('Shooting stats per player (Goals attempted / made)'),
    ],
    seasonStats: season([
      'W-L-D',
      'Goals scored/conceded',
      'Shooting % (G%)',
      'Turnovers',
      'Intercepts',
    ]),
  },
  Squash: {
    venue: 'Squash club / Glass court arena',
    rename: {
      championship: 'Championship (PSL, Bundesliga Squash, College Squash)',
      formation: 'Line-up order (No.1, No.2, No.3, No.4, No.5)',
      typicalLineup: 'Playing hand (R/L)',
      honors: 'Palmares / Titles',
    },
    remove: ['marketValue', 'bTeam'],
    add: [
      field('Discipline', ['Singles', 'Doubles']),
      field('Categories', MEN_WOMEN),
      field('PSA world ranking per player'),
      field('Federation', ['WSF', 'PSA']),
    ],
    seasonStats: season(['Team tie W-L', 'Individual match W-L', 'Games W-L', 'Points W-L']),
  },
  Curling: {
    venue: 'Curling club / Ice arena',
    rename: {
      championship: 'Championship (World Curling Tour, National league)',
      squad: 'Rink / Team',
      formation: 'Line-up order: Lead, Second, Third/Vice-Skip, Skip/Fourth + Alternate',
      typicalLineup: 'Throwing order + Role (Skip calls game)',
      honors: 'Palmares / Titles',
    },
    remove: ['marketValue', 'bTeam'],
    add: [
      field('Discipline', ["Men's", "Women's", 'Mixed Doubles', 'Mixed Team', 'Wheelchair']),
      field('Handedness (Right/Left) + Broom / Stone supplier'),
      field('Federation (World Curling)'),
      field('Skip name as team identity'),
    ],
    seasonStats: season([
      'W-L',
      'Ends won/lost',
      'Points for/against',
      'Shooting %',
      'Hammer efficiency',
    ]),
  },
  'Fitness\\Gym': {
    venue: 'Gym / Facility',
    remove: ['formation', 'typicalLineup', 'marketValue', 'bTeam'],
    add: [],
    seasonStats: [],
  },
};

/** Every English text of the team profiles, for the Section languages. */
export function teamSportProfileTexts(): string[] {
  const out: string[] = [
    ...BASE_PROFILE_FIELDS.map((f) => f.label),
    ...BASE_INFO_FIELDS.map((f) => f.label),
  ];
  for (const p of Object.values(PROFILES)) {
    out.push(p.venue, ...Object.values(p.rename ?? {}));
    p.add.forEach((d) => out.push(d.label, ...(d.options ?? [])));
    p.seasonStats.forEach((g) => out.push(g.title, ...g.items.map((i) => i.label)));
  }
  return out;
}

export function teamSportProfile(sport: string | null | undefined): TeamSportProfile {
  return PROFILES[normalizeEntitySport(sport)];
}

function resolveBase(
  profile: TeamSportProfile,
  base: readonly { key: BaseKey; label: string }[],
): SportFieldDef[] {
  const removed = new Set(profile.remove ?? []);
  return base
    .filter((f) => !removed.has(f.key))
    .map((f) => ({ key: f.key, label: profile.rename?.[f.key] ?? f.label }));
}

/** Fields of the "Sport profile" card on the Team Profile tab. */
export function teamSportProfileFields(sport: string | null | undefined): SportFieldDef[] {
  const profile = teamSportProfile(sport);
  return [...resolveBase(profile, BASE_PROFILE_FIELDS), ...profile.add];
}

/** Season-independent items shown on the Statistics tab (Market value, Youth academy…). */
export function teamSportInfoFields(sport: string | null | undefined): SportFieldDef[] {
  return resolveBase(teamSportProfile(sport), BASE_INFO_FIELDS);
}
