import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
    View,
    Modal,
    TouchableOpacity,
    Text,
    StyleSheet,
    Dimensions,
    Platform,
    ActivityIndicator,
    Image,
} from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    runOnJS,
} from 'react-native-reanimated';
import type { ImageStyle } from 'react-native';
import {
    GestureDetector,
    Gesture,
    GestureHandlerRootView,
} from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { makeStyles } from '../theme/makeStyles';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CROP_SIZE = Math.min(SCREEN_WIDTH - 60, 300);
const MIN_SCALE = 1;
const MAX_SCALE = 5;

interface ProfilePictureCropperProps {
    visible: boolean;
    imageUri: string;
    onConfirm: (croppedImageUri: string) => void;
    onCancel: () => void;
}

const useStyles = makeStyles((theme) => ({
    container: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingBottom: 20,
    },
    headerButton: {
        paddingVertical: 8,
        paddingHorizontal: 16,
    },
    headerButtonText: {
        color: theme.colors.textSecondary,
        fontSize: 16,
    },
    headerTitle: {
        color: theme.colors.textPrimary,
        fontSize: 18,
        fontWeight: '600',
    },
    confirmButton: {
        backgroundColor: theme.colors.primary,
        borderRadius: 20,
    },
    confirmButtonText: {
        color: theme.colors.primaryContrast,
        fontWeight: '600',
    },
    cropContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    imageContainer: {
        width: SCREEN_WIDTH,
        height: SCREEN_WIDTH,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    overlayContainer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        pointerEvents: 'none',
    },
    overlayTop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    overlayBottom: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    overlayLeft: {
        position: 'absolute',
        left: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    overlayRight: {
        position: 'absolute',
        right: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    circleOverlay: {
        width: CROP_SIZE,
        height: CROP_SIZE,
        borderRadius: CROP_SIZE / 2,
        borderWidth: 2,
        borderColor: theme.colors.primary,
        backgroundColor: 'transparent',
    },
    instructions: {
        paddingVertical: 30,
        alignItems: 'center',
    },
    instructionText: {
        color: theme.colors.textSecondary,
        fontSize: 14,
        textAlign: 'center',
    },
    loadingContainer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
    },
    zoomControls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 16,
        gap: 20,
    },
    zoomButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    zoomButtonDisabled: {
        opacity: 0.4,
    },
    zoomLevel: {
        color: theme.colors.textSecondary,
        fontSize: 14,
        minWidth: 50,
        textAlign: 'center',
    },
}));

