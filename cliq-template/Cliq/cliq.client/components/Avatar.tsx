import { StyleSheet, View, Pressable, Text } from 'react-native';
import { Avatar as RneuiAvatar } from '@rneui/base';

interface AvatarProps {
    name: string;
    userId: string;
    imageUrl?: string;
    navigation?: any;
}

export const Avatar: React.FC<AvatarProps> = ({ name, userId, imageUrl, navigation }) => {
    return (
        <View style={styles.avatarContainer}>
            <RneuiAvatar 
                rounded
                overlayContainerStyle={{ backgroundColor: '#73cbff' }}
                title={name.charAt(0).toUpperCase()}
                // TODO: Load user photo
                /*source={{
                        uri: imageUrl,
                }} */
            />
        </View>
    );
};

export default Avatar;


const styles = StyleSheet.create({
    avatarContainer: {
        padding: 2, // Creates spacing around the avatar
        backgroundColor: 'white', // Same as background color
        borderRadius: 60, // Fully rounded to match the avatar
        marginRight: 7,
        // Optional shadow for more definition
        // shadowColor: '#fff',
        // shadowOpacity: 1,
        // shadowOffset: { width: 0, height: 0 },
        // shadowRadius: 3,
    },
})