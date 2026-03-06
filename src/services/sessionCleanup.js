// Check for malformed session data
export const checkSessionData = () => {
  console.log('🔍 SessionCheck: Analyzing session data...');
  
  const sessionInfo = {
    localStorage: {},
    sessionStorage: {}
  };
  
  // Check localStorage for Supabase session data
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.includes('supabase') || key.includes('delta-auth'))) {
      try {
        const value = localStorage.getItem(key);
        sessionInfo.localStorage[key] = {
          value: value ? (value.length > 100 ? value.substring(0, 100) + '...' : value) : 'null',
          isJson: value ? (value.startsWith('{') || value.startsWith('[')) : false,
          size: value ? value.length : 0
        };
      } catch (error) {
        console.error('🔍 SessionCheck: Error reading localStorage key:', key, error);
        sessionInfo.localStorage[key] = { error: error.message };
      }
    }
  }
  
  // Check sessionStorage for Supabase session data
  if (sessionStorage) {
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && (key.includes('supabase') || key.includes('delta-auth'))) {
        try {
          const value = sessionStorage.getItem(key);
          sessionInfo.sessionStorage[key] = {
            value: value ? (value.length > 100 ? value.substring(0, 100) + '...' : value) : 'null',
            isJson: value ? (value.startsWith('{') || value.startsWith('[')) : false,
            size: value ? value.length : 0
          };
        } catch (error) {
          console.error('🔍 SessionCheck: Error reading sessionStorage key:', key, error);
          sessionInfo.sessionStorage[key] = { error: error.message };
        }
      }
    }
  }
  
  console.log('🔍 SessionCheck: Session data analysis:', sessionInfo);
  return sessionInfo;
};

// Clear corrupted Supabase session
export const clearCorruptedSession = () => {
  console.log('🧹 Clearing all Supabase session data...');
  
  // Clear all Supabase-related localStorage items
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.includes('supabase') || key.includes('delta-auth'))) {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach(key => {
    console.log('🗑️ Removing key:', key);
    localStorage.removeItem(key);
  });
  
  console.log('🧹 Cleared corrupted session data:', keysToRemove.length, 'items');
  
  // Also clear session storage
  if (sessionStorage) {
    const sessionKeysToRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && (key.includes('supabase') || key.includes('delta-auth'))) {
        sessionKeysToRemove.push(key);
      }
    }
    
    sessionKeysToRemove.forEach(key => {
      console.log('🗑️ Removing session key:', key);
      sessionStorage.removeItem(key);
    });
    
    console.log('🧹 Cleared session storage data:', sessionKeysToRemove.length, 'items');
  }
};

export default clearCorruptedSession;
