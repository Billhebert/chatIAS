import { Hono } from "hono"
import { describeRoute, validator } from "hono-openapi"
import { resolver } from "hono-openapi"
import { User } from "../user"
import z from "zod"
import { errors } from "./error"
import type { Context, Next } from "hono"

// Tipos para o contexto com variáveis customizadas
type AuthVariables = {
  user: User.PublicInfo
  token: string
}

// Middleware para validar token de autenticacao
async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Token de autenticacao nao fornecido" }, 401)
  }

  const token = authHeader.substring(7)
  const user = await User.validateToken(token)
  
  if (!user) {
    return c.json({ error: "Token invalido ou expirado" }, 401)
  }

  c.set("user" as never, user as never)
  c.set("token" as never, token as never)
  await next()
}

// Helper para obter user do contexto
function getUser(c: Context): User.PublicInfo {
  return (c as any).get("user") as User.PublicInfo
}

function getToken(c: Context): string {
  return (c as any).get("token") as string
}

// Rotas publicas (sem autenticacao)
const publicRoutes = new Hono()
  .get(
    "/status",
    describeRoute({
      summary: "Get auth status",
      description: "Check if there are any users registered and get system status.",
      operationId: "user.status",
      responses: {
        200: {
          description: "Auth status",
          content: {
            "application/json": {
              schema: resolver(z.object({
                hasUsers: z.boolean(),
                message: z.string(),
              })),
            },
          },
        },
      },
    }),
    async (c) => {
      const hasUsers = await User.hasUsers()
      return c.json({
        hasUsers,
        message: hasUsers ? "Sistema pronto" : "Nenhum usuario registrado. O primeiro usuario sera Master.",
      })
    },
  )
  .post(
    "/login",
    describeRoute({
      summary: "User login",
      description: "Authenticate a user and get an access token.",
      operationId: "user.login",
      responses: {
        200: {
          description: "Login successful",
          content: {
            "application/json": {
              schema: resolver(z.object({
                user: User.PublicInfo,
                token: z.string(),
              })),
            },
          },
        },
        ...errors(400, 401),
      },
    }),
    validator("json", User.LoginInput),
    async (c) => {
      try {
        const input = c.req.valid("json")
        const result = await User.login(input)
        return c.json(result)
      } catch (err: any) {
        return c.json({ error: err.message }, 401)
      }
    },
  )
  .post(
    "/register",
    describeRoute({
      summary: "User registration",
      description: "Register a new user. The first user becomes Master.",
      operationId: "user.register",
      responses: {
        200: {
          description: "Registration successful",
          content: {
            "application/json": {
              schema: resolver(z.object({
                user: User.PublicInfo,
                token: z.string(),
              })),
            },
          },
        },
        ...errors(400),
      },
    }),
    validator("json", User.RegisterInput),
    async (c) => {
      try {
        const input = c.req.valid("json")
        const result = await User.register(input)
        return c.json(result)
      } catch (err: any) {
        return c.json({ error: err.message }, 400)
      }
    },
  )
  .get(
    "/users/public",
    describeRoute({
      summary: "List users (public)",
      description: "Get a list of all users (username and role only) for the login screen.",
      operationId: "user.listPublic",
      responses: {
        200: {
          description: "List of users",
          content: {
            "application/json": {
              schema: resolver(z.array(z.object({
                id: z.string(),
                username: z.string(),
                role: User.Role,
              }))),
            },
          },
        },
      },
    }),
    async (c) => {
      const users = await User.list()
      return c.json(users.map(u => ({
        id: u.id,
        username: u.username,
        role: u.role,
      })))
    },
  )

