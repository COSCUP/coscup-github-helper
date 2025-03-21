import { Octokit } from 'octokit';
import { MattermostClient, MattermostMessage } from '../utils/mattermost.js';

interface ProjectV2ItemContent {
  title: string;
  url: string;
}

interface ProjectV2Item {
  content: ProjectV2ItemContent;
}

interface GraphQLResponse {
  node: ProjectV2Item;
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
    html_url: string;
  };
  installation: {
    id: number;
  };
}

const projectNumberToMattermostChannel: Record<number, string> = {
  7: 'program',
  4: 'information',
}

const colorToEmoji: Record<string, string> = {
  RED: '🔴',
  GREEN: '🟢',
  BLUE: '🔵',
  YELLOW: '🟡',
  PURPLE: '🟣',
  PINK: '💗',
  ORANGE: '🟠',
  GRAY: '⚫',
  WHITE: '⚪',
  CYAN: '🔷',
  LIME: '💚',
  BROWN: '🟤',
  TEAL: '🔹',
  INDIGO: '🔸',
  VIOLET: '🔺',
  BLACK: '⚫',
  MAGENTA: '💜',
  AQUA: '💠',
  LAVENDER: '💜',
  MAROON: '🟤',
  OLIVE: '🟢',
  NAVY: '🔵',
  CRIMSON: '🔴',
  GOLD: '🟡',
  SILVER: '⚪',
  TURQUOISE: '🔷',
  CORAL: '🔸',
  TOMATO: '🔴',
  CHOCOLATE: '🟤',
  SLATE: '⚫',
  STEEL: '⚪',
  PLUM: '🟣',
  SALMON: '🔸',
  PERIWINKLE: '🔷',
  MINT: '💚',
  LEMON: '🟡',
  PEACH: '🔸',
  ROSE: '💗',
  LILAC: '💜',
  AUBURN: '🟤',
  CERULEAN: '🔵',
  VERMILION: '🔴',
  AQUAMARINE: '💠',
  BURGUNDY: '🟤',
  COBALT: '🔵',
  EMERALD: '💚',
  GARNET: '🔴',
  JADE: '💚',
  JASPER: '🟤',
  LAPIS: '🔵',
  MAUVE: '💜',
  OCHRE: '🟡',
  RUBY: '🔴',
  SAPPHIRE: '🔵',
  SCARLET: '🔴',
  TAN: '🟤',
  TAUPE: '⚫',
  TOPAZ: '💠',
  ULTRAMARINE: '🔵',
  VERDIGRIS: '💚',
  VIRIDIAN: '💚',
  WHEAT: '🟡',
  ZINC: '⚪',
  ZIRCON: '💠',
};

export async function handleProjectStatusChange(
  payload: unknown,
  octokit: Octokit,
  mattermost: MattermostClient
) {
  try {
    const typedPayload = payload as unknown as ProjectV2ItemPayload;
    const item = typedPayload.projects_v2_item;
    const changes = typedPayload.changes;

    const projectNumber = changes.field_value?.project_number
    if (!projectNumber) {
      return;
    }
    const channel = projectNumberToMattermostChannel[projectNumber]
    if (!channel) {
      console.log('未找到對應的 Mattermost 頻道');
      return;
    }

    // 檢查是否有狀態變更
    if (changes?.field_value?.field_name === 'Status') {
      const oldStatus = changes.field_value.from?.name || '未知狀態';
      const newStatus = changes.field_value.to?.name || '未知狀態';
      const oldColor = changes.field_value.from?.color || '';
      const newColor = changes.field_value.to?.color || '';
      const oldEmoji = colorToEmoji[oldColor] || '⚪';
      const newEmoji = colorToEmoji[newColor] || '⚪';

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
        channel,
        text: `Issue [${title}](${url}) status changed from ${oldEmoji}${oldStatus} to ${newEmoji}${newStatus} by [${typedPayload.sender.login}](${typedPayload.sender.html_url}) \n`
      };

      await mattermost.sendMessage(message);
      console.log('已發送通知到 Mattermost');
    }
  } catch (error) {
    console.error('發送通知時發生錯誤：', error);
  }
} 
