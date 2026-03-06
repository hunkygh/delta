# Delta App - Reference Information

## ⚠️ IMPORTANT: Supabase Cloud Configuration

### 📍 Location of Complete Configuration
- **Primary Config**: `src/config/supabase-config.js`
- **Reference**: This document contains summary only
- **Always Use**: Import from `src/config/supabase-config.js`

### Quick Reference
- **Instance**: Cloud (NOT local)
- **URL**: `https://eewzlwfmbhtoyeltxtaj.supabase.co`
- **Status**: Configured for cloud instance only

---

## Implementation

### Frontend Usage
```javascript
import { supabaseUrl, supabaseAnonKey, verifyCloudConfig } from '../config/supabase-config.js';

// Verify cloud configuration
verifyCloudConfig();

// Initialize Supabase
import { createClient } from '@supabase/supabase-js';
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

### Backend Usage
```javascript
import { databaseUrl, verifyCloudConfig } from '../config/supabase-config.js';

// Verify cloud configuration
verifyCloudConfig();

// Database connection
import { Pool } from 'pg';
const pool = new Pool({
  connectionString: databaseUrl,
});
```

---

## Security Notes

- **Config Directory**: Protected by .gitignore
- **Never Commit**: Configuration files excluded from version control
- **Cloud Only**: Always verify cloud instance usage
- **Reference**: Use this document for quick reference only

---

*For complete Supabase configuration, see: src/config/supabase-config.js*
