# OpenCode Multi-Tenant Documentation

This document describes the multi-tenant adaptations made to OpenCode.

## Overview

OpenCode has been adapted to support **native multi-tenant isolation** while maintaining compatibility with the original OpenCode tool pattern (`tool({})`).

## Architecture

### Core Components

```
opencode-dev/packages/core/src/
├── auth/multi-tenant-auth.ts    # JWT Authentication with tenant isolation
├── tool-base.ts                 # Base class for multi-tenant tools
└── types.ts                     # TypeScript types

opencode-dev/packages/cli/src/
└── index.ts                     # Multi-tenant CLI

opencode-dev/.opencode/tool/multi-tenant/
├── confirm8-auth.ts             # Multi-tenant Confirm8 Auth
├── rdstation-contacts.ts        # Multi-tenant RD Station Contacts
└── evolution.ts                 # Multi-tenant Evolution API
```

## Authentication System

### JWT Token Structure

```typescript
interface JWTPayload {
  sub: string;        // User ID
  tid: string;        // Tenant ID
  tslug: string;      // Tenant slug
  tname: string;      // Tenant name
  email: string;
  name: string;
  role: string;
  perms: string[];    // Permissions
  iat: number;
  exp: number;
}
```

### Usage

```typescript
import { generateToken, verifyToken, requireAuth } from './auth/multi-tenant-auth.js';

// Generate token on login
const token = await generateToken({
  tenantId: 'tenant-uuid',
  tenantSlug: 'my-company',
  tenantName: 'My Company',
  userId: 'user-uuid',
  email: 'user@company.com',
  name: 'John Doe',
  role: 'admin',
  permissions: ['read', 'write', 'execute']
});

// Verify token and get session
const session = await verifyToken(token);

// Require authentication in API routes
const user = await requireAuth(c); // Throws if not authenticated
```

### Environment Variables

```bash
JWT_SECRET=your-super-secret-key
JWT_EXPIRY=24h
COOKIE_NAME=chatias_session
```

## Multi-Tenant Tool Base

### Creating a Multi-Tenant Tool

```typescript
import { MultiTenantTool } from '../core/tool-base.js';

class MyTool extends MultiTenantTool {
  getDefinition() {
    return {
      id: 'my-tool',
      name: 'My Tool',
      description: 'Does something useful',
      args: {
        action: tool.schema.enum(['action1', 'action2']),
        param1: tool.schema.string()
      }
    };
  }

  getRequiredPermissions(): string[] {
    return ['my-tool:use'];
  }

  async execute(args: Record<string, any>) {
    // Access tenant context
    console.log('Tenant ID:', this.tenantId);
    console.log('User ID:', this.userId);
    
    // Make tenant-aware HTTP request
    const response = await this.httpRequest('POST', '/api/endpoint', { data: args });
    
    return {
      success: true,
      data: response
    };
  }
}

export default new MyTool().createTool();
```

### Automatic Tenant Context

The tool base class automatically:

1. Extracts tenant information from environment variables
2. Injects tenant headers into all HTTP requests
3. Validates permissions before execution
4. Tracks usage (if configured)

## Environment Variables for Tools

```bash
# Tenant Context
CHATIAS_TENANT_ID=tenant-uuid
CHATIAS_TENANT_SLUG=my-company
CHATIAS_USER_ID=user-uuid
CHATIAS_PERMISSIONS=read,write,execute,admin
CHATIAS_API_KEY=sk_xxxxx

# Tool Configuration
CHATIAS_TRACK_USAGE=true
CHATIAS_API_URL=http://localhost:3000
CHATIAS_VERBOSE=false

# Integration APIs
CONFIRM8_BASE_URL=https://api.confirm8.com
CONFIRM8_API_KEY=xxx
RDSTATION_BASE_URL=https://api.rd.services
RDSTATION_API_KEY=xxx
EVOLUTION_BASE_URL=http://localhost:8080
EVOLUTION_INSTANCE=default
```

## CLI Commands

### Authentication

```bash
# Login to a tenant
chatias auth login [tenant]

# Logout
chatias auth logout

# Check status
chatias auth status

# Show current user
chatias auth whoami
```

### Tenant Management

