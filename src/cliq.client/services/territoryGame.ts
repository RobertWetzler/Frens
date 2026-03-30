// Territory Game types and mock service for April Fools' r/Place-style map game

export interface TerritoryCell {
  row: number;
  col: number;
  claimedBy: string | null; // userId
  claimedByName: string | null;
  color: string | null;
  claimedAt: string | null;
}

export interface TerritoryPlayer {
  userId: string;
  displayName: string;
  color: string;
  cellsClaimed: number;
}

export interface TerritoryRegistration {
  userId: string;
  color: string;
  registeredAt: string;
}

export interface TerritoryGameState {
  isRegistered: boolean;
  playerColor: string | null;
  lastClaimTime: string | null;
  canClaim: boolean;
  cooldownSeconds: number;
}

// Grid cell size in degrees (500 feet ≈ 152.4 meters per side)
// Latitude: 152.4m / 111,320 m/deg ≈ 0.001369°
// Longitude: varies by latitude; ~0.001785° at 40°N
export const CELL_SIZE_LAT = 0.001369;
export const CELL_SIZE_LNG = 0.001785;
export const CLAIM_COOLDOWN_MS = 60_000; // 1 minute
export const GRID_VISIBLE_RADIUS = 8; // show 17x17 grid

export const TERRITORY_COLORS = [
  // Reds & Pinks
  '#FF4444', // Red
  '#E53935', // Crimson
  '#FF1493', // Deep Pink
  '#FF69B4', // Hot Pink
  '#F48FB1', // Soft Pink
  // Oranges & Yellows
  '#FF8C00', // Orange
  '#FF6347', // Tomato
  '#FFA07A', // Light Salmon
  '#FFD700', // Gold
  '#FFEB3B', // Yellow
  // Greens
  '#32CD32', // Lime Green
  '#00FA9A', // Medium Spring Green
  '#4CAF50', // Forest Green
  '#00E676', // Neon Green
  '#81C784', // Sage
  // Teals & Cyans
  '#00CED1', // Dark Turquoise
  '#20B2AA', // Light Sea Green
  '#26C6DA', // Cyan
  '#009688', // Teal
  // Blues
  '#1E90FF', // Dodger Blue
  '#00BFFF', // Deep Sky Blue
  '#42A5F5', // Cornflower
  '#1565C0', // Royal Blue
  '#5C6BC0', // Indigo
  // Purples
  '#8A2BE2', // Blue Violet
  '#7B68EE', // Medium Slate Blue
  '#AB47BC', // Amethyst
  '#DA70D6', // Orchid
  '#CE93D8', // Lavender
  // Earth & Neutrals
  '#8D6E63', // Brown
  '#78909C', // Steel
  '#607D8B', // Slate
  '#F06292', // Rose
  '#E91E63', // Magenta
];

/** Snap a lat/lng to the grid cell row/col */
export function coordsToCell(lat: number, lng: number): { row: number; col: number } {
  return {
    row: Math.floor(lat / CELL_SIZE_LAT),
    col: Math.floor(lng / CELL_SIZE_LNG),
  };
}

/** Get center lat/lng of a cell */
export function cellToCoords(row: number, col: number): { lat: number; lng: number } {
  return {
    lat: (row + 0.5) * CELL_SIZE_LAT,
    lng: (col + 0.5) * CELL_SIZE_LNG,
  };
}

/** Get lat/lng bounding box of a cell: [[south, west], [north, east]] */
export function cellToBounds(row: number, col: number): [[number, number], [number, number]] {
  return [
    [row * CELL_SIZE_LAT, col * CELL_SIZE_LNG],
    [(row + 1) * CELL_SIZE_LAT, (col + 1) * CELL_SIZE_LNG],
  ];
}

// ─── Mock service (replace with real API calls later) ───

let mockRegistration: TerritoryRegistration | null = null;
let mockCells: Map<string, TerritoryCell> = new Map();
let mockLastClaimTime: number | null = null;

function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}

