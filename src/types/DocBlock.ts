export interface DocBlock {
  id: string;
  type: 'heading' | 'paragraph' | 'checklist' | 'code';
  content: string;
  checked?: boolean;
}
