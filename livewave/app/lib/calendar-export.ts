import * as Calendar from 'expo-calendar';
import * as IntentLauncher from 'expo-intent-launcher';
import { Alert, Platform } from 'react-native';

export async function addToNativeCalendar(event: any) {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission needed', 'We need access to your calendar to save events.');
    return;
  }

  const startDate = new Date(event.date);
  const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000); // 2 hours

  try {
      const eventDetails: Partial<Calendar.Event> = {
          title: `${event.artist?.name || 'Concert'} at ${event.venue}`,
          startDate,
          endDate,
          timeZone: 'GMT',
          location: `${event.venue}, ${event.city}, ${event.country}`,
          notes: `Event added via Livewave. More info: ${event.external_url || ''}`,
          url: event.external_url
      };

      if (Platform.OS === 'ios') {
          // This opens the native iOS Event Edit View Controller
          await Calendar.createEventInCalendarAsync(eventDetails);
      } else {
          // Android Native Intent logic (keeping the one that works well)
          await openAndroidCalendarEvent(event);
      }

  } catch (e) {
      console.error("Error creating native event:", e);
      Alert.alert('Error', 'Could not open calendar.');
  }
}

// Keep Android implementation as fallback/specialized if needed, but createEventInCalendarAsync might work there too.
// For now, I'll stick to the specific Android intent I wrote before as it was working fine, but wrap iOS in the new method.
async function openAndroidCalendarEvent(event: any) {
   const startDate = new Date(event.date).getTime();
   const endDate = startDate + (2 * 60 * 60 * 1000);
   try {
     const activityAction = 'android.intent.action.INSERT';
     const intentParams: any = {
       data: 'content://com.android.calendar/events',
         extra: {
         'beginTime': startDate,
         'endTime': endDate,
         'title': `${event.artist?.name || 'Concert'} at ${event.venue}`,
         'eventLocation': `${event.venue}, ${event.city}, ${event.country}`,
         'description': `Event added via Livewave. More info: ${event.external_url || ''}`
       }
     };
     await IntentLauncher.startActivityAsync(activityAction, intentParams);
   } catch (e) {
     console.error("IntentLauncher error", e);
   }
}