// Seed some mock claimed cells around a location
function seedMockCells(centerRow: number, centerCol: number) {
  if (mockCells.size > 0) return; // already seeded
  const mockPlayers = [
    { userId: 'mock-1', name: 'Alex', color: '#FF4444' },
    { userId: 'mock-2', name: 'Jordan', color: '#1E90FF' },
    { userId: 'mock-3', name: 'Sam', color: '#32CD32' },
    { userId: 'mock-4', name: 'Taylor', color: '#FF69B4' },
    { userId: 'mock-5', name: 'Casey', color: '#FFD700' },
  ];
  // Scatter ~40 claimed cells around center
  for (let i = 0; i < 40; i++) {
    const dr = Math.floor(Math.random() * 20) - 10;
    const dc = Math.floor(Math.random() * 20) - 10;
    const player = mockPlayers[Math.floor(Math.random() * mockPlayers.length)];
    const r = centerRow + dr;
    const c = centerCol + dc;
    const key = cellKey(r, c);
    if (!mockCells.has(key)) {
      mockCells.set(key, {
        row: r,
        col: c,
        claimedBy: player.userId,
        claimedByName: player.name,
        color: player.color,
        claimedAt: new Date(Date.now() - Math.random() * 3600000).toISOString(),
      });
    }
  }
}

export const TerritoryGameService = {
  /** Check if current user has registered for the game */
  async getGameState(): Promise<TerritoryGameState> {
    const now = Date.now();
    const cooldownRemaining = mockLastClaimTime
      ? Math.max(0, CLAIM_COOLDOWN_MS - (now - mockLastClaimTime))
      : 0;

    return {
      isRegistered: mockRegistration !== null,
      playerColor: mockRegistration?.color ?? null,
      lastClaimTime: mockLastClaimTime ? new Date(mockLastClaimTime).toISOString() : null,
      canClaim: cooldownRemaining === 0,
      cooldownSeconds: Math.ceil(cooldownRemaining / 1000),
    };
  },

  /** Register for the game with a chosen color */
  async register(color: string): Promise<TerritoryRegistration> {
    mockRegistration = {
      userId: 'current-user',
      color,
      registeredAt: new Date().toISOString(),
    };
    return mockRegistration;
  },

  /** Get claimed cells in a region */
  async getNearbyCells(centerRow: number, centerCol: number, radius: number): Promise<TerritoryCell[]> {
    seedMockCells(centerRow, centerCol);
    const cells: TerritoryCell[] = [];
    for (let r = centerRow - radius; r <= centerRow + radius; r++) {
      for (let c = centerCol - radius; c <= centerCol + radius; c++) {
        const cell = mockCells.get(cellKey(r, c));
        if (cell) cells.push(cell);
      }
    }
    return cells;
  },

  /** Claim a cell */
  async claimCell(row: number, col: number): Promise<TerritoryCell> {
    if (!mockRegistration) throw new Error('Not registered');
    const now = Date.now();
    if (mockLastClaimTime && now - mockLastClaimTime < CLAIM_COOLDOWN_MS) {
      throw new Error('Cooldown active');
    }
    const cell: TerritoryCell = {
      row,
      col,
      claimedBy: mockRegistration.userId,
      claimedByName: 'You',
      color: mockRegistration.color,
      claimedAt: new Date().toISOString(),
    };
    mockCells.set(cellKey(row, col), cell);
    mockLastClaimTime = now;
    return cell;
  },

  /** Get leaderboard */
  async getLeaderboard(): Promise<TerritoryPlayer[]> {
    // Aggregate from mock cells
    const playerMap = new Map<string, TerritoryPlayer>();
    for (const cell of mockCells.values()) {
      if (!cell.claimedBy) continue;
      const existing = playerMap.get(cell.claimedBy);
      if (existing) {
        existing.cellsClaimed++;
      } else {
        playerMap.set(cell.claimedBy, {
          userId: cell.claimedBy,
          displayName: cell.claimedByName || 'Unknown',
          color: cell.color || '#999',
          cellsClaimed: 1,
        });
      }
    }
    return Array.from(playerMap.values()).sort((a, b) => b.cellsClaimed - a.cellsClaimed);
  },
};
