// components/TermsOfService.tsx
// TODO: Use stack navigation for this to display on iOS
import React from 'react'
import { Modal, View, Text, ScrollView, Pressable, StyleSheet, Platform } from 'react-native'

// Conditionally import WebView only for non-web platforms
let WebView: any = null
if (Platform.OS !== 'web') {
    WebView = require('react-native-webview').WebView
}

// Web-specific iframe component
const WebIframe = ({ src, style, title }: { src: string; style: any; title: string }) => {
    if (Platform.OS === 'web') {
        return React.createElement('iframe', {
            src,
            style: {
                width: '100%',
                height: '100%',
                minHeight: '400px',
                border: 'none',
                backgroundColor: '#fff',
                overflow: 'auto',
                ...style
            },
            title,
            scrolling: 'yes',
            frameBorder: '0'
        })
    }
    return null
}

interface TermsOfServiceProps {
    isVisible: boolean
    onClose: () => void
    onAccept: () => void
}

export const TermsOfService = ({ isVisible, onClose }: TermsOfServiceProps) => {
    // For debugging
    const handleModalShow = () => {
        console.log('Modal attempting to show, isVisible:', isVisible)
    }

    // Get the HTML file path
    const htmlSource = Platform.OS === 'web' 
        ? { uri: '/terms-of-service.html' }
        : require('../assets/terms-of-service.html')

    if (Platform.OS === 'web') {
        return (
            <Modal
                animationType="slide"
                transparent={true}
                visible={isVisible}
                onRequestClose={onClose}
                onShow={handleModalShow}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        {/* <Text style={styles.title}>Terms of Service</Text> */}
                        
                        <View style={styles.webViewContainer}>
                            <WebIframe
                                src="/terms-of-service.html"
                                style={styles.webView}
                                title="Terms of Service"
                            />
                        </View>

                        <Pressable style={styles.closeButton} onPress={onClose}>
                            <Text style={styles.closeButtonText}>Close</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>
        )
    }

    // For iOS/Android, use a full-screen approach
    if (isVisible) {
        return (
            <View style={styles.fullScreenContainer}>
                <View style={styles.header}>
                    <Text style={styles.title}>Terms of Service</Text>
                    <Pressable style={styles.closeButton} onPress={onClose}>
                        <Text style={styles.closeButtonText}>Close</Text>
                    </Pressable>
                </View>
                
                <View style={styles.webViewContainer}>
                    {WebView && (
                        <WebView
                            source={htmlSource}
                            style={styles.webView}
                            startInLoadingState={true}
                            scalesPageToFit={true}
                            javaScriptEnabled={false}
                        />
                    )}
                </View>
            </View>
        )
    }

    return null
}
const styles = StyleSheet.create({
    fullScreenContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#fff',
        zIndex: 1000,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContent: {
        width: '90%',
        height: '85%',
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 15,
        textAlign: 'center',
    },
    scrollView: {
        maxHeight: '70%',
        marginBottom: 15,
    },
    termsText: {
        fontSize: 14,
        lineHeight: 20,
        color: '#333',
    },
    termsContainer: {
        padding: 10,
    },
    webViewContainer: {
        flex: 1,
        marginBottom: 15,
        height: '100%',
    },
    webView: {
        flex: 1,
        backgroundColor: '#fff',
        minHeight: 400,
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 10,
    },
    acceptButton: {
        flex: 1,
        height: 44,
        backgroundColor: '#4A90E2',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 5,
        marginLeft: 5,
    },
    acceptButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    closeButton: {
        height: 44,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 5,
        borderWidth: 1,
        borderColor: '#ddd',
        paddingHorizontal: 20,
        alignSelf: 'center',
        minWidth: 100,
    },
    closeButtonText: {
        color: '#666',
        fontSize: 16,
    },
})