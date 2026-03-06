declare interface CommentsServiceItemComment {
  id: string;
  item_id: string;
  user_id: string;
  body: string;
  created_at: string;
}

declare const commentsService: {
  getItemComments(itemId: string, limit?: number): Promise<CommentsServiceItemComment[]>;
  createComment(itemId: string, userId: string, body: string): Promise<CommentsServiceItemComment>;
};

export default commentsService;
