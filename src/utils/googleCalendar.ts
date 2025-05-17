import { google } from 'googleapis';

export async function getUpcomingEvents(calendarId: string) {
  const apiKey = process.env.GOOGLE_CALENDAR_API_KEY;

  if (!apiKey) {
    throw new Error('GOOGLE_CALENDAR_API_KEY is not set.');
  }

  // Initialize the Calendar API client without the auth property here
  const calendar = google.calendar({ version: 'v3' });

  const now = new Date();
  const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const timeMin = now.toISOString();
  const timeMax = next24Hours.toISOString();

  try {
    // Pass the API key in the 'key' parameter of the list method
    const response = await calendar.events.list({
      calendarId: calendarId,
      timeMin: timeMin,
      timeMax: timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      key: apiKey, // Add the API key here
    });

    const events = response.data.items ?? [];
    return events;
  } catch (error) {
    console.error('Error fetching Google Calendar events:', error);
    // Consider re-throwing the error or returning a specific error indicator
    throw error;
  }
}

// Example usage (assuming this function is exported)
// import { getUpcomingEvents } from './googleCalendar';
// getUpcomingEvents('primary') // Use your actual calendar ID
//   .then(events => console.log('Upcoming events:', events))
//   .catch(error => console.error('Failed to get events:', error));