export const ProfilePictureCropper: React.FC<ProfilePictureCropperProps> = ({
    visible,
    imageUri,
    onConfirm,
    onCancel,
}) => {
    const { theme } = useTheme();
    const styles = useStyles();
    
    const [imageSize, setImageSize] = useState({ width: SCREEN_WIDTH, height: SCREEN_WIDTH });
    const [isProcessing, setIsProcessing] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [currentZoom, setCurrentZoom] = useState(1);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const imageRef = useRef<HTMLImageElement | null>(null);

    // Shared values for gestures
    const scale = useSharedValue(1);
    const savedScale = useSharedValue(1);
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const savedTranslateX = useSharedValue(0);
    const savedTranslateY = useSharedValue(0);

    // Reset state when modal opens
    useEffect(() => {
        if (visible) {
            scale.value = 1;
            savedScale.value = 1;
            translateX.value = 0;
            translateY.value = 0;
            savedTranslateX.value = 0;
            savedTranslateY.value = 0;
            setImageLoaded(false);
            setIsProcessing(false);
            setCurrentZoom(1);
        }
    }, [visible]);

    // Load image dimensions
    useEffect(() => {
        if (imageUri && visible) {
            Image.getSize(
                imageUri,
                (width, height) => {
                    // Calculate initial scale to fit image properly
                    const aspectRatio = width / height;
                    let displayWidth: number;
                    let displayHeight: number;
                    
                    // Ensure image fills the crop circle initially
                    if (aspectRatio > 1) {
                        // Landscape: height should be at least CROP_SIZE
                        displayHeight = CROP_SIZE;
                        displayWidth = CROP_SIZE * aspectRatio;
                    } else {
                        // Portrait: width should be at least CROP_SIZE
                        displayWidth = CROP_SIZE;
                        displayHeight = CROP_SIZE / aspectRatio;
                    }
                    
                    setImageSize({ width: displayWidth, height: displayHeight });
                    setImageLoaded(true);
                },
                (error) => {
                    console.error('Error loading image dimensions:', error);
                    // Fallback to square
                    setImageSize({ width: CROP_SIZE, height: CROP_SIZE });
                    setImageLoaded(true);
                }
            );
        }
    }, [imageUri, visible]);

    // Calculate bounds to keep crop circle filled
    const clampTranslation = useCallback((x: number, y: number, currentScale: number) => {
        const scaledWidth = imageSize.width * currentScale;
        const scaledHeight = imageSize.height * currentScale;
        
        // Maximum translation to keep image covering the crop circle
        const maxX = Math.max(0, (scaledWidth - CROP_SIZE) / 2);
        const maxY = Math.max(0, (scaledHeight - CROP_SIZE) / 2);
        
        return {
            x: Math.min(maxX, Math.max(-maxX, x)),
            y: Math.min(maxY, Math.max(-maxY, y)),
        };
    }, [imageSize]);

    // Pinch gesture for zooming
    const pinchGesture = Gesture.Pinch()
        .onUpdate((event) => {
            const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, savedScale.value * event.scale));
            scale.value = newScale;
            
            // Adjust translation to keep image in bounds
            const clamped = clampTranslation(translateX.value, translateY.value, newScale);
            translateX.value = clamped.x;
            translateY.value = clamped.y;
        })
        .onEnd(() => {
            savedScale.value = scale.value;
            savedTranslateX.value = translateX.value;
            savedTranslateY.value = translateY.value;
        });

    // Pan gesture for moving
    const panGesture = Gesture.Pan()
        .onUpdate((event) => {
            const newX = savedTranslateX.value + event.translationX;
            const newY = savedTranslateY.value + event.translationY;
            
            const clamped = clampTranslation(newX, newY, scale.value);
            translateX.value = clamped.x;
            translateY.value = clamped.y;
        })
        .onEnd(() => {
            savedTranslateX.value = translateX.value;
            savedTranslateY.value = translateY.value;
        });

    // Double tap to reset or zoom
    const doubleTapGesture = Gesture.Tap()
        .numberOfTaps(2)
        .onEnd(() => {
            if (scale.value > 1.5) {
                // Reset to original
                scale.value = withSpring(1);
                translateX.value = withSpring(0);
                translateY.value = withSpring(0);
                savedScale.value = 1;
                savedTranslateX.value = 0;
                savedTranslateY.value = 0;
                runOnJS(setCurrentZoom)(1);
            } else {
                // Zoom to 2x
                scale.value = withSpring(2);
                savedScale.value = 2;
                runOnJS(setCurrentZoom)(2);
            }
        });

    // Zoom button handlers for desktop users
    const handleZoomIn = useCallback(() => {
        const newScale = Math.min(MAX_SCALE, scale.value + 0.5);
        scale.value = withSpring(newScale);
        savedScale.value = newScale;
        
        // Clamp translation after zoom
        const clamped = clampTranslation(translateX.value, translateY.value, newScale);
        translateX.value = withSpring(clamped.x);
        translateY.value = withSpring(clamped.y);
        savedTranslateX.value = clamped.x;
        savedTranslateY.value = clamped.y;
        
        setCurrentZoom(newScale);
    }, [clampTranslation]);

    const handleZoomOut = useCallback(() => {
        const newScale = Math.max(MIN_SCALE, scale.value - 0.5);
        scale.value = withSpring(newScale);
        savedScale.value = newScale;
        
        // Clamp translation after zoom
        const clamped = clampTranslation(translateX.value, translateY.value, newScale);
        translateX.value = withSpring(clamped.x);
        translateY.value = withSpring(clamped.y);
        savedTranslateX.value = clamped.x;
        savedTranslateY.value = clamped.y;
        
        setCurrentZoom(newScale);
    }, [clampTranslation]);

    const handleResetZoom = useCallback(() => {
        scale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        setCurrentZoom(1);
    }, []);

    // Combine gestures
    const composedGesture = Gesture.Simultaneous(
        pinchGesture,
        panGesture,
        doubleTapGesture
    );

    const animatedImageStyle = useAnimatedStyle((): ImageStyle => {
        'worklet';
        return {
            transform: [
                { translateX: translateX.value },
                { translateY: translateY.value },
                { scale: scale.value },
            ] as ImageStyle['transform'],
        };
    });

    // Handle scroll wheel zoom on web
    const handleWheel = useCallback((event: React.WheelEvent | WheelEvent) => {
        if (Platform.OS !== 'web') return;
        
        event.preventDefault();
        
        // deltaY is negative when scrolling up (zoom in), positive when scrolling down (zoom out)
        const zoomDelta = -event.deltaY * 0.002;
        const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale.value + zoomDelta));
        
        scale.value = newScale;
        savedScale.value = newScale;
        
        // Clamp translation after zoom
        const clamped = clampTranslation(translateX.value, translateY.value, newScale);
        translateX.value = clamped.x;
        translateY.value = clamped.y;
        savedTranslateX.value = clamped.x;
        savedTranslateY.value = clamped.y;
        
        setCurrentZoom(newScale);
    }, [clampTranslation]);

    // Attach wheel event listener on web
    const imageContainerRef = useRef<View>(null);
    
    useEffect(() => {
        if (Platform.OS === 'web' && visible) {
            const container = imageContainerRef.current as unknown as HTMLElement;
            if (container) {
                const wheelHandler = (e: WheelEvent) => handleWheel(e);
                container.addEventListener('wheel', wheelHandler, { passive: false });
                return () => {
                    container.removeEventListener('wheel', wheelHandler);
                };
            }
        }
    }, [visible, handleWheel]);

    // Crop and process the image
    const handleConfirm = async () => {
        setIsProcessing(true);
        
        try {
            if (Platform.OS === 'web') {
                // Web: Use canvas to crop
                const croppedUri = await cropImageWeb();
                onConfirm(croppedUri);
            } else {
                // Native: Use the transform values to crop server-side or use expo-image-manipulator
                const croppedUri = await cropImageNative();
                onConfirm(croppedUri);
            }
        } catch (error) {
            console.error('Error cropping image:', error);
            // Fallback: return original image
            onConfirm(imageUri);
        } finally {
            setIsProcessing(false);
        }
    };

    // Web cropping using canvas
    const cropImageWeb = async (): Promise<string> => {
        return new Promise((resolve, reject) => {
            const img = new window.Image();
            img.crossOrigin = 'anonymous';
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                if (!ctx) {
                    reject(new Error('Could not get canvas context'));
                    return;
                }

                // Output size (high quality)
                const outputSize = 512;
                canvas.width = outputSize;
                canvas.height = outputSize;

                // Calculate the crop region in original image coordinates
                const currentScale = scale.value;
                const currentTranslateX = translateX.value;
                const currentTranslateY = translateY.value;

                // The displayed image size
                const displayWidth = imageSize.width;
                const displayHeight = imageSize.height;

                // Scale from display coordinates to original image coordinates
                const originalWidth = img.naturalWidth;
                const originalHeight = img.naturalHeight;
                const displayToOriginalScale = originalWidth / displayWidth;

                // The crop circle center in display coordinates (relative to image center)
                const cropCenterX = -currentTranslateX / currentScale;
                const cropCenterY = -currentTranslateY / currentScale;

                // The size of the crop region in display coordinates
                const cropSizeInDisplay = CROP_SIZE / currentScale;

                // Convert to original image coordinates
                const sx = ((displayWidth / 2 + cropCenterX) - cropSizeInDisplay / 2) * displayToOriginalScale;
                const sy = ((displayHeight / 2 + cropCenterY) - cropSizeInDisplay / 2) * displayToOriginalScale;
                const sWidth = cropSizeInDisplay * displayToOriginalScale;
                const sHeight = cropSizeInDisplay * displayToOriginalScale;

                // Draw the cropped region
                ctx.drawImage(
                    img,
                    Math.max(0, sx),
                    Math.max(0, sy),
                    Math.min(sWidth, originalWidth - sx),
                    Math.min(sHeight, originalHeight - sy),
                    0,
                    0,
                    outputSize,
                    outputSize
                );

                // Create circular clip for the final image
                const finalCanvas = document.createElement('canvas');
                const finalCtx = finalCanvas.getContext('2d');
                if (!finalCtx) {
                    reject(new Error('Could not get final canvas context'));
                    return;
                }
                finalCanvas.width = outputSize;
                finalCanvas.height = outputSize;

                // Draw the cropped square image (not clipped - server will handle circular display)
                finalCtx.drawImage(canvas, 0, 0);

                // Convert to blob URL
                finalCanvas.toBlob(
                    (blob) => {
                        if (blob) {
                            const url = URL.createObjectURL(blob);
                            resolve(url);
                        } else {
                            reject(new Error('Failed to create blob'));
                        }
                    },
                    'image/jpeg',
                    0.9
                );
            };

            img.onerror = () => {
                reject(new Error('Failed to load image'));
            };

            img.src = imageUri;
        });
    };

    // Native cropping using expo-image-manipulator
    const cropImageNative = async (): Promise<string> => {
        try {
            // Dynamic import to avoid web bundling issues
            const ImageManipulator = await import('expo-image-manipulator');

            // Get original image dimensions
            const originalSize = await new Promise<{ width: number; height: number }>((resolve, reject) => {
                Image.getSize(
                    imageUri,
                    (width, height) => resolve({ width, height }),
                    reject
                );
            });

            const currentScale = scale.value;
            const currentTranslateX = translateX.value;
            const currentTranslateY = translateY.value;

            // The displayed image size
            const displayWidth = imageSize.width;
            const displayHeight = imageSize.height;

            // Scale from display coordinates to original image coordinates
            const displayToOriginalScale = originalSize.width / displayWidth;

            // The crop circle center in display coordinates (relative to image center)
            const cropCenterX = -currentTranslateX / currentScale;
            const cropCenterY = -currentTranslateY / currentScale;

            // The size of the crop region in display coordinates
            const cropSizeInDisplay = CROP_SIZE / currentScale;

            // Convert to original image coordinates
            const originX = ((displayWidth / 2 + cropCenterX) - cropSizeInDisplay / 2) * displayToOriginalScale;
            const originY = ((displayHeight / 2 + cropCenterY) - cropSizeInDisplay / 2) * displayToOriginalScale;
            const cropWidth = cropSizeInDisplay * displayToOriginalScale;
            const cropHeight = cropSizeInDisplay * displayToOriginalScale;

            // Ensure we don't go out of bounds
            const safeOriginX = Math.max(0, Math.min(originX, originalSize.width - cropWidth));
            const safeOriginY = Math.max(0, Math.min(originY, originalSize.height - cropHeight));
            const safeCropWidth = Math.min(cropWidth, originalSize.width - safeOriginX);
            const safeCropHeight = Math.min(cropHeight, originalSize.height - safeOriginY);

            const result = await ImageManipulator.manipulateAsync(
                imageUri,
                [
                    {
                        crop: {
                            originX: safeOriginX,
                            originY: safeOriginY,
                            width: safeCropWidth,
                            height: safeCropHeight,
                        },
                    },
                    {
                        resize: { width: 512, height: 512 },
                    },
                ],
                { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
            );

            return result.uri;
        } catch (error) {
            console.error('Error in native crop:', error);
            throw error;
        }
    };

    // Calculate overlay positions
    const containerCenter = SCREEN_WIDTH / 2;
    const overlayTopHeight = (SCREEN_WIDTH - CROP_SIZE) / 2;
    const overlayBottomHeight = overlayTopHeight;
    const overlaySideWidth = (SCREEN_WIDTH - CROP_SIZE) / 2;
    const overlaySideHeight = CROP_SIZE;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={false}
            onRequestClose={onCancel}
        >
            <GestureHandlerRootView style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity style={styles.headerButton} onPress={onCancel}>
                        <Text style={styles.headerButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Move and Scale</Text>
                    <TouchableOpacity
                        style={[styles.headerButton, styles.confirmButton]}
                        onPress={handleConfirm}
                        disabled={isProcessing || !imageLoaded}
                    >
                        <Text style={[styles.headerButtonText, styles.confirmButtonText]}>
                            {isProcessing ? 'Processing...' : 'Choose'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Crop area */}
                <View style={styles.cropContainer}>
                    <View ref={imageContainerRef} style={styles.imageContainer}>
                        <GestureDetector gesture={composedGesture}>
                            <Animated.View
                                style={[
                                    {
                                        width: imageSize.width,
                                        height: imageSize.height,
                                    },
                                    animatedImageStyle as any,
                                ]}
                            >
                                <Image
                                    source={{ uri: imageUri }}
                                    style={{
                                        width: imageSize.width,
                                        height: imageSize.height,
                                    }}
                                    resizeMode="cover"
                                />
                            </Animated.View>
                        </GestureDetector>

                        {/* Overlay to darken area outside crop circle */}
                        <View style={styles.overlayContainer}>
                            {/* Top overlay */}
                            <View style={[styles.overlayTop, { height: overlayTopHeight }]} />
                            {/* Bottom overlay */}
                            <View style={[styles.overlayBottom, { height: overlayBottomHeight }]} />
                            {/* Left overlay */}
                            <View
                                style={[
                                    styles.overlayLeft,
                                    {
                                        top: overlayTopHeight,
                                        width: overlaySideWidth,
                                        height: overlaySideHeight,
                                    },
                                ]}
                            />
                            {/* Right overlay */}
                            <View
                                style={[
                                    styles.overlayRight,
                                    {
                                        top: overlayTopHeight,
                                        width: overlaySideWidth,
                                        height: overlaySideHeight,
                                    },
                                ]}
                            />
                            {/* Circle border */}
                            <View style={styles.circleOverlay} />
                        </View>
                    </View>
                </View>

                {/* Instructions */}
                <View style={styles.instructions}>
                    <Text style={styles.instructionText}>
                        {Platform.OS === 'web' 
                            ? 'Use buttons or scroll to zoom • Drag to reposition'
                            : 'Pinch to zoom • Drag to reposition'}
                    </Text>
                    <Text style={[styles.instructionText, { marginTop: 4 }]}>
                        Double-tap to reset
                    </Text>

                    {/* Zoom controls for desktop/web */}
                    {Platform.OS === 'web' && (
                        <View style={styles.zoomControls}>
                            <TouchableOpacity
                                style={[
                                    styles.zoomButton,
                                    currentZoom <= MIN_SCALE && styles.zoomButtonDisabled,
                                ]}
                                onPress={handleZoomOut}
                                disabled={currentZoom <= MIN_SCALE}
                            >
                                <Ionicons name="remove" size={24} color={theme.colors.textPrimary} />
                            </TouchableOpacity>

                            <Text style={styles.zoomLevel}>
                                {Math.round(currentZoom * 100)}%
                            </Text>

                            <TouchableOpacity
                                style={[
                                    styles.zoomButton,
                                    currentZoom >= MAX_SCALE && styles.zoomButtonDisabled,
                                ]}
                                onPress={handleZoomIn}
                                disabled={currentZoom >= MAX_SCALE}
                            >
                                <Ionicons name="add" size={24} color={theme.colors.textPrimary} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.zoomButton}
                                onPress={handleResetZoom}
                            >
                                <Ionicons name="refresh" size={20} color={theme.colors.textPrimary} />
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* Processing overlay */}
                {isProcessing && (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={theme.colors.primary} />
                        <Text style={[styles.instructionText, { marginTop: 16 }]}>
                            Processing image...
                        </Text>
                    </View>
                )}
            </GestureHandlerRootView>
        </Modal>
    );
};

export default ProfilePictureCropper;
