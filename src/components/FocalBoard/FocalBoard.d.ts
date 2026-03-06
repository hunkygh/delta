import React from 'react';

declare interface FocalBoardProps {
  userId: string;
  selectedFocalFromNav?: string | null;
  selectedFocalIdFromNav?: string | null;
}

declare const FocalBoard: React.FC<FocalBoardProps>;

export default FocalBoard;
