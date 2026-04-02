import React, { useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { makeStyles } from '../../theme/makeStyles';
import { TerritoryCell, cellToCoords, cellToBounds } from 'services/territoryGame';
import type { PowerupLocation, PowerupInventoryItem, PowerupUseResult } from 'services/territoryGame';
import type { MapBounds } from 'hooks/useTerritoryGame';

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Leaflet imports (web only)
let MapContainer: any;
let TileLayer: any;
let Rectangle: any;
let CircleMarker: any;
let Tooltip: any;
let Marker: any;
let useMap: any;
let useMapEvents: any;
let L: any;
if (Platform.OS === 'web') {
  const RL = require('react-leaflet');
  MapContainer = RL.MapContainer;
  TileLayer = RL.TileLayer;
  Rectangle = RL.Rectangle;
  CircleMarker = RL.CircleMarker;
  Tooltip = RL.Tooltip;
  Marker = RL.Marker;
  useMap = RL.useMap;
  useMapEvents = RL.useMapEvents;
  L = require('leaflet');
}

interface TerritoryMapProps {
  cells: TerritoryCell[];
  userCell: { row: number; col: number } | null;
  playerColor: string | null;
  cooldownSeconds: number;
  isClaiming: boolean;
  locationError: string | null;
  locationRequested: boolean;
  location: { lat: number; lng: number } | null;
  viewerMode: boolean;
  powerups: PowerupLocation[];
  inventory: PowerupInventoryItem[];
  userOnPowerup: boolean;
  onClaimCell: () => void;
  onClaimPowerup: () => void;
  onUsePowerup: (claimId: string) => Promise<PowerupUseResult>;
  onBoundsChanged: (bounds: MapBounds) => void;
  onRequestLocation: () => void;
  onEnterViewerMode: () => void;
  debugMode: boolean;
  onDebugClick?: (lat: number, lng: number) => void;
}

/** Re-center the map on first location fix only */
const RecenterOnce: React.FC<{ lat: number; lng: number }> = ({ lat, lng }) => {
  const map = useMap();
  const hasCentered = React.useRef(false);
  React.useEffect(() => {
    if (!hasCentered.current) {
      map.setView([lat, lng], map.getZoom(), { animate: false });
      hasCentered.current = true;
    }
  }, [lat, lng]);
  return null;
};

/** Fires onBoundsChanged on map moveend/zoomend and on mount */
const BoundsWatcher: React.FC<{ onBoundsChanged: (bounds: MapBounds) => void }> = ({ onBoundsChanged }) => {
  const map = useMapEvents({
    moveend: () => {
      const b = map.getBounds();
      onBoundsChanged({
        south: b.getSouth(),
        west: b.getWest(),
        north: b.getNorth(),
        east: b.getEast(),
      });
    },
    zoomend: () => {
      const b = map.getBounds();
      onBoundsChanged({
        south: b.getSouth(),
        west: b.getWest(),
        north: b.getNorth(),
        east: b.getEast(),
      });
    },
  });

  // Fire initial bounds on mount
  React.useEffect(() => {
    // Small delay so the map has settled its initial view
    const timer = setTimeout(() => {
      const b = map.getBounds();
      onBoundsChanged({
        south: b.getSouth(),
        west: b.getWest(),
        north: b.getNorth(),
        east: b.getEast(),
      });
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  return null;
};

/** Debug: click map to set fake location (dev mode only) */
const DebugClickHandler: React.FC<{ onClick: (lat: number, lng: number) => void }> = ({ onClick }) => {
  useMapEvents({
    click: (e: any) => {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

const TerritoryMap: React.FC<TerritoryMapProps> = ({
  cells,
  userCell,
  playerColor,
  cooldownSeconds,
  isClaiming,
  locationError,
  locationRequested,
  location,
  viewerMode,
  powerups,
  inventory,
  userOnPowerup,
  onClaimCell,
  onClaimPowerup,
  onUsePowerup,
  onBoundsChanged,
  onRequestLocation,
  onEnterViewerMode,
  debugMode,
  onDebugClick,
}) => {
  const { theme } = useTheme();
  const styles = useStyles();

  // Build a lookup map for fast cell rendering
  const cellMap = useMemo(() => {
    const map = new Map<string, TerritoryCell>();
    for (const cell of cells) {
      map.set(`${cell.row},${cell.col}`, cell);
    }
    return map;
  }, [cells]);

  // Compute all rectangles to render on the map
  const cellRectangles = useMemo(() => {
    return cells.map((cell) => ({
      key: `${cell.row},${cell.col}`,
      bounds: cellToBounds(cell.row, cell.col),
      color: cell.color || '#999',
      claimedByName: cell.claimedByName,
      claimedAt: cell.claimedAt,
      city: cell.city,
      neighborhood: cell.neighborhood,
    }));
  }, [cells]);

  // User's current cell bounds for highlight
  const userCellBounds = useMemo(() => {
    if (!userCell) return null;
    return cellToBounds(userCell.row, userCell.col);
  }, [userCell?.row, userCell?.col]);

  // Check if user's current cell is already claimed
  const userCellClaimed = useMemo(() => {
    if (!userCell) return null;
    return cellMap.get(`${userCell.row},${userCell.col}`) ?? null;
  }, [userCell, cellMap]);

  if (Platform.OS !== 'web') {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="map-outline" size={48} color={theme.colors.textMuted} />
        <Text style={styles.errorTitle}>Web Only</Text>
        <Text style={styles.errorText}>FrenZones map is only available on web.</Text>
      </View>
    );
  }

  if (locationError && !viewerMode) {
    const isDenied = locationError.toLowerCase().includes('denied') ||
      locationError.toLowerCase().includes('permission');
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="location-outline" size={48} color={theme.colors.danger} />
        <Text style={styles.errorTitle}>Location Required</Text>
        <Text style={styles.errorText}>
          {isDenied
            ? 'Location access was denied. On iOS, go to Settings → Privacy → Location Services → Safari and set to "Allow". Then come back and try again.'
            : 'Could not get your location. Make sure Location Services are enabled, or try on your phone.'}
        </Text>
        <Text style={[styles.errorText, { fontSize: 12, marginTop: 8 }]}>
          Error: {locationError}
        </Text>
        <TouchableOpacity
          style={[styles.locationButton, { backgroundColor: theme.colors.primary }]}
          onPress={onRequestLocation}
        >
          <Ionicons name="refresh" size={18} color="#FFF" />
          <Text style={styles.locationButtonText}>Try Again</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.locationButton, { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.colors.textMuted, marginTop: 12 }]}
          onPress={onEnterViewerMode}
        >
          <Ionicons name="eye-outline" size={18} color={theme.colors.textMuted} />
          <Text style={[styles.locationButtonText, { color: theme.colors.textMuted }]}>Browse Map (View Only)</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!viewerMode && (!locationRequested || (!userCell && !location))) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="navigate-outline" size={48} color={theme.colors.primary} />
        <Text style={styles.errorTitle}>Share Your Location</Text>
        <Text style={styles.errorText}>
          FrenZones needs your location to show nearby zones and let you fren them.
        </Text>
        <TouchableOpacity
          style={[styles.locationButton, { backgroundColor: theme.colors.primary }]}
          onPress={onRequestLocation}
        >
          <Ionicons name="location" size={18} color="#FFF" />
          <Text style={styles.locationButtonText}>Share My Location</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!viewerMode && (!userCell || !location)) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Finding your location...</Text>
      </View>
    );
  }

  const canClaim = cooldownSeconds === 0 && !isClaiming;

  // Default center for viewer mode (Seattle)
  const mapCenter = location
    ? [location.lat, location.lng]
    : [47.6062, -122.3321];

  return (
    <View style={styles.container}>
      {/* Debug / Viewer mode banner */}
      {debugMode && (
        <View style={[styles.viewerBanner, { backgroundColor: '#FFF3E0' }]}>
          <Ionicons name="bug-outline" size={16} color="#FF9800" />
          <Text style={[styles.viewerBannerText, { color: '#FF9800', fontStyle: 'normal', fontWeight: '600' }]}>
            Debug mode — tap map to set location
          </Text>
        </View>
      )}
      {viewerMode && !debugMode && (
        <View style={styles.viewerBanner}>
          <Ionicons name="eye-outline" size={16} color={theme.colors.textMuted} />
          <Text style={styles.viewerBannerText}>Viewer mode — fren zones from your phone</Text>
        </View>
      )}

      {/* Leaflet map */}
      <View style={styles.mapWrapper}>
        <MapContainer
          center={mapCenter as [number, number]}
          zoom={16}
          style={{ width: '100%', height: '100%' }}
          zoomControl={true}
          attributionControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            maxZoom={20}
          />
          {location && <RecenterOnce lat={location.lat} lng={location.lng} />}
          <BoundsWatcher onBoundsChanged={onBoundsChanged} />
          {(debugMode || viewerMode) && onDebugClick && (
            <DebugClickHandler onClick={onDebugClick} />
          )}

          {/* Claimed cells as colored rectangles */}
          {cellRectangles.map((rect) => (
            <Rectangle
              key={rect.key}
              bounds={rect.bounds}
              pathOptions={{
                color: rect.color,
                fillColor: rect.color,
                fillOpacity: 0.55,
                weight: 0,
                stroke: false,
              }}
              eventHandlers={{
                click: (e: any) => {
                  e.target.openTooltip();
                },
              }}
            >
              <Tooltip direction="top" sticky={false}>
                <div style={{ textAlign: 'center', fontSize: 13 }}>
                  <strong>{rect.claimedByName || 'Unknown'}</strong>
                  {rect.city && (
                    <div style={{ color: '#666', fontSize: 11, marginTop: 2 }}>
                      {rect.neighborhood ? `${rect.neighborhood}, ${rect.city}` : rect.city}
                    </div>
                  )}
                  {rect.claimedAt && (
                    <div style={{ color: '#888', fontSize: 11, marginTop: 2 }}>
                      {formatTimeAgo(rect.claimedAt)}
                    </div>
                  )}
                </div>
              </Tooltip>
            </Rectangle>
          ))}

          {/* User's current cell highlight */}
          {!viewerMode && userCellBounds && (
            <Rectangle
              bounds={userCellBounds}
              pathOptions={{
                color: playerColor || theme.colors.primary,
                fillColor: playerColor ? playerColor + '44' : theme.colors.primary + '44',
                fillOpacity: 0.3,
                weight: 3,
                dashArray: userCellClaimed ? undefined : '6 4',
              }}
            />
          )}

          {/* Powerup markers */}
          {powerups.map((pu) => {
            const center = cellToBounds(pu.cellRow, pu.cellCol);
            const lat = (center[0][0] + center[1][0]) / 2;
            const lng = (center[0][1] + center[1][1]) / 2;
            const icon = L?.divIcon?.({
              html: `<div style="font-size:22px;text-align:center;line-height:30px;width:30px;height:30px;background:rgba(255,255,255,0.85);border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);">${pu.emoji}</div>`,
              iconSize: [30, 30],
              iconAnchor: [15, 15],
              className: '',
            });
            return icon ? (
              <Marker
                key={`pu-${pu.cellRow},${pu.cellCol}`}
                position={[lat, lng]}
                icon={icon}
              >
                <Tooltip direction="top">
                  <div style={{ textAlign: 'center', fontSize: 13 }}>
                    <strong>{pu.name}</strong>
                  </div>
                </Tooltip>
              </Marker>
            ) : null;
          })}

          {/* User location dot */}
          {!viewerMode && location && (
            <CircleMarker
              center={[location.lat, location.lng]}
              radius={7}
              pathOptions={{
                color: '#FFF',
                fillColor: playerColor || theme.colors.primary,
                fillOpacity: 1,
                weight: 3,
              }}
            />
          )}
        </MapContainer>
      </View>

      {/* Claim Button overlay */}
      {!viewerMode && (
        <View style={styles.claimOverlay}>
          {isClaiming ? (
            <View style={[styles.claimButton, { backgroundColor: theme.colors.textMuted }]}>
              <ActivityIndicator size="small" color="#FFF" />
              <Text style={styles.claimButtonText}>Claiming...</Text>
            </View>
          ) : cooldownSeconds > 0 ? (
            <View style={[styles.claimButton, styles.claimButtonCooldown]}>
              <Ionicons name="time-outline" size={20} color="#FFF" />
              <Text style={styles.claimButtonText}>Wait {cooldownSeconds}s</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.claimButton, playerColor ? { backgroundColor: playerColor } : undefined]}
              onPress={onClaimCell}
              disabled={!canClaim}
            >
              <Ionicons name="flag" size={20} color="#FFF" />
              <Text style={styles.claimButtonText}>Claim This Zone</Text>
            </TouchableOpacity>
          )}
          {/* Powerup claim button — shows when user is standing on a powerup */}
          {userOnPowerup && (
            <TouchableOpacity
              style={[styles.claimButton, { backgroundColor: '#FF9800', marginTop: 8 }]}
              onPress={onClaimPowerup}
            >
              <Text style={styles.claimButtonText}>⚡ Pick Up Powerup</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Inventory panel */}
      {!viewerMode && inventory.length > 0 && (
        <View style={styles.inventoryPanel}>
          {inventory.map((item) => (
            <TouchableOpacity
              key={item.claimId}
              style={styles.inventoryItem}
              onPress={() => onUsePowerup(item.claimId)}
            >
              <Text style={styles.inventoryEmoji}>{item.emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const useStyles = makeStyles((theme) => ({
  container: {
    flex: 1,
    position: 'relative' as any,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    color: theme.colors.textMuted,
    fontSize: 15,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.danger,
    marginTop: 12,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
  },
  locationButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  viewerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
  },
  viewerBannerText: {
    fontSize: 13,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
  },
  mapWrapper: {
    flex: 1,
    overflow: 'hidden' as any,
  },
  claimOverlay: {
    position: 'absolute' as any,
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
  },
  claimButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 28,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  claimButtonCooldown: {
    backgroundColor: theme.colors.textMuted,
    opacity: 0.85,
  },
  claimButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  inventoryPanel: {
    position: 'absolute' as any,
    top: 60,
    right: 12,
    flexDirection: 'column',
    gap: 8,
    zIndex: 1000,
  },
  inventoryItem: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  inventoryEmoji: {
    fontSize: 22,
  },
}));

export default TerritoryMap;
