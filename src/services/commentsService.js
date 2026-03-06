import focalBoardService from './focalBoardService.js';

export const commentsService = {
  async getItemComments(itemId, limit = 50) {
    const rows = await focalBoardService.getItemComments(itemId);
    const normalized = (rows || []).map((entry) => ({
      id: entry.id,
      item_id: entry.item_id,
      user_id: entry.user_id,
      body: entry.body,
      created_at: entry.created_at
    }));
    const slice = normalized.slice(-Math.max(1, limit));
    return slice.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  },

  async createComment(itemId, userId, body) {
    const row = await focalBoardService.createItemComment(itemId, userId, body);
    return {
      id: row.id,
      item_id: row.item_id,
      user_id: row.user_id,
      body: row.body,
      created_at: row.created_at
    };
  }
};

export default commentsService;
