import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, ScrollView, ActivityIndicator, Modal, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { makeStyles } from '../theme/makeStyles';
import { useTerritoryGame } from 'hooks/useTerritoryGame';
import TerritoryRegistration from 'components/territory/TerritoryRegistration';
import TerritoryMap from 'components/territory/TerritoryMap';
import TerritoryLeaderboard from 'components/territory/TerritoryLeaderboard';
import { TERRITORY_COLORS, coordsToCell } from 'services/territoryGame';
import { TerritoryTestModeService, TerritoryTestEditorOptions } from 'services/territoryTestMode';

type Tab = 'map' | 'leaderboard';

const TerritoryGameScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const styles = useStyles();
  const [activeTab, setActiveTab] = useState<Tab>('map');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isChangingColor, setIsChangingColor] = useState(false);
  const [powerupModal, setPowerupModal] = useState<{ claimId: string; name: string; description: string; emoji: string } | null>(null);
  const [powerupResult, setPowerupResult] = useState<string | null>(null);
  const [flyToTarget, setFlyToTarget] = useState<{ lat: number; lng: number } | null>(null);
  const [testModeEnabled, setTestModeEnabled] = useState(false);
  const [testSuiteLive, setTestSuiteLive] = useState(false);
  const [showTestSuite, setShowTestSuite] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [testOptions, setTestOptions] = useState<TerritoryTestEditorOptions | null>(null);
  const [selectedAssigneeUserId, setSelectedAssigneeUserId] = useState<string>('');
  const [selectedPowerupType, setSelectedPowerupType] = useState<string>('none');
  const [selectedCellStatus, setSelectedCellStatus] = useState<string>('empty');
  const [pickerTarget, setPickerTarget] = useState<'assignee' | 'powerup' | 'status' | null>(null);
  const [isLoadingEditorState, setIsLoadingEditorState] = useState(false);
  const [isRunningTestAction, setIsRunningTestAction] = useState(false);
  const isLocalhost = typeof window !== 'undefined' && !!window.location
    && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const showTestTools = testModeEnabled || isLocalhost;

  const {
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
    refresh,
  } = useTerritoryGame();

  useEffect(() => {
    let isMounted = true;
    TerritoryTestModeService.getMode()
      .then((enabled) => {
        if (isMounted) setTestModeEnabled(enabled);
      })
      .catch(() => {
        if (isMounted) setTestModeEnabled(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Check if user is standing on a powerup
  const userOnPowerup = !!(userCell && powerups.some(
    (p) => p.cellRow === userCell.row && p.cellCol === userCell.col
  ));

  const handleFlyTo = async (opts: { region?: string; userId?: string }) => {
    const loc = await flyToRecentClaim(opts);
    if (loc) {
      setFlyToTarget(loc);
      setActiveTab('map');
    }
  };

  const handleChangeColor = async (color: string) => {
    setIsChangingColor(true);
    try {
      await changeColor(color);
      setShowColorPicker(false);
    } catch {
      // error logged in hook
    } finally {
      setIsChangingColor(false);
    }
  };

  const runTestAction = async (action: () => Promise<void>, successMessage: string) => {
    if (!selectedCell) {
      Alert.alert('Select a Cell', 'Tap the map in debug mode to choose a cell first.');
      return;
    }

    setIsRunningTestAction(true);
    try {
      await action();
      await refresh();
      Alert.alert('Success', successMessage);
    } catch (error: any) {
      Alert.alert('Test Action Failed', error?.message || 'Failed to run test action.');
    } finally {
      setIsRunningTestAction(false);
    }
  };

  const ensureTestOptions = async (): Promise<TerritoryTestEditorOptions | null> => {
    if (testOptions) {
      return testOptions;
    }

    try {
      const options = await TerritoryTestModeService.getEditorOptions();
      setTestOptions(options);
      return options;
    } catch (error: any) {
      Alert.alert('Test Suite Unavailable', error?.message || 'Could not load test suite options.');
      return null;
    }
  };

  const handleMapDebugClick = async (lat: number, lng: number) => {
    if (!testSuiteLive) {
      return;
    }

    const cell = coordsToCell(lat, lng);
    setSelectedCell(cell);
    setShowTestSuite(true);

    // Load options lazily when the user actually opens a cell.
    if (!testOptions) {
      await ensureTestOptions();
    }
  };

  const loadCellEditorState = async (row: number, col: number) => {
    setIsLoadingEditorState(true);
    try {
      const state = await TerritoryTestModeService.getCellEditorState(row, col);
      setSelectedAssigneeUserId(state.assigneeUserId ?? '');
      setSelectedPowerupType(state.powerupType || 'none');
      setSelectedCellStatus(state.cellStatus || 'empty');
    } catch (error: any) {
      Alert.alert('Cell Load Failed', error?.message || 'Could not load current cell configuration.');
    } finally {
      setIsLoadingEditorState(false);
    }
  };

  const toggleTestSuiteLive = () => {
    if (testSuiteLive) {
      setTestSuiteLive(false);
      setShowTestSuite(false);
      setPickerTarget(null);
      return;
    }

    setTestSuiteLive(true);
  };

  const saveCellConfiguration = async () => {
    if (!selectedCell) {
      Alert.alert('Select a Cell', 'Tap the map in debug mode to choose a cell first.');
      return;
    }

    await runTestAction(async () => {
      const nextState = await TerritoryTestModeService.saveCellEditorState({
        row: selectedCell.row,
        col: selectedCell.col,
        assigneeUserId: selectedAssigneeUserId || null,
        powerupType: selectedPowerupType,
        cellStatus: selectedCellStatus,
      });

      setSelectedAssigneeUserId(nextState.assigneeUserId ?? '');
      setSelectedPowerupType(nextState.powerupType || 'none');
      setSelectedCellStatus(nextState.cellStatus || 'empty');
    }, 'Cell configuration saved.');
  };

  useEffect(() => {
    if (!showTestSuite || !selectedCell) return;
    loadCellEditorState(selectedCell.row, selectedCell.col);
  }, [showTestSuite, selectedCell?.row, selectedCell?.col]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading FrenZones...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show registration if user hasn't joined yet
  if (gameState && !gameState.isRegistered) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <TerritoryRegistration onRegister={register} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🗺️ FrenZones</Text>
        <View style={styles.headerActions}>
          {showTestTools && (
            <TouchableOpacity
              onPress={toggleTestSuiteLive}
              style={[styles.backButton, testSuiteLive && styles.testSuiteLiveButton]}
            >
              <Ionicons
                name={testSuiteLive ? 'flask' : 'flask-outline'}
                size={22}
                color={testSuiteLive ? theme.colors.primary : theme.colors.textPrimary}
              />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => setShowColorPicker(true)} style={styles.backButton}>
            <View style={[styles.colorIndicator, { backgroundColor: gameState?.playerColor || theme.colors.primary }]} />
          </TouchableOpacity>
        </View>
      </View>

      {testSuiteLive && (
        <View style={styles.testSuiteLiveBanner}>
          <Ionicons name="flask" size={14} color={theme.colors.primary} />
          <Text style={styles.testSuiteLiveBannerText}>Test mode live: click any cell to open test suite</Text>
        </View>
      )}

      {/* Color Picker Modal */}
      <Modal visible={showColorPicker} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowColorPicker(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Change Your Color</Text>
            <View style={styles.colorGrid}>
              {TERRITORY_COLORS.map((color) => (
                <TouchableOpacity
                  key={color}
                  onPress={() => handleChangeColor(color)}
                  disabled={isChangingColor}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: color },
                    gameState?.playerColor === color && styles.colorSwatchSelected,
                    gameState?.playerColor === color && { borderColor: theme.colors.textPrimary },
                  ]}
                >
                  {gameState?.playerColor === color && (
                    <Ionicons name="checkmark" size={20} color="#FFF" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
            {isChangingColor && (
              <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginTop: 12 }} />
            )}
            <Text style={styles.modalHint}>
                Update the color for all your claimed zones.
            </Text>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Powerup Use Modal */}
      <Modal visible={!!powerupModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => { setPowerupModal(null); setPowerupResult(null); }}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            {powerupResult ? (
              <>
                <Text style={styles.modalTitle}>{powerupResult}</Text>
                <TouchableOpacity
                  style={[styles.colorSwatch, { backgroundColor: theme.colors.primary, width: undefined, height: undefined, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, marginTop: 16 }]}
                  onPress={() => { setPowerupModal(null); setPowerupResult(null); }}
                >
                  <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 15 }}>Nice!</Text>
                </TouchableOpacity>
              </>
            ) : powerupModal ? (
              <>
                <Text style={{ fontSize: 48, textAlign: 'center' }}>{powerupModal.emoji}</Text>
                <Text style={styles.modalTitle}>{powerupModal.name}</Text>
                <Text style={[styles.modalHint, { fontSize: 15, marginTop: 8 }]}>{powerupModal.description}</Text>
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 20, justifyContent: 'center' }}>
                  <TouchableOpacity
                    style={[styles.colorSwatch, { backgroundColor: theme.colors.textMuted, width: undefined, height: undefined, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, borderWidth: 0 }]}
                    onPress={() => { setPowerupModal(null); setPowerupResult(null); }}
                  >
                    <Text style={{ color: '#FFF', fontWeight: '600' }}>Close</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.colorSwatch, { backgroundColor: '#FF9800', width: undefined, height: undefined, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, borderWidth: 0 }]}
                    onPress={async () => {
                      try {
                        const result = await usePowerup(powerupModal.claimId);
                        setPowerupResult(result.message);
                      } catch {
                        setPowerupResult('Failed to use powerup');
                      }
                    }}
                  >
                    <Text style={{ color: '#FFF', fontWeight: '700' }}>Use Now</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Territory Test Suite Modal */}
      <Modal visible={showTestSuite} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.testSuiteModalContent}>
            <Text style={styles.modalTitle}>Map Test Suite</Text>
            <Text style={styles.modalHint}>
              Select a cell by tapping the map while in viewer/debug mode, configure options, then save.
            </Text>

            <View style={styles.testSuiteCellInfo}>
              <Text style={styles.testSuiteLabel}>Selected cell</Text>
              <Text style={styles.testSuiteValue}>
                {selectedCell ? `row ${selectedCell.row}, col ${selectedCell.col}` : 'None'}
              </Text>
            </View>

            {isLoadingEditorState ? (
              <View style={styles.testSuiteLoadingBox}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <Text style={styles.testSuiteLoadingText}>Loading cell configuration...</Text>
              </View>
            ) : (
              <>
                <Text style={styles.testSuiteLabel}>Assignee</Text>
                <TouchableOpacity
                  style={styles.testSuiteSelectButton}
                  onPress={() => setPickerTarget('assignee')}
                  disabled={!testOptions || isLoadingEditorState}
                >
                  <Text style={styles.testSuiteSelectText}>
                    {selectedAssigneeUserId
                      ? (testOptions?.assignees.find((a) => a.userId === selectedAssigneeUserId)?.username || 'Unknown user')
                      : 'None'}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={theme.colors.textMuted} />
                </TouchableOpacity>

                <Text style={styles.testSuiteLabel}>Powerup Type</Text>
                <TouchableOpacity
                  style={styles.testSuiteSelectButton}
                  onPress={() => setPickerTarget('powerup')}
                  disabled={!testOptions || isLoadingEditorState}
                >
                  <Text style={styles.testSuiteSelectText}>{selectedPowerupType || 'none'}</Text>
                  <Ionicons name="chevron-down" size={16} color={theme.colors.textMuted} />
                </TouchableOpacity>

                <Text style={styles.testSuiteLabel}>Cell Status</Text>
                <TouchableOpacity
                  style={styles.testSuiteSelectButton}
                  onPress={() => setPickerTarget('status')}
                  disabled={!testOptions || isLoadingEditorState}
                >
                  <Text style={styles.testSuiteSelectText}>{selectedCellStatus || 'empty'}</Text>
                  <Ionicons name="chevron-down" size={16} color={theme.colors.textMuted} />
                </TouchableOpacity>

                <View style={styles.testSuiteButtonsRow}>
                  <TouchableOpacity
                    style={[styles.testSuiteButton, styles.testSuitePrimaryButton]}
                    onPress={saveCellConfiguration}
                    disabled={!selectedCell || isRunningTestAction || isLoadingEditorState}
                  >
                    {isRunningTestAction ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.testSuitePrimaryButtonText}>Save</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.testSuiteButton, styles.testSuiteCloseButton]}
                    onPress={() => setShowTestSuite(false)}
                  >
                    <Text style={styles.testSuiteCloseButtonText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={pickerTarget !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.pickerModalContent}>
            <Text style={styles.modalTitle}>
              {pickerTarget === 'assignee' ? 'Select Assignee' : pickerTarget === 'powerup' ? 'Select Powerup Type' : 'Select Cell Status'}
            </Text>
            <ScrollView style={styles.pickerScroll}>
              {pickerTarget === 'assignee' && (
                <>
                  <TouchableOpacity
                    style={styles.pickerOptionButton}
                    onPress={() => { setSelectedAssigneeUserId(''); setPickerTarget(null); }}
                  >
                    <Text style={styles.pickerOptionText}>None</Text>
                  </TouchableOpacity>
                  {(testOptions?.assignees ?? []).map((assignee) => (
                    <TouchableOpacity
                      key={assignee.userId}
                      style={styles.pickerOptionButton}
                      onPress={() => { setSelectedAssigneeUserId(assignee.userId); setPickerTarget(null); }}
                    >
                      <Text style={styles.pickerOptionText}>{assignee.username}</Text>
                    </TouchableOpacity>
                  ))}
                </>
              )}
              {pickerTarget === 'powerup' && (testOptions?.powerupTypes ?? []).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={styles.pickerOptionButton}
                  onPress={() => { setSelectedPowerupType(type); setPickerTarget(null); }}
                >
                  <Text style={styles.pickerOptionText}>{type}</Text>
                </TouchableOpacity>
              ))}
              {pickerTarget === 'status' && (testOptions?.cellStatuses ?? []).map((status) => (
                <TouchableOpacity
                  key={status}
                  style={styles.pickerOptionButton}
                  onPress={() => { setSelectedCellStatus(status); setPickerTarget(null); }}
                >
                  <Text style={styles.pickerOptionText}>{status}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.testSuiteButton, styles.testSuiteCloseButton]}
              onPress={() => setPickerTarget(null)}
            >
              <Text style={styles.testSuiteCloseButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'map' && styles.tabActive]}
          onPress={() => setActiveTab('map')}
        >
          <Ionicons
            name="map"
            size={18}
            color={activeTab === 'map' ? theme.colors.primary : theme.colors.textMuted}
          />
          <Text style={[styles.tabText, activeTab === 'map' && styles.tabTextActive]}>
            Map
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'leaderboard' && styles.tabActive]}
          onPress={() => setActiveTab('leaderboard')}
        >
          <Ionicons
            name="trophy"
            size={18}
            color={activeTab === 'leaderboard' ? theme.colors.primary : theme.colors.textMuted}
          />
          <Text style={[styles.tabText, activeTab === 'leaderboard' && styles.tabTextActive]}>
            Leaderboard
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeTab === 'map' ? (
        <TerritoryMap
          cells={cells}
          userCell={userCell}
          playerColor={gameState?.playerColor ?? null}
          cooldownSeconds={cooldownSeconds}
          isClaiming={isClaiming}
          locationError={locationError}
          locationRequested={locationRequested}
          location={location}
          viewerMode={viewerMode}
          powerups={powerups}
          inventory={inventory}
          userOnPowerup={userOnPowerup}
          onClaimCell={async () => {
            try {
              await claimCell();
            } catch (err: any) {
              const message = typeof err?.response === 'string' && err.response.trim().length > 0
                ? err.response
                : (err?.message || 'Failed to claim this zone.');
              Alert.alert('Claim Failed', message);
            }
          }}
          onClaimPowerup={claimPowerup}
          onUsePowerup={async (claimId) => {
            const item = inventory.find((i) => i.claimId === claimId);
            if (item) {
              setPowerupModal({ claimId, name: item.name, description: item.description, emoji: item.emoji });
            }
            return { success: false, message: '', cellsAffected: 0 };
          }}
          onBoundsChanged={onMapBoundsChanged}
          onRequestLocation={requestLocation}
          onEnterViewerMode={enterViewerMode}
          debugMode={debugMode}
          testSuiteClickMode={testSuiteLive}
          onDebugClick={showTestTools ? handleMapDebugClick : undefined}
          flyToTarget={flyToTarget}
        />
      ) : (
        <ScrollView style={styles.leaderboardScroll}>
          <TerritoryLeaderboard
            leaderboard={leaderboard}
            onCityPress={(city) => handleFlyTo({ region: city })}
            onPlayerPress={(userId, city) => handleFlyTo({ region: city, userId })}
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const useStyles = makeStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background === 'transparent' ? theme.colors.backgroundAlt : theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: theme.colors.textMuted,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.cardBorder,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  testSuiteLiveButton: {
    backgroundColor: theme.colors.backgroundAlt,
    borderRadius: 8,
  },
  testSuiteLiveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: theme.colors.backgroundAlt,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.cardBorder,
  },
  testSuiteLiveBannerText: {
    fontSize: 12,
    color: theme.colors.textPrimary,
    fontWeight: '600',
  },
  colorIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.15)',
  },
  modalOverlay: {
    flex: 1,
    position: 'relative',
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: theme.colors.card,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 360,
  },
  testSuiteModalContent: {
    backgroundColor: theme.colors.card,
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 420,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: 16,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  colorSwatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  colorSwatchSelected: {
    borderWidth: 3,
    transform: [{ scale: 1.1 }],
  },
  modalHint: {
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 16,
  },
  testSuiteCellInfo: {
    marginTop: 12,
    marginBottom: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: theme.colors.backgroundAlt,
  },
  testSuiteLabel: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginBottom: 6,
  },
  testSuiteValue: {
    fontSize: 14,
    color: theme.colors.textPrimary,
    fontWeight: '600',
  },
  testSuiteLoadingBox: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testSuiteLoadingText: {
    marginTop: 10,
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  testSuiteSelectButton: {
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    backgroundColor: theme.colors.backgroundAlt,
  },
  testSuiteSelectText: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  testSuiteButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  testSuiteButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testSuitePrimaryButton: {
    backgroundColor: theme.colors.primary,
  },
  testSuitePrimaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  testSuiteSecondaryButton: {
    backgroundColor: theme.colors.backgroundAlt,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  testSuiteSecondaryButtonText: {
    color: theme.colors.textPrimary,
    fontWeight: '600',
  },
  testSuiteDangerButton: {
    backgroundColor: theme.colors.danger,
  },
  testSuiteDangerButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  testSuiteCloseButton: {
    backgroundColor: theme.colors.textMuted,
    marginTop: 4,
  },
  testSuiteCloseButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  pickerModalContent: {
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    width: '100%',
    maxWidth: 360,
    maxHeight: '70%',
    padding: 16,
  },
  pickerScroll: {
    marginTop: 4,
  },
  pickerOptionButton: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.cardBorder,
  },
  pickerOptionText: {
    color: theme.colors.textPrimary,
    fontSize: 14,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.cardBorder,
    backgroundColor: theme.colors.card,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: theme.colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  tabTextActive: {
    color: theme.colors.primary,
  },
  leaderboardScroll: {
    flex: 1,
  },
}));

export default TerritoryGameScreen;
