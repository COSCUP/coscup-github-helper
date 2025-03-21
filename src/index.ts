import 'dotenv/config';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { App, createNodeMiddleware } from 'octokit';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { MattermostClient, MattermostMessage } from './utils/mattermost.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface EnvironmentVariables {
  GITHUB_APP_ID: string;
  GITHUB_PRIVATE_KEY: string;
  GITHUB_WEBHOOK_SECRET: string;
  MATTERMOST_WEBHOOK_URL: string;
  PORT?: string;
}

interface ProjectV2ItemContent {
  title: string;
  url: string;
}

interface ProjectV2ItemFieldValue {
  field: {
    name: string;
  };
  date?: string;
  number?: number;
  optionId?: string;
  text?: string;
}

interface ProjectV2Item {
  content: ProjectV2ItemContent;
  fieldValues: {
    nodes: ProjectV2ItemFieldValue[];
  };
}

interface StatusChange {
  id: string;
  name: string;
  color: string;
  description: string;
}

interface FieldValueChange {
  field_node_id: string;
  field_type: 'number' | 'single_select' | 'date' | 'text' | 'iteration';
  field_name: string;
  project_number: number;
  from?: StatusChange;
  to?: StatusChange;
}

interface ProjectV2ItemChanges {
  field_value?: FieldValueChange;
}

interface ProjectV2ItemPayload {
  action: string;
  projects_v2_item: {
    id: number;
    node_id: string;
    project_node_id: string;
    content_node_id: string;
    content_type: string;
    creator: {
      login: string;
    };
    created_at: string;
    updated_at: string;
    archived_at: string | null;
  };
  changes: ProjectV2ItemChanges;
  organization: {
    login: string;
  };
  sender: {
    login: string;
  };
  installation: {
    id: number;
  };
}

interface GraphQLResponse {
  node: ProjectV2Item;
}

// 檢查必要的環境變數
function checkRequiredEnvVars(): EnvironmentVariables {
  const requiredEnvVars: (keyof EnvironmentVariables)[] = [
    'GITHUB_APP_ID',
    'GITHUB_PRIVATE_KEY',
    'GITHUB_WEBHOOK_SECRET',
    'MATTERMOST_WEBHOOK_URL'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(`缺少必要的環境變數：${missingVars.join(', ')}`);
  }

  return {
    GITHUB_APP_ID: process.env.GITHUB_APP_ID!,
    GITHUB_PRIVATE_KEY: process.env.GITHUB_PRIVATE_KEY!,
    GITHUB_WEBHOOK_SECRET: process.env.GITHUB_WEBHOOK_SECRET!,
    MATTERMOST_WEBHOOK_URL: process.env.MATTERMOST_WEBHOOK_URL!,
    PORT: process.env.PORT
  };
}

// 檢查環境變數
const env = checkRequiredEnvVars();

// 初始化 GitHub App
const app = new App({
  appId: env.GITHUB_APP_ID,
  privateKey: env.GITHUB_PRIVATE_KEY,
  webhooks: {
    secret: env.GITHUB_WEBHOOK_SECRET
  },
  oauth: { clientId: '', clientSecret: '' },
});

// 初始化 Mattermost 客戶端
const mattermost = new MattermostClient(env.MATTERMOST_WEBHOOK_URL);

// 處理 Project v2 Item 事件
app.webhooks.on('projects_v2_item.edited', async ({ payload, octokit }) => {
  try {
    const typedPayload = payload as unknown as ProjectV2ItemPayload;
    const item = typedPayload.projects_v2_item;
    const changes = typedPayload.changes;

    // 檢查是否有狀態變更
    if (changes?.field_value?.field_name === 'Status') {
      const oldStatus = changes.field_value.from?.name || '未知狀態';
      const newStatus = changes.field_value.to?.name || '未知狀態';

      // 使用 GraphQL API 獲取項目內容
      const response = await octokit.graphql<GraphQLResponse>(`
        query GetProjectItem($itemId: ID!) {
          node(id: $itemId) {
            ... on ProjectV2Item {
              content {
                ... on Issue {
                  title
                  url
                }
                ... on PullRequest {
                  title
                  url
                }
              }
            }
          }
        }
      `, {
        itemId: item.node_id
      });

      const content = response.node.content;
      const title = content?.title || '未知標題';
      const url = content?.url || '';

      const message: MattermostMessage = {
        channel: 'information',
        text: `🎯 專案項目狀態更新\n` +
              `標題：${title}\n` +
              `狀態：${oldStatus} ➡️ ${newStatus}\n` +
              `更新者：${typedPayload.sender.login}\n` +
              `[查看項目](${url})`
      };

      await mattermost.sendMessage(message);
      console.log('已發送通知到 Mattermost');
    }
  } catch (error) {
    console.error('發送通知時發生錯誤：', error);
  }
});

const middleware = createNodeMiddleware(app);

// 建立 HTTP 伺服器
const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  try {
    // 處理健康檢查端點
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('OK');
      return;
    }

    // 處理 webhook 請求
    if (await middleware(req, res)) return;

    // 處理其他請求
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  } catch (error) {
    console.error('處理請求時發生錯誤：', error);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error');
  }
});

const port = env.PORT ? parseInt(env.PORT, 10) : 3000;
server.listen(port, () => {
  console.log(`伺服器正在監聽 port ${port}`);
});
