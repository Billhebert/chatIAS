# ChatIAS 3.0 Multi-Tenant Examples

This directory contains examples demonstrating how to use the ChatIAS 3.0 platform in a multi-tenant context.

## Quick Start

```bash
# Install dependencies
cd packages/core && bun install
cd ../integrations && bun install
cd ../database && bun install

# Generate Prisma client
cd packages/database && bun run db:generate

# Build all packages
cd packages/core && bun run build
cd ../integrations && bun run build
cd ../database && bun run build

# Run examples
cd ../../examples
bun run multi-tenant-usage.ts
```

## Available Examples

### 1. Basic Multi-Tenant Setup (`multi-tenant-usage.ts`)

Demonstrates core multi-tenant functionality:
- Creating a tenant
- Creating users within a tenant
- Managing tenant context
- System lifecycle (create, use, destroy)

```typescript
import { createSystem } from '@chatias/core';

const system = await createSystem({ enableMultiTenant: true });

const tenant = await system.createTenant({
  name: 'Acme Corporation',
  slug: 'acme',
  plan: 'professional'
});

const user = await system.createUser({
  email: 'admin@acme.com',
  name: 'John Doe',
  role: 'admin'
});
```

### 2. Tenant Registry Operations

The `TenantRegistry` class provides complete tenant management:
- Create, read, update, delete tenants
- List tenants with filtering
- User management per tenant
- Usage tracking and limits

```typescript
import { createTenantRegistry } from '@chatias/core';

const registry = createTenantRegistry();

const tenant = await registry.createTenant({
  name: 'Tech Startup',
  slug: 'tech-startup',
  plan: 'starter'
});

const users = await registry.createUser(tenant.id, {
  email: 'user@techstartup.com',
  name: 'Alice',
  role: 'developer'
});
```

### 3. Tenant Isolation

Each tenant operates in complete isolation:
- Separate user databases
- Independent usage tracking
- Independent API call limits
- Independent storage limits

```typescript
// Two separate registries = two isolated tenants
const registry1 = createTenantRegistry();
const registry2 = createTenantRegistry();

// Data is completely separate
registry1.listTenantUsers(tenant1.id); // Only tenant1's users
registry2.listTenantUsers(tenant2.id); // Only tenant2's users
```

### 4. Plan-Based Limits

Different plans have different limits:

| Feature | Free | Starter | Professional | Enterprise |
|---------|------|---------|--------------|------------|
| Users | 2 | 5 | 25 | Unlimited |
| API Calls | 1,000/mo | 10,000/mo | 100,000/mo | Unlimited |
| Storage | 100MB | 1GB | 10GB | Unlimited |
| Advanced Analytics | No | No | Yes | Yes |
| SSO | No | No | Yes | Yes |

### 5. API Key Management

Create and manage API keys for programmatic access:

```typescript
const { apiKey, prefix } = await registry.createApiKey(user.id, {
  name: 'Production Key',
  permissions: ['read', 'write', 'execute'],
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
});

// Validate API key
const validated = await registry.validateApiKey(apiKey);
```

### 6. Complete Workflow

A full example showing:
1. System initialization
2. Tenant creation
3. User creation
4. Context management
5. System cleanup

## Project Structure

```
chatIAS/
├── packages/
│   ├── core/              # Core engine with multi-tenant support
│   │   └── src/
│   │       ├── types/     # TypeScript types
│   │       ├── base/      # Base classes
│   │       ├── multi-tenant.ts    # Multi-tenant system
│   │       └── system-loader.ts   # System bootstrap
│   │
│   ├── integrations/      # Native integrations
│   │   ├── evolution/     # WhatsApp Business API
│   │   ├── rdstation/     # RD Station CRM
│   │   └── confirm8/      # Confirm8 Business Management
│   │
│   ├── database/          # Database layer with Prisma
│   │   ├── prisma/
│   │   │   └── schema.prisma    # Database schema
│   │   └── src/
│   │       └── index.ts   # Repositories
│   │
│   └── tools/             # Tool implementations
│       ├── file/          # File operations
│       └── system/        # System commands
│
├── opencode-dev/          # OpenCode adaptations
│   ├── packages/
│   │   ├── core/          # Core multi-tenant
│   │   └── cli/           # CLI application
│   └── .opencode/
│       └── tool/multi-tenant/  # Tools adapted
│
└── examples/              # Examples
    └── multi-tenant-usage.ts   # Comprehensive examples
```

## Next Steps

- Check out [Integration Examples](../packages/integrations/examples/) for using Evolution, RD Station, and Confirm8
- See [CLI Usage](../opencode-dev/packages/cli/) for command-line interface
- Read the [API Documentation](../packages/core/README.md) for detailed API reference

## Getting Help

- Open an issue on GitHub
- Check the [documentation](../packages/core/README.md)
- Review existing examples in this directory
