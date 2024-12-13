import React, { useState, useEffect } from 'react';
import { View, Button, TextInput, StyleSheet, Alert, Text, ScrollView, TouchableOpacity } from 'react-native';
import * as Notifications from 'expo-notifications';//Notification
import * as SMS from 'expo-sms'; // sms 
import * as MailComposer from 'expo-mail-composer'; // Email functionality
import { Audio } from 'expo-av'; //audio 
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer } from '@react-navigation/native';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, remove, set, onValue } from 'firebase/database';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';


// Firebase Configuration
const firebaseConfig = {
  apiKey: "-------------",
  authDomain: "-------------",
  projectId: "-------------",
  storageBucket: "-------------",
  messagingSenderId: "-------------",
  appId: "-------------"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth with persistence
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

const database = getDatabase(app);

// Login Screen
function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Observe authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        navigation.navigate('Home');
      }
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [navigation]);

  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigation.navigate('Home');
    } catch (error) {
      Alert.alert('Login Failed', error.message);
    }
  };

  const handleSignUp = async () => {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      navigation.navigate('Home');
    } catch (error) {
      Alert.alert('Sign Up Failed', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login to Calendar App</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter email"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Enter password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Button title="Login" onPress={handleLogin} />
      <Button title="Sign Up" onPress={handleSignUp} />
    </View>
  );
}

