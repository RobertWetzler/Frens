import React, { useState } from 'react';
import {View, Text, TextInput, StyleSheet} from 'react-native';
interface DateInputProps {
    value: Date | null
    onChange: (date: Date | null) => void
    error?: string
}

export const DateInput = ({ value, onChange, error }: DateInputProps) => {
    const [day, setDay] = useState('')
    const [month, setMonth] = useState('')
    const [year, setYear] = useState('')

    const updateDate = (newDay: string, newMonth: string, newYear: string) => {
        if (newDay && newMonth && newYear) {
            const date = new Date(
                parseInt(newYear),
                parseInt(newMonth) - 1,
                parseInt(newDay)
            )
            if (!isNaN(date.getTime())) {
                onChange(date)
            } else {
                onChange(null)
            }
        }
    }

    return (
        <View style={styles.dateContainer}>
            <Text style={styles.dateLabel}>Date of Birth</Text>
            <View style={styles.dateInputContainer}>
                <TextInput
                    style={styles.dateInput}
                    placeholder="MM"
                    placeholderTextColor="#666"
                    value={month}
                    onChangeText={(text) => {
                        const filtered = text.replace(/[^0-9]/g, '')
                        if (filtered.length <= 2) {
                            setMonth(filtered)
                            updateDate(day, filtered, year)
                        }
                    }}
                    keyboardType="number-pad"
                    maxLength={2}
                />
                <Text style={styles.dateSeparator}>/</Text>
                <TextInput
                    style={styles.dateInput}
                    placeholder="DD"
                    placeholderTextColor="#666"
                    value={day}
                    onChangeText={(text) => {
                        const filtered = text.replace(/[^0-9]/g, '')
                        if (filtered.length <= 2) {
                            setDay(filtered)
                            updateDate(filtered, month, year)
                        }
                    }}
                    keyboardType="number-pad"
                    maxLength={2}
                />
                <Text style={styles.dateSeparator}>/</Text>
                <TextInput
                    style={[styles.dateInput, styles.yearInput]}
                    placeholder="YYYY"
                    placeholderTextColor="#666"
                    value={year}
                    onChangeText={(text) => {
                        const filtered = text.replace(/[^0-9]/g, '')
                        if (filtered.length <= 4) {
                            setYear(filtered)
                            updateDate(day, month, filtered)
                        }
                    }}
                    keyboardType="number-pad"
                    maxLength={4}
                />
            </View>
            {error && <Text style={styles.errorText}>{error}</Text>}
        </View>
    )
}
const styles = StyleSheet.create({
    // ... existing styles ...
    dateContainer: {
        width: '100%',
        marginBottom: 10,
    },
    dateLabel: {
        marginBottom: 5,
        fontSize: 14,
        color: '#666',
    },
    dateInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dateInput: {
        width: 50,
        height: 44,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 5,
        paddingHorizontal: 10,
        textAlign: 'center',
    },
    yearInput: {
        width: 80,
    },
    dateSeparator: {
        marginHorizontal: 5,
        fontSize: 18,
        color: '#666',
    },
    errorText: {
        color: 'red',
        fontSize: 12,
        marginTop: 5,
    }
})