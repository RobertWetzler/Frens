import { StyleSheet, View, Text } from 'react-native';
import { Avatar as RneuiAvatar } from '@rneui/base';
import { Svg, Ellipse, Path } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';
import { makeStyles } from '../theme/makeStyles';

interface AvatarProps {
    name: string;
    userId: string;
    imageUrl?: string;
    navigation?: any;
}

const useStyles = makeStyles((theme) => ({
    avatarContainer: {
        padding: 2,
        backgroundColor: theme.colors.card,
        borderRadius: 60,
        marginRight: 7,
    },
    pumpkinWrapper: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    initial: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        fontSize: 18,
        lineHeight: 44, // ensure vertical centering in 44x44 box
        fontWeight: '700',
        color: theme.colors.primaryContrast,
        textAlign: 'center',
        textShadowColor: 'rgba(0,0,0,0.35)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
        includeFontPadding: false,
    },
    // Additional style tokens could be added here
}));

export const Avatar: React.FC<AvatarProps> = ({ name, userId, imageUrl, navigation }) => {
    const { theme } = useTheme();
    const styles = useStyles();
    const initial = name?.charAt(0)?.toUpperCase() || '?';

    if (theme.name === 'halloween') {
        return (
            <View style={styles.avatarContainer} accessibilityLabel={`Avatar ${initial}`}>
                <View style={styles.pumpkinWrapper}>
                    <Svg width={44} height={44} viewBox="0 0 44 44">
                        {/* Larger, more prominent stem with bright green color */}
                        <Path d="M21 3 c2 0 3 1 3 3 v7 h-4 V6 c0-1.5 0.8-3 1-3z" fill="#43d854" stroke="#1e7f31" strokeWidth={0.6} />
                        <Ellipse cx={22} cy={24} rx={14} ry={13} fill={theme.colors.primary} stroke="#e05d00" strokeWidth={2} />
                        <Ellipse cx={16} cy={24} rx={10} ry={12} fill={theme.colors.primary} opacity={0.9} />
                        <Ellipse cx={28} cy={24} rx={10} ry={12} fill={theme.colors.primary} opacity={0.9} />
                        <Path d="M22 11 v26" stroke="#ffb066" strokeWidth={1.2} strokeLinecap="round" opacity={0.6} />
                        <Path d="M18 12 v24" stroke="#ffb066" strokeWidth={0.9} strokeLinecap="round" opacity={0.45} />
                        <Path d="M26 12 v24" stroke="#ffb066" strokeWidth={0.9} strokeLinecap="round" opacity={0.45} />
                    </Svg>
                    <Text style={styles.initial}>{initial}</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.avatarContainer}>
            <RneuiAvatar
                rounded
                overlayContainerStyle={{ backgroundColor: theme.colors.primary }}
                title={initial}
            />
        </View>
    );
};

export default Avatar;


// styles generated via useStyles