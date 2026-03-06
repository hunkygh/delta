import { useState, useEffect, useCallback } from 'react';
import focalBoardService from '../services/focalBoardService';

export const useFocalBoard = (userId) => {
  const [focals, setFocals] = useState([]);
  const [selectedFocal, setSelectedFocal] = useState(null);
  const [lanes, setLanes] = useState([]);
  const [items, setItems] = useState([]);
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load focals
  const loadFocals = useCallback(async () => {
    if (!userId) {
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const data = await focalBoardService.getFocals(userId);
      setFocals(data);
    } catch (err) {
      console.error('Failed to load focals:', err);
      // Check if it's a "relation does not exist" error (tables not created yet)
      if (err.message && err.message.includes('relation') && err.message.includes('does not exist')) {
        setError('Database tables not created yet. Please run the schema.sql script in Supabase SQL editor.');
      } else {
        setError(err.message || 'Failed to load focals');
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Load focal data (lanes, items, actions)
  const loadFocalData = useCallback(async (focalId) => {
    if (!focalId) return;

    setLoading(true);
    setError(null);
    try {
      const data = await focalBoardService.getFullFocalData(focalId);
      setLanes(data);
      
      // Flatten items and actions for easier access
      const allItems = [];
      const allActions = [];
      
      if (data && Array.isArray(data)) {
        data.forEach(lane => {
          if (lane.items) {
            lane.items.forEach(item => {
              allItems.push(item);
              if (item.actions) {
                allActions.push(...item.actions);
              }
            });
          }
        });
      }
      
      setItems(allItems);
      setActions(allActions);
    } catch (err) {
      console.error('Failed to load focal data:', err);
      if (!err.message?.includes('does not exist') && !err.message?.includes('timeout')) {
        setError(err.message);
      } else {
        setLanes([]);
        setItems([]);
        setActions([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Create focal
  const createFocal = useCallback(async (name) => {
    if (!userId) return;
    
    try {
      const newFocal = await focalBoardService.createFocal(userId, name);
      setFocals(prev => [...prev, newFocal]);
      return newFocal;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [userId]);

  // Create lane
  const createLane = useCallback(async (focalId, name, itemLabel = null, actionLabel = null) => {
    if (!userId) {
      return;
    }
    
    try {
      const newLane = await focalBoardService.createLane(focalId, userId, name, itemLabel, actionLabel);
      setLanes(prev => [...prev, newLane]);
      return newLane;
    } catch (err) {
      console.error('Lane creation failed:', err);
      
      // Check if it's a "table does not exist" error
      if (err.message && err.message.includes('does not exist')) {
        setError('Database tables not created yet. Please run the schema.sql script in Supabase SQL editor to create lanes, items, and actions tables.');
      } else {
        setError(err.message || 'Failed to create lane');
      }
      throw err;
    }
  }, [userId]);

  const updateLane = useCallback(async (id, updates) => {
    try {
      const updatedLane = await focalBoardService.updateLane(id, updates);
      setLanes(prev => prev.map(lane => (lane.id === id ? { ...lane, ...updatedLane } : lane)));
      return updatedLane;
    } catch (err) {
      setError(err.message || 'Failed to update lane');
      throw err;
    }
  }, []);

  // Create item
  const createItem = useCallback(async (laneId, title, description = '') => {
    if (!userId) {
      return;
    }
    
    try {
      const newItem = await focalBoardService.createItem(laneId, userId, title, description);
      setItems(prev => [...prev, newItem]);
      return newItem;
    } catch (err) {
      console.error('Item creation failed:', err);
      
      // Check if it's a "table does not exist" error
      if (err.message && err.message.includes('does not exist')) {
        setError('Database tables not created yet. Please run the schema.sql script in Supabase SQL editor to create items and actions tables.');
      } else {
        setError(err.message || 'Failed to create item');
      }
      throw err;
    }
  }, [userId]);

  // Create action
  const createAction = useCallback(async (itemId, title, description = '') => {
    if (!userId) return;
    
    try {
      const newAction = await focalBoardService.createAction(itemId, userId, title, description, null);
      setActions(prev => [...prev, newAction]);
      return newAction;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [userId]);

  // Update functions
  const updateItem = useCallback(async (id, updates) => {
    try {
      const updatedItem = await focalBoardService.updateItem(id, updates);
      setItems(prev => prev.map(item => 
        item.id === id ? { ...item, ...updatedItem } : item
      ));
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const updateAction = useCallback(async (id, updates) => {
    try {
      const updatedAction = await focalBoardService.updateAction(id, updates);
      setActions(prev => prev.map(action => 
        action.id === id ? { ...action, ...updatedAction } : action
      ));
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Delete functions
  const deleteLane = useCallback(async (id) => {
    try {
      await focalBoardService.deleteLane(id);
      setLanes(prev => prev.filter(lane => lane.id !== id));
      // Remove associated items and actions
      setItems(prev => prev.filter(item => item.lane_id !== id));
      setActions(prev => prev.filter(action => {
        const item = items.find(i => i.id === action.item_id);
        return item?.lane_id !== id;
      }));
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [items]);

  const deleteItem = useCallback(async (id) => {
    try {
      await focalBoardService.deleteItem(id);
      setItems(prev => prev.filter(item => item.id !== id));
      // Remove associated actions
      setActions(prev => prev.filter(action => action.item_id !== id));
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const deleteAction = useCallback(async (id) => {
    try {
      await focalBoardService.deleteAction(id);
      setActions(prev => prev.filter(action => action.id !== id));
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Select focal
  const selectFocal = useCallback((focal) => {
    setSelectedFocal(focal);
    if (focal) {
      // Try to load focal data, but don't fail if lanes don't exist yet
      setLoading(false); // Reset loading state first
      loadFocalData(focal.id).catch(err => {
        setLanes([]);
        setItems([]);
        setActions([]);
      });
    } else {
      setLanes([]);
      setItems([]);
      setActions([]);
    }
  }, []);

  // Initialize
  useEffect(() => {
    loadFocals();
  }, [loadFocals]);

  return {
    // Data
    focals,
    selectedFocal,
    lanes,
    items,
    actions,
    loading,
    error,
    
    // Actions
    loadFocals,
    loadFocalData,
    createFocal,
    createLane,
    updateLane,
    createItem,
    createAction,
    updateItem,
    updateAction,
    deleteLane,
    deleteItem,
    deleteAction,
    selectFocal,
    
    // Utilities
    clearError: () => setError(null)
  };
};