// Home Screen (Main Screen)
function HomeScreen({ navigation }) {
  const [events, setEvents] = useState([]);
  const [user, setUser] = useState(null);
  const [sound, setSound] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
      } else {
        navigation.navigate('Login');
      }
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    const eventsRef = ref(database, 'events/');
    onValue(eventsRef, (snapshot) => {
      const data = snapshot.val();
      const eventsList = data
        ? Object.keys(data).map((key) => ({
            id: key,
            name: data[key].name,
            notificationScheduled: data[key].notificationScheduled,
            audioURI: data[key].audioURI,
            audioLength: data[key].audioLength,
            date: data[key].date,
          }))
        : [];
    
      // Sort events by date in ascending order
      eventsList.sort((a, b) => {
        const dateA = new Date(a.date); // Convert the date to Date object
        const dateB = new Date(b.date);
        return dateA - dateB; // Sort in ascending order
      });

      setEvents(eventsList);
    });
  }, []);

  // Function to delete an event from Firebase
  const deleteEvent = (eventId) => {
    const eventRef = ref(database, `events/${eventId}`);
    remove(eventRef)
      .then(() => {
        // Remove the event from the state as well after successful deletion
        setEvents((prevEvents) => prevEvents.filter((event) => event.id !== eventId));
        Alert.alert('Success', 'Event deleted successfully');
      })
      .catch((error) => {
        Alert.alert('Error', `Failed to delete event: ${error.message}`);
      });
  };

  const sendReviewEmail = async () => {
    if (!user) {
      Alert.alert('Error', 'No logged-in user found');
      return;
    }

    const eventNames = events.map((event) => event.name).join(', ');
    const emailOptions = {
      recipients: [user.email],
      subject: 'Upcoming Events Review',
      body: `Here are your upcoming events: ${eventNames}`,
    };

    const result = await MailComposer.composeAsync(emailOptions);
    if (result.status === 'sent') {
      Alert.alert('Success', 'Email sent successfully');
    } else {
      Alert.alert('Failed', 'Email not sent');
    }
  };

  const handleInviteFriend = async (eventName) => {
    const isAvailable = await SMS.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert('Error', 'SMS functionality is not available on this device');
      return;
    }
  
    try {
      const result = await SMS.sendSMSAsync([], `You're invited to the event: ${eventName}`);
        console.log(result);
    
      Alert.alert('Success', 'Invitation sent successfully');
    } catch (error) {
      console.error('Error sending SMS:', error);
      Alert.alert('Error', 'An error occurred while sending the invitation');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigation.navigate('Login');
    } catch (error) {
      Alert.alert('Logout Failed', error.message);
    }
  };

  const playAudio = async (uri) => {
    try {
      const { sound } = await Audio.Sound.createAsync({ uri });
      setSound(sound);
      await sound.playAsync();
    } catch (error) {
      Alert.alert('Playback Failed', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Calendar App</Text>

      <ScrollView style={styles.eventList}>
        <Text style={styles.subtitle}>Your Events:</Text>
        {events.length === 0 ? (
          <Text>No events added yet.</Text>
        ) : (
          events.map((event, index) => (
            <View key={index} style={styles.eventItem}>
              <Text style={styles.eventText}>
                {index + 1}. {event.name} {event.notificationScheduled ? '(Notification On)' : ''}
              </Text>
              <Text style={styles.eventDate}>
                Date: {event.date ? event.date : 'No Date Provided'}
              </Text>
              {event.audioURI && (
                <View style={styles.audioDetails}>
                  <Text>Audio Length: {event.audioLength} seconds</Text>
                  <Button title="Play" onPress={() => playAudio(event.audioURI)} />
                </View>
              )}
              <Button
                title="Invite Friend"
                onPress={() => handleInviteFriend(event.name)}
                color="#03A9F4"
              />
              <Button
                title="Delete Event"
                onPress={() => deleteEvent(event.id)}
                color="#F44336"
              />
            </View>
          ))
        )}
      </ScrollView>

      <Button title="Review Upcoming Events" onPress={sendReviewEmail} color="#0288D1" />
      <Button title="Go to Calendar" onPress={() => navigation.navigate('Calendar')} color="#673AB7" />
      <Button title="Logout" onPress={handleLogout} color="#F44336" />
    </View>
  );
}

//calender screen
function CalendarScreen({ navigation }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  const getDaysInMonth = (month, year) => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    return days;
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const handlePreviousMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const daysInMonth = getDaysInMonth(currentMonth, currentYear);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Calendar</Text>

      <View style={styles.navigation}>
        <TouchableOpacity onPress={handlePreviousMonth} style={styles.navButton}>
          <Text style={styles.navSymbol}>{'<'}</Text>
        </TouchableOpacity>

        <Text style={styles.monthYear}>
          {currentDate.toLocaleString('default', { month: 'long' })} {currentYear}
        </Text>

        <TouchableOpacity onPress={handleNextMonth} style={styles.navButton}>
          <Text style={styles.navSymbol}>{'>'}</Text>
        </TouchableOpacity>
      </View>

      {selectedDate && (
        <Text style={styles.selectedDate}>
          Selected Date: {selectedDate.toDateString()}
        </Text>
      )}

      <ScrollView style={styles.calendar}>
        <View style={styles.days}>
          {daysInMonth.map((date, index) => {
            const day = date.getDate();
            const isSelected = selectedDate && selectedDate.toDateString() === date.toDateString();
            return (
              <TouchableOpacity
                key={index}
                style={[styles.dayButton, isSelected && styles.selectedDay]}
                onPress={() => handleDateSelect(date)}
              >
                <Text style={styles.dayText}>{day}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {selectedDate && (
        <TouchableOpacity
          style={styles.plusButton}
          onPress={() =>
            navigation.navigate('AddEvent', {
              selectedDate: selectedDate.toDateString(), // Pass selected date
            })
          }
        >
          <Text style={styles.plusSign}>+</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const AddEventScreen = ({ navigation, route }) => {
  const [eventName, setEventName] = useState('');
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [recording, setRecording] = useState(null);
  const [sound, setSound] = useState(null);
  const [audioURI, setAudioURI] = useState('');
  const [audioLength, setAudioLength] = useState(0);
  const [pushToken] = useState(null);

  const selectedDate = route.params?.selectedDate || null;

  
  // Calculate the reminder time (1 day before the selected date)
  const getReminderTimeInSeconds = () => {
    if (!selectedDate) return 0;

    const selectedDateObj = new Date(selectedDate); // Convert selected date to Date object
    const reminderTime = new Date(selectedDateObj.setDate(selectedDateObj.getDate() - 1)); // Subtract 1 day

    const currentTime = new Date(); // Get current time
    const timeDifference = reminderTime - currentTime; // Calculate the difference in milliseconds

    return timeDifference / 1000; // Convert to seconds
  };

  // Handle scheduling the notification with reminder 1 day before the event
  const scheduleNotification = async () => {
    try {
      const reminderTimeInSeconds = getReminderTimeInSeconds(); // Get reminder time

      if (reminderTimeInSeconds <= 0) {
        Alert.alert('Error', 'Reminder time must be in the future');
        return;
      }

      console.log('Scheduling notification...');
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Event Reminder!',
          body: `Reminder for event: ${eventName}`,
          sound: 'default',
        },
        trigger: {
          seconds: reminderTimeInSeconds, // Use dynamic reminder time
        },
      });
      console.log('Notification scheduled successfully!');
    } catch (error) {
      console.error('Error scheduling notification:', error);
    }
  };

  // Save event to Firebase Realtime Database
  const saveEvent = () => {
    if (!eventName) {
      Alert.alert('Error', 'Please enter an event name');
      return;
    }

    if (!selectedDate) {
      Alert.alert('Error', 'Please select a date');
      return;
    }

    // Prepare the event object to save
    const eventRef = ref(database, 'events/' + new Date().getTime());
    set(eventRef, {
      name: eventName,
      notificationScheduled: notificationEnabled,
      audioURI,
      audioLength,
      pushToken,
      date: selectedDate, // Save the selected date here
    })
    .then(() => {
      if (notificationEnabled) {
        scheduleNotification(); // Schedule notification after saving event
      }
      navigation.goBack(); // Go back to previous screen after saving
    })
    .catch((error) => {
      console.log('Error saving event:', error);
    });
  };

  const requestRecordingPermission = async () => {
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Audio recording permission is required.');
      return false;
    }
    return true;
  };

  // Start Recording
  const startRecording = async () => {
    const hasPermission = await requestRecordingPermission();
    if (!hasPermission) return;

    try {
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(recording);
    } catch (error) {
      Alert.alert('Recording Error', error.message);
    }
  };

  // Stop Recording
  const stopRecording = async () => {
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      const { durationMillis } = await recording.getStatusAsync();
      setAudioURI(uri);
      setAudioLength(Math.round(durationMillis / 1000)); // In seconds
      setRecording(null);
    } catch (error) {
      Alert.alert('Recording Failed', error.message);
    }
  };

  // Play Audio
  const playAudio = async (uri) => {
    try {
      const { sound } = await Audio.Sound.createAsync({ uri });
      setSound(sound);
      await sound.playAsync();
    } catch (error) {
      Alert.alert('Playback Failed', error.message);
    }
  };
  return (
    <View style={styles.container}>
  <Text style={styles.title}>Add Event</Text>
  <TextInput
    style={styles.input}
    placeholder="Event Name"
    value={eventName}
    onChangeText={setEventName}
  />

  {/* Conditionally render the selected date */}
  {selectedDate && (
    <Text style={styles.selectedDate}>
      Selected Date: {selectedDate} {/* Wrap the selected date inside <Text> */}
    </Text>
  )}

  <Button title="Start Recording" onPress={startRecording} />
  {recording && <Button title="Stop Recording" onPress={stopRecording} />}
  {audioURI && (
    <View style={styles.audioDetails}>
      <Text>Audio Length: {audioLength} seconds</Text>
      <Button title="Play" onPress={() => playAudio(audioURI)} />
    </View>
  )}
  <Button
    title={notificationEnabled ? 'Disable Notification' : 'Enable Notification'}
    onPress={() => setNotificationEnabled(!notificationEnabled)}
  />
  <Button title="Save Event" onPress={saveEvent} />
</View>
  );
};

// App Container with Navigation
const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Calendar" component={CalendarScreen} />
        <Stack.Screen name="AddEvent" component={AddEventScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    marginBottom: 10,
    paddingLeft: 10,
  },
  eventList: {
    marginBottom: 20,
  },
  eventItem: {
    marginBottom: 10,
  },
  eventText: {
    fontSize: 16,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  navButton: {
    padding: 10,
  },
  navSymbol: {
    fontSize: 30,
  },
  monthYear: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    flex: 1,
  },
  selectedDate: {
    fontSize: 16,
    marginTop: 10,
    textAlign: 'center',
  },
  calendar: {
    flex: 1,
    marginTop: 20,
  },
  days: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  dayButton: {
    width: '14%',
    height: 40,
    margin: 5,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E0E0E0',
    borderRadius: 5,
  },
  selectedDay: {
    backgroundColor: '#4CAF50',
  },
  dayText: {
    fontSize: 16,
  },
  plusButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#FF4081',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  plusSign: {
    fontSize: 36,
    color: 'white',
  },
  navigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between', 
    marginBottom: 20,
  },
});