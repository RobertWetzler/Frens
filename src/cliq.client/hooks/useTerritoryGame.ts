import { useCallback, useEffect, useRef, useState } from 'react';
import {
  TerritoryCell,
  TerritoryPlayer,
  TerritoryGameState,
  coordsToCell,
  CLAIM_COOLDOWN_MS,
} from 'services/territoryGame';
import { ApiClient } from 'services/apiClient';
import { TerritoryRegisterRequest, TerritoryClaimRequest } from 'services/generated/generatedClient';

export interface MapBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export function useTerritoryGame() {
  const [gameState, setGameState] = useState<TerritoryGameState | null>(null);
  const [cells, setCells] = useState<TerritoryCell[]>([]);
  const [leaderboard, setLeaderboard] = useState<TerritoryPlayer[]>([]);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // Watch user location
  const startWatchingLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      return;
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationError(null);
      },
      (error) => {
        setLocationError(error.message);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
  }, []);

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
        }))
      );
    } catch (err) {
      console.error('Failed to load cells in bounds:', err);
    }
  }, []);

  // Load leaderboard from API
  const loadLeaderboard = useCallback(async () => {
    try {
      const dtos = await ApiClient.call((c) => c.territory_GetLeaderboard(20));
      setLeaderboard(
        dtos.map((d) => ({
          userId: d.userId,
          displayName: d.displayName,
          color: d.color,
          cellsClaimed: d.cellsClaimed,
        }))
      );
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
    }
  }, []);

  // Track last known bounds so claim can refresh the current view
  const lastBoundsRef = useRef<MapBounds | null>(null);

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

  // Cooldown timer
  useEffect(() => {
    if (cooldownSeconds > 0) {
      cooldownRef.current = setInterval(() => {
        setCooldownSeconds((prev) => {
          if (prev <= 1) {
            if (cooldownRef.current) clearInterval(cooldownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => {
        if (cooldownRef.current) clearInterval(cooldownRef.current);
      };
    }
  }, [cooldownSeconds > 0]); // only re-run when transitioning from 0 to >0

  // Initial load
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      startWatchingLocation();
      await loadGameState();
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
  }, [loadCellsInBounds]);

  const userCell = location ? coordsToCell(location.lat, location.lng) : null;

  return {
    gameState,
    cells,
    leaderboard,
    location,
    locationError,
    userCell,
    isLoading,
    isClaiming,
    cooldownSeconds,
    register,
    claimCell,
    onMapBoundsChanged,
    refresh: () => {
      const refreshes: Promise<any>[] = [loadLeaderboard(), loadGameState()];
      if (lastBoundsRef.current) refreshes.push(loadCellsInBounds(lastBoundsRef.current));
      return Promise.all(refreshes);
    },
  };
}
