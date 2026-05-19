import { Platform, Alert } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  // Debug log for Simulator
  if (!Device.isDevice) {
    console.log('Running on Simulator/Emulator - Push Tokens may not work fully');
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  if (finalStatus !== 'granted') {
    Alert.alert('Permission needed', 'Failed to get push token for push notification!');
    return;
  }
  
  // Project ID check
  const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
  if (!projectId) {
     // Alert.alert('Configuration Error', 'Project ID not found. Ensure eas.json is configured.');
     // Proceed without Project ID to see if Expo Go handles it (sometimes it does)
  }

  try {
    token = (await Notifications.getExpoPushTokenAsync({
      projectId,
    })).data;
  } catch (e) {
    console.log('Error getting token:', e);
    token = null;
  }

  return token;
}
