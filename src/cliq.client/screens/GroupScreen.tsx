import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { makeStyles } from '../theme/makeStyles';

const GroupsScreen = () => {
  const { theme } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Groups Screen</Text>
    </View>
  );
};

const useStyles = makeStyles(theme => ({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.backgroundAlt,
  },
  text: {
    color: theme.colors.textPrimary,
    fontSize: 16,
  },
}));

export default GroupsScreen;