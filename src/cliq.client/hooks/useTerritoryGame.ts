import { useCallback, useEffect, useRef, useState } from 'react';
import {
  TerritoryCell,
  TerritoryPlayer,
  TerritoryGameState,
  CityLeaderboard,
  PowerupLocation,
  PowerupInventoryItem,
  PowerupUseResult,
  coordsToCell,
  CLAIM_COOLDOWN_MS,
} from 'services/territoryGame';
import { ApiClient } from 'services/apiClient';
import { TerritoryRegisterRequest, TerritoryClaimRequest, PowerupUseRequest } from 'services/generated/generatedClient';

export interface MapBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export function useTerritoryGame() {
  const [gameState, setGameState] = useState<TerritoryGameState | null>(null);
  const [cells, setCells] = useState<TerritoryCell[]>([]);
  const [leaderboard, setLeaderboard] = useState<CityLeaderboard>({ cities: [] });
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [locationRequested, setLocationRequested] = useState(false);
  const [viewerMode, setViewerMode] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [powerups, setPowerups] = useState<PowerupLocation[]>([]);
  const [inventory, setInventory] = useState<PowerupInventoryItem[]>([]);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cooldownEndRef = useRef<number>(0);
  const watchIdRef = useRef<number | null>(null);

  const onPositionSuccess = useCallback((position: GeolocationPosition) => {
    setLocation({
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    });
    setLocationError(null);
  }, []);

