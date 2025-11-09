import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import Avatar from "./Avatar";
import { UserDto } from "services/generated/generatedClient";

interface UsernameProps {
  user: UserDto;
  navigation: any;
  styles: {
    container?: any;
    username?: any;
  };
  showAvatar?: boolean;
}

const Username: React.FC<UsernameProps> = ({
  user,
  navigation,
  styles,
  showAvatar = false,
}) => {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => navigation.navigate("Profile", { userId: user.id })}
    >
      {showAvatar && (
        <Avatar name={user.name} userId={user.id} navigation={navigation} />
      )}
      <Text style={styles.username}>{user.name}</Text>
    </TouchableOpacity>
  );
};

export default Username;
