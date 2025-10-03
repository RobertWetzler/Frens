import { StyleSheet, View, Pressable, Text } from 'react-native';
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useTheme } from '../theme/ThemeContext';
import { makeStyles } from '../theme/makeStyles';

interface ThemedButtonProps {
    label: string;
    variant?: 'primary' | 'outline' | 'ghost';
    onPress?: () => void;
    iconName?: string;
    disabled?: boolean;
}

export default function Button({ label, variant = 'primary', onPress, iconName = 'picture-o', disabled }: ThemedButtonProps) {
    const { theme } = useTheme();
    const styles = useStyles();

        const containerStyles: any[] = [styles.buttonBase];
        const labelStyles: any[] = [styles.buttonLabel];

    if (variant === 'primary') {
        containerStyles.push(styles.primary);
        labelStyles.push(styles.labelPrimary);
    } else if (variant === 'outline') {
        containerStyles.push(styles.outline);
        labelStyles.push(styles.labelOutline);
    } else if (variant === 'ghost') {
        containerStyles.push(styles.ghost);
        labelStyles.push(styles.labelGhost);
    }

    if (disabled) {
        containerStyles.push(styles.disabled);
    }

    return (
        <View style={styles.buttonContainer}>
            <Pressable style={containerStyles} onPress={onPress} disabled={disabled}>
                {iconName && (
                    <FontAwesome
                        name={iconName as any}
                        size={18}
                        color={variant === 'primary' ? theme.colors.primaryContrast : theme.colors.primary}
                        style={styles.buttonIcon}
                    />
                )}
                <Text style={labelStyles}>{label}</Text>
            </Pressable>
        </View>
    );
}

const useStyles = makeStyles((theme) => ({
    buttonContainer: {
        width: 320,
        height: 56,
        marginHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 3,
    },
    buttonBase: {
        borderRadius: 12,
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        paddingHorizontal: 16,
    },
    primary: {
        backgroundColor: theme.colors.primary,
    },
    outline: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: theme.colors.primary,
    },
    ghost: {
        backgroundColor: 'transparent',
    },
    buttonIcon: {
        paddingRight: 8,
    },
    labelPrimary: {
        color: theme.colors.primaryContrast,
    },
    labelOutline: {
        color: theme.colors.primary,
    },
    labelGhost: {
        color: theme.colors.textPrimary,
    },
    buttonLabel: {
        fontSize: 16,
        fontWeight: '600',
    },
    disabled: {
        opacity: 0.5,
    }
}));