  // Watch user location — tries high accuracy first, falls back to low accuracy
  const startWatchingLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      return;
    }

    const startWatch = (highAccuracy: boolean) => {
      watchIdRef.current = navigator.geolocation.watchPosition(
        onPositionSuccess,
        (error) => {
          // If high accuracy failed, retry with low accuracy (helps on desktop Macs without GPS)
          if (highAccuracy && (error.code === error.POSITION_UNAVAILABLE || error.code === error.TIMEOUT)) {
            console.warn('High accuracy location failed, retrying with low accuracy');
            if (watchIdRef.current !== null) {
              navigator.geolocation.clearWatch(watchIdRef.current);
            }
            startWatch(false);
            return;
          }
          setLocationError(error.message);
        },
        { enableHighAccuracy: highAccuracy, maximumAge: 10000, timeout: 30000 }
      );
    };

    startWatch(true);
  }, [onPositionSuccess]);

  const stopWatchingLocation = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  // Load game state from API
  const loadGameState = useCallback(async () => {
    try {
      const dto = await ApiClient.call((c) => c.territory_GetGameState());
      setGameState({
        isRegistered: dto.isRegistered,
        playerColor: dto.playerColor ?? null,
        lastClaimTime: dto.lastClaimTime?.toISOString() ?? null,
        canClaim: dto.canClaim,
        cooldownSeconds: dto.cooldownSeconds,
      });
      setCooldownSeconds(dto.cooldownSeconds);
      if (dto.cooldownSeconds > 0) {
        cooldownEndRef.current = Date.now() + dto.cooldownSeconds * 1000;
      }
    } catch (err) {
      console.error('Failed to load game state:', err);
    }
  }, []);

  // Load cells for the current map viewport bounds
  const loadCellsInBounds = useCallback(async (bounds: MapBounds) => {
    try {
      const dtos = await ApiClient.call((c) =>
        c.territory_GetCellsInBounds(bounds.south, bounds.west, bounds.north, bounds.east)
      );
      setCells(
        dtos.map((d) => ({
          row: d.row,
          col: d.col,
          claimedBy: d.claimedBy ?? null,
          claimedByName: d.claimedByName ?? null,
          color: d.color ?? null,
          claimedAt: d.claimedAt?.toISOString() ?? null,
          city: d.city ?? null,
          neighborhood: d.neighborhood ?? null,
        }))
      );
    } catch (err) {
      console.error('Failed to load cells in bounds:', err);
    }
  }, []);

  // Load powerups in current viewport bounds
  const loadPowerupsInBounds = useCallback(async (bounds: MapBounds) => {
    try {
      const dtos = await ApiClient.call((c) =>
        c.powerup_GetPowerupsInBounds(bounds.south, bounds.west, bounds.north, bounds.east)
      );
      setPowerups(
        dtos.map((d) => ({
          cellRow: d.cellRow,
          cellCol: d.cellCol,
          powerupType: d.powerupType ?? '',
          name: d.name ?? '',
          emoji: d.emoji ?? '❓',
        }))
      );
    } catch (err) {
      console.error('Failed to load powerups:', err);
    }
  }, []);

  // Load inventory
  const loadInventory = useCallback(async () => {
    try {
      const dtos = await ApiClient.call((c) => c.powerup_GetInventory());
      setInventory(
        dtos.map((d) => ({
          claimId: d.claimId ?? '',
          powerupType: d.powerupType ?? '',
          name: d.name ?? '',
          description: d.description ?? '',
          emoji: d.emoji ?? '❓',
          claimedAt: d.claimedAt?.toISOString() ?? '',
        }))
      );
    } catch (err) {
      console.error('Failed to load inventory:', err);
    }
  }, []);

  // Claim a powerup at current location
  const claimPowerup = useCallback(async () => {
    if (!location) return;
    try {
      await ApiClient.call((c) =>
        c.powerup_ClaimPowerup(
          new TerritoryClaimRequest({ latitude: location.lat, longitude: location.lng })
        )
      );
      // Refresh powerups and inventory
      if (lastBoundsRef.current) await loadPowerupsInBounds(lastBoundsRef.current);
      await loadInventory();
    } catch (err) {
      console.error('Failed to claim powerup:', err);
      throw err;
    }
  }, [location, loadPowerupsInBounds, loadInventory]);

  // Use a powerup from inventory
  const usePowerup = useCallback(async (claimId: string): Promise<PowerupUseResult> => {
    if (!location) throw new Error('Location required');
    try {
      const dto = await ApiClient.call((c) =>
        c.powerup_UsePowerup(
          new PowerupUseRequest({ claimId, latitude: location.lat, longitude: location.lng })
        )
      );
      await loadInventory();
      // Refresh map cells to show the effect
      if (lastBoundsRef.current) await loadCellsInBounds(lastBoundsRef.current);
      return {
        success: dto.success,
        message: dto.message ?? '',
        cellsAffected: dto.cellsAffected,
      };
    } catch (err) {
      console.error('Failed to use powerup:', err);
      throw err;
    }
  }, [location, loadInventory, loadCellsInBounds]);

  // Load leaderboard from API
  const loadLeaderboard = useCallback(async () => {
    try {
      const dto = await ApiClient.call((c) => c.territory_GetLeaderboard(10));
      setLeaderboard({
        cities: (dto.cities ?? []).map((cs) => ({
          city: cs.city ?? 'Unknown',
          userHasClaims: cs.userHasClaims,
          players: (cs.players ?? []).map((p) => ({
            userId: p.userId ?? '',
            displayName: p.displayName ?? 'Unknown',
            color: p.color ?? '#999',
            cellsClaimed: p.cellsClaimed,
          })),
          neighborhoods: cs.neighborhoods?.map((nb) => ({
            neighborhood: nb.neighborhood ?? 'Unknown',
            userHasClaims: nb.userHasClaims,
            players: (nb.players ?? []).map((p) => ({
              userId: p.userId ?? '',
              displayName: p.displayName ?? 'Unknown',
              color: p.color ?? '#999',
              cellsClaimed: p.cellsClaimed,
            })),
          })),
        })),
      });
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
    }
  }, []);

  // Track last known bounds so claim can refresh the current view
  const lastBoundsRef = useRef<MapBounds | null>(null);

  // Enter viewer mode — browse the map without location
  const enterViewerMode = useCallback(() => {
    setViewerMode(true);
    loadLeaderboard();
  }, [loadLeaderboard]);

  // Register via API
  const register = useCallback(async (color: string) => {
    try {
      await ApiClient.call((c) =>
        c.territory_Register(new TerritoryRegisterRequest({ color }))
      );
      await loadGameState();
    } catch (err) {
      console.error('Failed to register:', err);
      throw err;
    }
  }, [loadGameState]);

  // Change color via API
  const changeColor = useCallback(async (color: string) => {
    try {
      await ApiClient.call((c) =>
        c.territory_ChangeColor(new TerritoryRegisterRequest({ color }))
      );
      await loadGameState();
      // Refresh map cells to show the new color
      if (lastBoundsRef.current) await loadCellsInBounds(lastBoundsRef.current);
    } catch (err) {
      console.error('Failed to change color:', err);
      throw err;
    }
  }, [loadGameState, loadCellsInBounds]);

  // Claim cell via API
  const claimCell = useCallback(async () => {
    if (!location || isClaiming) return;
    setIsClaiming(true);
    try {
      await ApiClient.call((c) =>
        c.territory_ClaimCell(
          new TerritoryClaimRequest({ latitude: location.lat, longitude: location.lng })
        )
      );
      cooldownEndRef.current = Date.now() + CLAIM_COOLDOWN_MS;
      setCooldownSeconds(Math.ceil(CLAIM_COOLDOWN_MS / 1000));
      const refreshes: Promise<any>[] = [loadLeaderboard(), loadGameState()];
      if (lastBoundsRef.current) refreshes.push(loadCellsInBounds(lastBoundsRef.current));
      await Promise.all(refreshes);
    } catch (err) {
      console.error('Failed to claim cell:', err);
      throw err;
    } finally {
      setIsClaiming(false);
    }
  }, [location, isClaiming, loadCellsInBounds, loadLeaderboard, loadGameState]);

  // Cooldown timer — uses wall-clock time so backgrounding the app doesn't freeze it
  useEffect(() => {
    if (cooldownSeconds > 0) {
      // Set the end time when first entering cooldown
      if (cooldownEndRef.current === 0) {
        cooldownEndRef.current = Date.now() + cooldownSeconds * 1000;
      }
      cooldownRef.current = setInterval(() => {
        const remaining = Math.ceil((cooldownEndRef.current - Date.now()) / 1000);
        if (remaining <= 0) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          cooldownEndRef.current = 0;
          setCooldownSeconds(0);
        } else {
          setCooldownSeconds(remaining);
        }
      }, 1000);
      return () => {
        if (cooldownRef.current) clearInterval(cooldownRef.current);
      };
    }
  }, [cooldownSeconds > 0]); // only re-run when transitioning from 0 to >0

  // Request location — must be called from a user gesture for iOS Safari
  const requestLocation = useCallback(() => {
    setLocationRequested(true);
    setLocationError(null);
    startWatchingLocation();
  }, [startWatchingLocation]);

  // Initial load — check if location is already granted and auto-start
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await loadGameState();

      // Try to detect if we already have location permission
      let alreadyGranted = false;

      // Method 1: Permissions API (Chrome, Firefox — not iOS Safari)
      try {
        if (navigator.permissions) {
          const status = await navigator.permissions.query({ name: 'geolocation' });
          if (status.state === 'granted') {
            alreadyGranted = true;
          }
        }
      } catch {
        // Permissions API not supported
      }

      // Method 2: Quick getCurrentPosition probe with short timeout
      // If it succeeds, permission was already granted
      if (!alreadyGranted && navigator.geolocation) {
        try {
          await new Promise<void>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                onPositionSuccess(pos);
                alreadyGranted = true;
                resolve();
              },
              () => reject(),
              { enableHighAccuracy: false, maximumAge: 60000, timeout: 3000 }
            );
          });
        } catch {
          // Permission not granted or timed out — will show button
        }
      }

      if (alreadyGranted) {
        setLocationRequested(true);
        startWatchingLocation();
      }

      setIsLoading(false);
    };
    init();
    return stopWatchingLocation;
  }, []);

  // Load leaderboard on mount
  useEffect(() => {
    if (location) {
      loadLeaderboard();
    }
  }, [location?.lat, location?.lng]);

  // Callback for the map to report bounds changes
  const onMapBoundsChanged = useCallback((bounds: MapBounds) => {
    lastBoundsRef.current = bounds;
    loadCellsInBounds(bounds);
    loadPowerupsInBounds(bounds);
  }, [loadCellsInBounds, loadPowerupsInBounds]);

  // Poll cells + powerups every 15 seconds for semi-live updates
  useEffect(() => {
    const interval = setInterval(() => {
      if (lastBoundsRef.current) {
        loadCellsInBounds(lastBoundsRef.current);
        loadPowerupsInBounds(lastBoundsRef.current);
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [loadCellsInBounds, loadPowerupsInBounds]);

  // Load inventory on mount
  useEffect(() => {
    if (gameState?.isRegistered) {
      loadInventory();
    }
  }, [gameState?.isRegistered]);

  // Debug: set location by tapping the map (dev mode only)
  const setDebugLocation = useCallback((lat: number, lng: number) => {
    setLocation({ lat, lng });
    setLocationError(null);
    setLocationRequested(true);
    setViewerMode(false);
    setDebugMode(true);
  }, []);

  // Fly the map to a region or user's most recent claim
  const flyToRecentClaim = useCallback(async (opts: { region?: string; userId?: string }) => {
    try {
      const dto = await ApiClient.call((c) =>
        c.territory_GetRecentClaimLocation(opts.region, opts.userId)
      );
      if (dto && 'lat' in dto && 'lng' in dto) {
        return { lat: (dto as any).lat, lng: (dto as any).lng };
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const userCell = location ? coordsToCell(location.lat, location.lng) : null;

  return {
    gameState,
    cells,
    leaderboard,
    powerups,
    inventory,
    location,
    locationError,
    userCell,
    isLoading,
    isClaiming,
    cooldownSeconds,
    locationRequested,
    viewerMode,
    debugMode,
    register,
    claimCell,
    changeColor,
    claimPowerup,
    usePowerup,
    requestLocation,
    enterViewerMode,
    setDebugLocation,
    flyToRecentClaim,
    onMapBoundsChanged,
    refresh: () => {
      const refreshes: Promise<any>[] = [loadLeaderboard(), loadGameState(), loadInventory()];
      if (lastBoundsRef.current) {
        refreshes.push(loadCellsInBounds(lastBoundsRef.current));
        refreshes.push(loadPowerupsInBounds(lastBoundsRef.current));
      }
      return Promise.all(refreshes);
    },
  };
}
