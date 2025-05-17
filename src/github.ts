import { getUpcomingEvents } from './utils/googleCalendar.js';
import { MattermostClient, MattermostMessage } from './utils/mattermost.js'; // Import MattermostMessage type
import { getRandomColor } from './utils/color.js'; // Import color utility

// Fixed list of quotes, including open-source related ones
const QUOTES = [
  "坑坑相連到天邊",
  "Released early, released often.", // Eric S. Raymond
  "Given enough eyeballs, all bugs are shallow.", // Linus's Law
  "In real open source, you have the right to control your own destiny.", // Linus Torvalds
  "Sharing knowledge is the most fundamental act of friendship.", // Richard Stallman
  "The best way to predict the future is to open source it.",
  "程式碼是寫給人看的，順便給機器執行。",
  "開源吃掉全世界。",
  "COSCUP 的組別只是為了行政方便，而不是枷鎖，其實你完全可以參與任何有興趣的事情。",
  "COSCUP 總召與組長的存在，只是因為事情總要有人負責。",
  "歡迎看看去年 2024 的回顧文件：https://s.coscup.org/24review",
  "其實今年的回顧文件已經可以開始填寫：https://s.coscup.org/25review"
];

// No need for quoteIndex anymore
// let quoteIndex = 0;

async function main() {
  const mattermostWebhookUrl = process.env.MATTERMOST_WEBHOOK_URL;
  if (!mattermostWebhookUrl) {
    throw new Error('MATTERMOST_WEBHOOK_URL environment variable is not set.');
  }

  const calendarId = process.env.CALENDAR_ID;
  if (!calendarId) {
    throw new Error('CALENDAR_ID environment variable is not set.');
  }

  const channel = process.env.MATTERMOST_CHANNEL || 'coscup-2025'; // Use env var or default

  try {
    const events = await getUpcomingEvents(calendarId);
    const mattermostClient = new MattermostClient(mattermostWebhookUrl); // Create client once

    for (const event of events) {
      if (event.start && event.start.dateTime && event.summary) {
        const startTime = new Date(event.start.dateTime);
        const formattedStartTime = startTime.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false });

        // Select quote randomly
        const randomIndex = Math.floor(Math.random() * QUOTES.length);
        const selectedQuote = QUOTES[randomIndex];
        // quoteIndex++; // No longer needed

        // Construct the fancier message with attachments
        const message: MattermostMessage = {
          channel: channel,
          // text: `提醒：${event.summary}`, // Optional fallback text
          attachments: [
            {
              fallback: `提醒： ${formattedStartTime} 有 ${event.summary} 活動！`, // Plain text fallback
              color: getRandomColor(), // Use random color
              // pretext: "📅 近期活動提醒",
              title: `🗓️ ${event.summary}`,
              title_link: event.htmlLink,
              // Use description field from event if available, otherwise fallback
              text: `**時間：** ${formattedStartTime}

**地點/連結：** ${event.location || event.description || event.hangoutLink || '未指定'}

*每日一句：${selectedQuote}*`, // Main content with markdown and random quote. Escaped newlines for JSON.
            }
          ]
        };

        await mattermostClient.sendMessage(message);
        console.log(`已發送會議提醒到 Mattermost: ${event.summary}`);

      } else {
        console.error('event:', event);
        console.error('Error: Incomplete event data.');
      }
    }
  } catch (error) {
    console.error('處理 Google Calendar 事件或發送 Mattermost 訊息時發生錯誤:', error);
  }
}

main();
