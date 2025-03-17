// components/TermsOfService.tsx
// TODO: Use stack navigation for this to display on iOS
import React from 'react'
import { Modal, View, Text, ScrollView, Pressable, StyleSheet, Platform } from 'react-native'

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
                        <Text style={styles.title}>Terms of Service</Text>
                        
                        <ScrollView style={styles.scrollView}>
                            <Text style={styles.termsText}>
                                {/* Replace this with your actual Terms of Service */}
                                [Your Terms of Service content will go here]
                            </Text>
                        </ScrollView>

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
                
                <ScrollView style={styles.scrollView}>
                    <Text style={styles.termsText}>
                        {/* Replace this with your actual Terms of Service */}
                        [Your Terms of Service content will go here]
                    </Text>
                </ScrollView>
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
        maxHeight: '80%',
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 20,
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
        flex: 1,
        height: 44,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 5,
        borderWidth: 1,
        borderColor: '#ddd',
        marginRight: 5,
    },
    closeButtonText: {
        color: '#666',
        fontSize: 16,
    },
})