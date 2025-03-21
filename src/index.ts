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

interface GraphQLResponse {
  data: {
    node: ProjectV2Item;
  };
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
  }
});

// 初始化 Mattermost 客戶端
const mattermost = new MattermostClient(env.MATTERMOST_WEBHOOK_URL);

// 處理 Project v2 Item 事件
app.webhooks.on('projects_v2_item.edited', async ({ payload, octokit }) => {
  console.log('Payload:', JSON.stringify(payload, null, 2));
  // try {
  //   console.log('Payload:', JSON.stringify(payload, null, 2));

  //   const item = payload.projects_v2_item;
  //   const itemId = item.id;

  //   // 使用 GraphQL API 獲取更多項目資訊
  //   const response = await octokit.graphql<GraphQLResponse>(`
  //     query GetProjectItem($itemId: ID!) {
  //       node(id: $itemId) {
  //         ... on ProjectV2Item {
  //           content {
  //             ... on Issue {
  //               title
  //               url
  //             }
  //             ... on PullRequest {
  //               title
  //               url
  //             }
  //           }
  //           fieldValues(first: 10) {
  //             nodes {
  //               ... on ProjectV2ItemFieldDateValue {
  //                 field { name }
  //                 date
  //               }
  //               ... on ProjectV2ItemFieldNumberValue {
  //                 field { name }
  //                 number
  //               }
  //               ... on ProjectV2ItemFieldSingleSelectValue {
  //                 field { name }
  //                 optionId
  //               }
  //               ... on ProjectV2ItemFieldTextValue {
  //                 field { name }
  //                 text
  //               }
  //             }
  //           }
  //         }
  //       }
  //     }
  //   `, {
  //     itemId
  //   });

  //   const projectItem = response.data.node;
  //   const content = projectItem.content;
  //   const title = content?.title || '未知標題';
  //   const url = content?.url || '';

  //   // 獲取狀態欄位的變更
  //   const statusField = projectItem.fieldValues.nodes.find(
  //     field => field.field.name === 'Status'
  //   ) as ProjectV2ItemFieldValue;

  //   const oldStatus = payload.changes?.field_value?.field_node_id 
  //     ? await getStatusName(octokit, item.project_node_id, payload.changes.field_value.field_node_id)
  //     : '未知狀態';

  //   const newStatus = statusField?.optionId 
  //     ? await getStatusName(octokit, item.project_node_id, statusField.optionId)
  //     : '未知狀態';

  //   const message: MattermostMessage = {
  //     channel: 'project-management',
  //     text: `🎯 專案項目狀態更新\n` +
  //           `標題：${title}\n` +
  //           `狀態：${oldStatus} ➡️ ${newStatus}\n` +
  //           `更新者：${payload.sender.login}\n` +
  //           `[查看項目](${url})`
  //   };

  //   await mattermost.sendMessage(message);
  //   console.log('已發送通知到 Mattermost');
  // } catch (error) {
  //   console.error('發送通知時發生錯誤：', error);
  // }
});

// 獲取狀態名稱的輔助函數
async function getStatusName(octokit: any, projectId: string, optionId: string): Promise<string> {
  try {
    const { data } = await octokit.graphql(`
      query GetStatusName($projectId: ID!, $optionId: String!) {
        node(id: $projectId) {
          ... on ProjectV2 {
            field(name: "Status") {
              ... on ProjectV2FieldCommon {
                options {
                  id
                  name
                }
              }
            }
          }
        }
      }
    `, {
      projectId,
      optionId
    });

    const options = data.node.field.options;
    const option = options.find((opt: any) => opt.id === optionId);
    return option?.name || '未知狀態';
  } catch (error) {
    console.error('獲取狀態名稱時發生錯誤：', error);
    return '未知狀態';
  }
}

// 建立 HTTP 伺服器
const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  // 處理健康檢查端點
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
    return;
  }

  // 使用 Octokit 的 webhook 中間件處理請求
  const middleware = createNodeMiddleware(app, { pathPrefix: '/webhook' });
  await middleware(req, res);
});

const port = env.PORT ? parseInt(env.PORT, 10) : 3000;
server.listen(port, () => {
  console.log(`伺服器正在監聽 port ${port}`);
});
