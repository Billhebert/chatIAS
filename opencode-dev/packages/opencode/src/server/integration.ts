/**
 * Integration Routes
 * 
 * Rotas para gerenciamento de credenciais de integrações.
 * Apenas usuários master podem acessar.
 */

import { Hono } from "hono"
import z from "zod"
import { describeRoute, validator } from "hono-openapi"
import { resolver } from "hono-openapi"
import { Integration } from "../integration"
import { User } from "../user"

// Helper para verificar se é master
async function requireMaster(c: any): Promise<{ userId: string } | Response> {
  try {
    const authHeader = c.req.header("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json({ error: "Unauthorized" }, 401)
    }
    
    const token = authHeader.substring(7)
    const user = await User.validateToken(token)
    
    if (!user || user.role !== "master") {
      return c.json({ error: "Forbidden - Master access required" }, 403)
    }
    
    return { userId: user.id }
  } catch {
    return c.json({ error: "Unauthorized" }, 401)
  }
}

export const IntegrationRoute = new Hono()
  // List all integrations
  .get(
    "/",
    describeRoute({
      summary: "List integrations",
      description: "List all configured integrations (master only)",
      operationId: "integration.list",
      tags: ["Integration"],
      responses: {
        200: {
          description: "List of integrations",
          content: {
            "application/json": {
              schema: resolver(z.array(z.object({
                id: z.string(),
                type: Integration.IntegrationType,
                name: z.string(),
                description: z.string(),
                isActive: z.boolean(),
                createdAt: z.number(),
                updatedAt: z.number(),
                credentials: z.array(z.object({
                  key: z.string(),
                  hasValue: z.boolean(),
                })),
              }))),
            },
          },
        },
      },
    }),
    async (c) => {
      const auth = await requireMaster(c)
      if (auth instanceof Response) return auth
      
      const integrations = await Integration.list()
      return c.json(integrations)
    }
  )
  // Get templates
  .get(
    "/templates",
    describeRoute({
      summary: "Get integration templates",
      description: "Get predefined templates for integration types",
      operationId: "integration.templates",
      tags: ["Integration"],
      responses: {
        200: {
          description: "Integration templates",
          content: {
            "application/json": {
              schema: resolver(z.record(z.string(), z.object({
                name: z.string(),
                fields: z.array(z.string()),
              }))),
            },
          },
        },
      },
    }),
    async (c) => {
      const auth = await requireMaster(c)
      if (auth instanceof Response) return auth
      
      return c.json(Integration.Templates)
    }
  )
  // Get single integration
  .get(
    "/:id",
    describeRoute({
      summary: "Get integration",
      description: "Get a specific integration by ID",
      operationId: "integration.get",
      tags: ["Integration"],
      responses: {
        200: {
          description: "Integration details",
          content: {
            "application/json": {
              schema: resolver(Integration.IntegrationCredential),
            },
          },
        },
        404: {
          description: "Integration not found",
        },
      },
    }),
    validator("param", z.object({ id: z.string() })),
    async (c) => {
      const auth = await requireMaster(c)
      if (auth instanceof Response) return auth
      
      const { id } = c.req.valid("param")
      const integration = await Integration.get(id)
      
      if (!integration) {
        return c.json({ error: "Integration not found" }, 404)
      }
      
      return c.json(integration)
    }
  )
  // Create integration
  .post(
    "/",
    describeRoute({
      summary: "Create integration",
      description: "Create a new integration with credentials",
      operationId: "integration.create",
      tags: ["Integration"],
      responses: {
        200: {
          description: "Created integration",
          content: {
            "application/json": {
              schema: resolver(Integration.IntegrationCredential),
            },
          },
        },
      },
    }),
    validator("json", z.object({
      type: Integration.IntegrationType,
      name: z.string().min(2),
      description: z.string().optional(),
      credentials: z.array(z.object({
        key: z.string(),
        value: z.string(),
      })),
    })),
    async (c) => {
      const auth = await requireMaster(c)
      if (auth instanceof Response) return auth
      
      const body = c.req.valid("json")
      const integration = await Integration.create({
        ...body,
        createdBy: auth.userId,
      })
      
      return c.json(integration)
    }
  )
  // Update integration
  .patch(
    "/:id",
    describeRoute({
      summary: "Update integration",
      description: "Update an existing integration",
      operationId: "integration.update",
      tags: ["Integration"],
      responses: {
        200: {
          description: "Updated integration",
          content: {
            "application/json": {
              schema: resolver(Integration.IntegrationCredential),
            },
          },
        },
        404: {
          description: "Integration not found",
        },
      },
    }),
    validator("param", z.object({ id: z.string() })),
    validator("json", z.object({
      name: z.string().min(2).optional(),
      description: z.string().optional(),
      credentials: z.array(z.object({
        key: z.string(),
        value: z.string(),
      })).optional(),
      isActive: z.boolean().optional(),
    })),
    async (c) => {
      const auth = await requireMaster(c)
      if (auth instanceof Response) return auth
      
      const { id } = c.req.valid("param")
      const body = c.req.valid("json")
      
      const integration = await Integration.update(id, body)
      
      if (!integration) {
        return c.json({ error: "Integration not found" }, 404)
      }
      
      return c.json(integration)
    }
  )
  // Delete integration
  .delete(
    "/:id",
    describeRoute({
      summary: "Delete integration",
      description: "Delete an integration",
      operationId: "integration.delete",
      tags: ["Integration"],
      responses: {
        200: {
          description: "Deleted",
          content: {
            "application/json": {
              schema: resolver(z.boolean()),
            },
          },
        },
        404: {
          description: "Integration not found",
        },
      },
    }),
    validator("param", z.object({ id: z.string() })),
    async (c) => {
      const auth = await requireMaster(c)
      if (auth instanceof Response) return auth
      
      const { id } = c.req.valid("param")
      const deleted = await Integration.remove(id)
      
      if (!deleted) {
        return c.json({ error: "Integration not found" }, 404)
      }
      
      return c.json(true)
    }
  )