// Rotas protegidas (requerem autenticacao)
const protectedRoutes = new Hono()
  .use(authMiddleware)
  .post(
    "/logout",
    describeRoute({
      summary: "User logout",
      description: "Invalidate the current access token.",
      operationId: "user.logout",
      responses: {
        200: {
          description: "Logout successful",
          content: {
            "application/json": {
              schema: resolver(z.object({ success: z.boolean() })),
            },
          },
        },
      },
    }),
    async (c) => {
      const token = getToken(c)
      await User.logout(token)
      return c.json({ success: true })
    },
  )
  .get(
    "/me",
    describeRoute({
      summary: "Get current user",
      description: "Get the currently authenticated user's information.",
      operationId: "user.me",
      responses: {
        200: {
          description: "Current user",
          content: {
            "application/json": {
              schema: resolver(User.PublicInfo),
            },
          },
        },
        ...errors(401),
      },
    }),
    async (c) => {
      const user = getUser(c)
      return c.json(user)
    },
  )
  .get(
    "/me/permissions",
    describeRoute({
      summary: "Get current user permissions",
      description: "Get the permissions for the currently authenticated user.",
      operationId: "user.myPermissions",
      responses: {
        200: {
          description: "User permissions",
          content: {
            "application/json": {
              schema: resolver(User.Permissions),
            },
          },
        },
        ...errors(401),
      },
    }),
    async (c) => {
      const user = getUser(c)
      const permissions = await User.getUserPermissions(user.id)
      return c.json(permissions)
    },
  )
  .patch(
    "/me/settings",
    describeRoute({
      summary: "Update current user settings",
      description: "Update the settings for the currently authenticated user.",
      operationId: "user.updateMySettings",
      responses: {
        200: {
          description: "Updated user",
          content: {
            "application/json": {
              schema: resolver(User.PublicInfo),
            },
          },
        },
        ...errors(400, 401),
      },
    }),
    validator("json", User.Settings.partial()),
    async (c) => {
      try {
        const user = getUser(c)
        const settings = c.req.valid("json")
        const updatedUser = await User.update(user.id, { settings }, user.id)
        return c.json(updatedUser)
      } catch (err: any) {
        return c.json({ error: err.message }, 400)
      }
    },
  )

  // ==================== CRUD DE USUARIOS ====================
  .get(
    "/users",
    describeRoute({
      summary: "List all users",
      description: "Get a list of all users (admin only).",
      operationId: "user.list",
      responses: {
        200: {
          description: "List of users",
          content: {
            "application/json": {
              schema: resolver(User.PublicInfo.array()),
            },
          },
        },
        ...errors(401, 403),
      },
    }),
    async (c) => {
      const user = getUser(c)
      if (user.role !== "master" && user.role !== "admin") {
        return c.json({ error: "Sem permissao" }, 403)
      }
      const users = await User.list()
      return c.json(users)
    },
  )
  .get(
    "/users/:userId",
    describeRoute({
      summary: "Get user by ID",
      description: "Get a specific user's information (admin only).",
      operationId: "user.get",
      responses: {
        200: {
          description: "User info",
          content: {
            "application/json": {
              schema: resolver(User.PublicInfo),
            },
          },
        },
        ...errors(401, 403, 404),
      },
    }),
    validator("param", z.object({ userId: z.string() })),
    async (c) => {
      const actor = getUser(c)
      const { userId } = c.req.valid("param")
      
      // Usuario pode ver seus proprios dados
      if (userId !== actor.id && actor.role !== "master" && actor.role !== "admin") {
        return c.json({ error: "Sem permissao" }, 403)
      }
      
      const user = await User.get(userId)
      if (!user) {
        return c.json({ error: "Usuario nao encontrado" }, 404)
      }
      return c.json(user)
    },
  )
  .post(
    "/users",
    describeRoute({
      summary: "Create user",
      description: "Create a new user (admin only).",
      operationId: "user.create",
      responses: {
        200: {
          description: "Created user",
          content: {
            "application/json": {
              schema: resolver(User.PublicInfo),
            },
          },
        },
        ...errors(400, 401, 403),
      },
    }),
    validator("json", User.CreateUserInput),
    async (c) => {
      try {
        const actor = getUser(c)
        const input = c.req.valid("json")
        const user = await User.create(input, actor.id)
        return c.json(user)
      } catch (err: any) {
        return c.json({ error: err.message }, 400)
      }
    },
  )
  .patch(
    "/users/:userId",
    describeRoute({
      summary: "Update user",
      description: "Update a user's information (admin only).",
      operationId: "user.update",
      responses: {
        200: {
          description: "Updated user",
          content: {
            "application/json": {
              schema: resolver(User.PublicInfo),
            },
          },
        },
        ...errors(400, 401, 403, 404),
      },
    }),
    validator("param", z.object({ userId: z.string() })),
    validator("json", User.UpdateUserInput),
    async (c) => {
      try {
        const actor = getUser(c)
        const { userId } = c.req.valid("param")
        const input = c.req.valid("json")
        const user = await User.update(userId, input, actor.id)
        return c.json(user)
      } catch (err: any) {
        return c.json({ error: err.message }, 400)
      }
    },
  )
  .delete(
    "/users/:userId",
    describeRoute({
      summary: "Delete user",
      description: "Delete a user (admin only).",
      operationId: "user.delete",
      responses: {
        200: {
          description: "User deleted",
          content: {
            "application/json": {
              schema: resolver(z.object({ success: z.boolean() })),
            },
          },
        },
        ...errors(400, 401, 403, 404),
      },
    }),
    validator("param", z.object({ userId: z.string() })),
    async (c) => {
      try {
        const actor = getUser(c)
        const { userId } = c.req.valid("param")
        await User.remove(userId, actor.id)
        return c.json({ success: true })
      } catch (err: any) {
        return c.json({ error: err.message }, 400)
      }
    },
  )
  .post(
    "/users/:userId/reset-password",
    describeRoute({
      summary: "Reset user password",
      description: "Reset a user's password (admin only).",
      operationId: "user.resetPassword",
      responses: {
        200: {
          description: "Password reset",
          content: {
            "application/json": {
              schema: resolver(z.object({ success: z.boolean() })),
            },
          },
        },
        ...errors(400, 401, 403, 404),
      },
    }),
    validator("param", z.object({ userId: z.string() })),
    validator("json", z.object({ newPassword: z.string().min(4) })),
    async (c) => {
      try {
        const actor = getUser(c)
        const { userId } = c.req.valid("param")
        const { newPassword } = c.req.valid("json")
        await User.resetPassword(userId, newPassword, actor.id)
        return c.json({ success: true })
      } catch (err: any) {
        return c.json({ error: err.message }, 400)
      }
    },
  )
  .post(
    "/users/:userId/activate",
    describeRoute({
      summary: "Activate user",
      description: "Activate a user account (master only).",
      operationId: "user.activate",
      responses: {
        200: {
          description: "User activated",
          content: {
            "application/json": {
              schema: resolver(User.PublicInfo),
            },
          },
        },
        ...errors(400, 401, 403, 404),
      },
    }),
    validator("param", z.object({ userId: z.string() })),
    async (c) => {
      try {
        const actor = getUser(c)
        if (actor.role !== "master") {
          return c.json({ error: "Apenas o Master pode ativar usuarios" }, 403)
        }
        const { userId } = c.req.valid("param")
        const user = await User.update(userId, { isActive: true }, actor.id)
        return c.json(user)
      } catch (err: any) {
        return c.json({ error: err.message }, 400)
      }
    },
  )
  .post(
    "/users/:userId/deactivate",
    describeRoute({
      summary: "Deactivate user",
      description: "Deactivate a user account (master only).",
      operationId: "user.deactivate",
      responses: {
        200: {
          description: "User deactivated",
          content: {
            "application/json": {
              schema: resolver(User.PublicInfo),
            },
          },
        },
        ...errors(400, 401, 403, 404),
      },
    }),
    validator("param", z.object({ userId: z.string() })),
    async (c) => {
      try {
        const actor = getUser(c)
        if (actor.role !== "master") {
          return c.json({ error: "Apenas o Master pode desativar usuarios" }, 403)
        }
        const { userId } = c.req.valid("param")
        
        // Nao pode desativar a si mesmo
        if (userId === actor.id) {
          return c.json({ error: "Nao pode desativar a si mesmo" }, 400)
        }
        
        const user = await User.update(userId, { isActive: false }, actor.id)
        return c.json(user)
      } catch (err: any) {
        return c.json({ error: err.message }, 400)
      }
    },
  )

  // ==================== CRUD DE NIVEIS DE ACESSO ====================
  .get(
    "/access-levels",
    describeRoute({
      summary: "List access levels",
      description: "Get a list of all access levels.",
      operationId: "accessLevel.list",
      responses: {
        200: {
          description: "List of access levels",
          content: {
            "application/json": {
              schema: resolver(User.AccessLevel.array()),
            },
          },
        },
        ...errors(401),
      },
    }),
    async (c) => {
      const levels = await User.listAccessLevels()
      return c.json(levels)
    },
  )
  .get(
    "/access-levels/:id",
    describeRoute({
      summary: "Get access level",
      description: "Get a specific access level by ID.",
      operationId: "accessLevel.get",
      responses: {
        200: {
          description: "Access level",
          content: {
            "application/json": {
              schema: resolver(User.AccessLevel),
            },
          },
        },
        ...errors(401, 404),
      },
    }),
    validator("param", z.object({ id: z.string() })),
    async (c) => {
      const { id } = c.req.valid("param")
      const level = await User.getAccessLevel(id)
      if (!level) {
        return c.json({ error: "Nivel de acesso nao encontrado" }, 404)
      }
      return c.json(level)
    },
  )
  .post(
    "/access-levels",
    describeRoute({
      summary: "Create access level",
      description: "Create a new access level (master only).",
      operationId: "accessLevel.create",
      responses: {
        200: {
          description: "Created access level",
          content: {
            "application/json": {
              schema: resolver(User.AccessLevel),
            },
          },
        },
        ...errors(400, 401, 403),
      },
    }),
    validator("json", User.CreateAccessLevelInput),
    async (c) => {
      try {
        const actor = getUser(c)
        const input = c.req.valid("json")
        const level = await User.createAccessLevel(input, actor.id)
        return c.json(level)
      } catch (err: any) {
        return c.json({ error: err.message }, 400)
      }
    },
  )
  .patch(
    "/access-levels/:id",
    describeRoute({
      summary: "Update access level",
      description: "Update an access level (master only).",
      operationId: "accessLevel.update",
      responses: {
        200: {
          description: "Updated access level",
          content: {
            "application/json": {
              schema: resolver(User.AccessLevel),
            },
          },
        },
        ...errors(400, 401, 403, 404),
      },
    }),
    validator("param", z.object({ id: z.string() })),
    validator("json", User.UpdateAccessLevelInput),
    async (c) => {
      try {
        const actor = getUser(c)
        const { id } = c.req.valid("param")
        const input = c.req.valid("json")
        const level = await User.updateAccessLevel(id, input, actor.id)
        return c.json(level)
      } catch (err: any) {
        return c.json({ error: err.message }, 400)
      }
    },
  )
  .delete(
    "/access-levels/:id",
    describeRoute({
      summary: "Delete access level",
      description: "Delete an access level (master only).",
      operationId: "accessLevel.delete",
      responses: {
        200: {
          description: "Access level deleted",
          content: {
            "application/json": {
              schema: resolver(z.object({ success: z.boolean() })),
            },
          },
        },
        ...errors(400, 401, 403, 404),
      },
    }),
    validator("param", z.object({ id: z.string() })),
    async (c) => {
      try {
        const actor = getUser(c)
        const { id } = c.req.valid("param")
        await User.removeAccessLevel(id, actor.id)
        return c.json({ success: true })
      } catch (err: any) {
        return c.json({ error: err.message }, 400)
      }
    },
  )

// Combinar rotas
export const UserRoute = new Hono()
  .route("/", publicRoutes)
  .route("/", protectedRoutes)