```bash
# Create a new tenant
chatias tenant create

# List all tenants
chatias tenant list

# Set default tenant
chatias tenant use <slug>

# Show tenant info
chatias tenant info [slug]

# Suspend/resume tenant
chatias tenant suspend <slug>
chatias tenant resume <slug>
```

### User Management

```bash
# Create user in current tenant
chatias user create

# List users
chatias user list

# Create API key
chatias user apikey create
```

### Tool Commands

```bash
# List available tools
chatias tool list

# Run a tool
chatias tool run <tool> <action>
```

### Agent Commands

```bash
# List agents
chatias agent list

# Run an agent
chatias agent run <agent>
```

## Multi-Tenant Tool Examples

### Confirm8 Auth

```typescript
import tool from './multi-tenant/confirm8-auth.js';

// Login
await tool({
  action: 'login',
  username: 'user',
  password: 'password'
});

// Get user (automatically uses tenant context)
await tool({
  action: 'getUser'
});
```

### RD Station Contacts

```typescript
import tool from './multi-tenant/rdstation-contacts.js';

// Create contact
await tool({
  action: 'create',
  email: 'contact@company.com',
  name: 'John Doe',
  tags: ['lead', 'marketing']
});

// Search contacts
await tool({
  action: 'search',
  email: 'john@company.com'
});

// List contacts
await tool({
  action: 'list',
  limit: 50,
  page: 1
});
```

### Evolution API (WhatsApp)

```typescript
import tool from './multi-tenant/evolution.js';

// Send text message
await tool({
  action: 'sendText',
  phone: '5511999999999',
  text: 'Hello from ChatIAS!'
});

// Send media
await tool({
  action: 'sendMedia',
  phone: '5511999999999',
  mediaType: 'image',
  media: 'https://example.com/image.jpg',
  caption: 'Check this out!'
});

// Create group
await tool({
  action: 'createGroup',
  name: 'My Group',
  participants: ['5511999999999', '5511888888888']
});
```

## Database Integration

### Prisma Schema

The database schema includes multi-tenant models:

```prisma
model Tenant {
  id        String   @id @default(uuid())
  name      String
  slug      String   @unique
  status    TenantStatus
  plan      TenantPlan
  users     User[]
  // ...
}

model User {
  id        String   @id @default(uuid())
  tenantId  String
  email     String
  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  @@unique([tenantId, email])
}
```

## Best Practices

### 1. Always Use Tenant Context

```typescript
// ❌ Don't do this
const response = await fetch('https://api.example.com/data');

// ✅ Do this
const response = await this.httpRequest('GET', 'https://api.example.com/data');
// Tenant headers are automatically added
```

### 2. Validate Permissions

```typescript
getRequiredPermissions(): string[] {
  return ['my-tool:write'];
}

async execute(args) {
  // Permission checked automatically by base class
}
```

### 3. Track Usage

```bash
# Enable usage tracking
CHATIAS_TRACK_USAGE=true
CHATIAS_API_URL=http://localhost:3000
```

## Migration from Original OpenCode

### Original Tool
```typescript
// Original OpenCode tool
import { tool } from '@opencode-ai/plugin/tool';

export default tool({
  description: 'My tool',
  args: { action: tool.schema.enum(['action1']) },
  async execute(args) {
    return JSON.stringify({ success: true });
  }
});
```

### Multi-Tenant Tool
```typescript
// Multi-tenant adapted tool
import { MultiTenantTool } from '../core/tool-base.js';

class MyTool extends MultiTenantTool {
  getDefinition() {
    return {
      id: 'my-tool',
      name: 'My Tool',
      description: 'My multi-tenant tool',
      args: { action: tool.schema.enum(['action1']) }
    };
  }
  
  async execute(args) {
    return { success: true };
  }
}

export default new MyTool().createTool();
```

## Security

1. **Tenant Isolation**: All requests include tenant headers
2. **Permission Checking**: Tools validate permissions before execution
3. **API Key Management**: Secure storage of API keys per tenant
4. **JWT Tokens**: Secure authentication with expiration

## Performance

- Lightweight JWT verification
- No database queries in hot path
- Configurable timeout and retries
- Connection pooling for HTTP requests