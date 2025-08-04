# 👥 User System Plan

## 🎯 Цель: Система ролей и управления пользователями

Создать гибкую систему пользователей с ролями **Admin** (полный доступ) и **Editor** (только загрузка файлов).

## 🔍 Текущее состояние

### **Что есть сейчас:**
```typescript
// NextAuth.js базовая авторизация
// Только проверка "авторизован/не авторизован"
// Нет ролей, нет управления пользователями
```

### **Проблемы:**
- ❌ Все авторизованные пользователи имеют полный доступ
- ❌ Нет разграничения прав доступа
- ❌ Нет управления пользователями
- ❌ Нет аудита действий пользователей

## 🎯 Новая система ролей

### **Роли и права доступа:**

#### **🔑 Admin (Администратор)**
- ✅ **Управление пользователями**: создание, редактирование, удаление
- ✅ **Настройки системы**: температура, лимиты, параметры RAG
- ✅ **Загрузка файлов**: полный доступ к файловой системе  
- ✅ **Просмотр аналитики**: статистика, логи, мониторинг
- ✅ **Системные операции**: backup, миграции, очистка

#### **📝 Editor (Редактор)**
- ✅ **Загрузка файлов**: может добавлять документы в базу знаний
- ✅ **Просмотр своих загрузок**: история своих файлов
- ❌ **Настройки системы**: не доступны
- ❌ **Управление пользователями**: не доступно
- ❌ **Системная аналитика**: не доступна

#### **👤 User (Обычный пользователь) - будущее**
- ✅ **Чат**: может задавать вопросы RAG системе
- ❌ **Загрузка файлов**: не доступна
- ❌ **Админ-панель**: не доступна

## 📋 План реализации

### **Phase 1: Расширение схемы базы данных (1 день)**

#### 1.1 Таблица пользователей с ролями
```sql
-- Расширяем существующую таблицу users или создаем новую
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Основная информация
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE,
  password_hash TEXT,                    -- Для локальной авторизации
  
  -- Роли и права
  role TEXT NOT NULL DEFAULT 'editor',   -- 'admin', 'editor', 'user'
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'inactive', 'suspended'
  
  -- OAuth данные (NextAuth.js)
  provider TEXT,                         -- 'google', 'github', 'credentials'
  provider_id TEXT,                      -- ID от OAuth провайдера
  
  -- Персональные данные  
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  
  -- Метаданные
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login_at DATETIME,
  
  -- Аудит
  created_by INTEGER REFERENCES users(id), -- Кто создал пользователя
  updated_by INTEGER REFERENCES users(id)  -- Кто последний раз обновлял
);

-- Индексы
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE UNIQUE INDEX idx_users_provider ON users(provider, provider_id);
```

#### 1.2 Таблица сессий и аудита
```sql
-- Расширенные сессии для трекинга
CREATE TABLE user_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  session_token TEXT UNIQUE NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Аудит действий пользователей
CREATE TABLE user_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,             -- 'file_upload', 'settings_change', 'user_create', etc.
  resource_type TEXT,                    -- 'file', 'user', 'settings'
  resource_id TEXT,                      -- ID ресурса  
  action_details TEXT,                   -- JSON с деталями действия
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_actions_user ON user_actions(user_id);
CREATE INDEX idx_user_actions_type ON user_actions(action_type);
CREATE INDEX idx_user_actions_date ON user_actions(created_at);
```

#### 1.3 Таблица разрешений (для будущего расширения)
```sql
-- Гибкая система разрешений
CREATE TABLE permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,             -- 'files.upload', 'users.create', 'settings.edit'
  description TEXT,
  resource TEXT,                         -- 'files', 'users', 'settings'
  action TEXT                            -- 'create', 'read', 'update', 'delete'
);

-- Связь ролей с разрешениями
CREATE TABLE role_permissions (
  role TEXT NOT NULL,                    -- 'admin', 'editor', 'user'
  permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role, permission_id)
);

-- Базовые разрешения
INSERT INTO permissions (name, description, resource, action) VALUES
('files.upload', 'Upload files to knowledge base', 'files', 'create'),
('files.view', 'View uploaded files', 'files', 'read'),
('files.delete', 'Delete files from knowledge base', 'files', 'delete'),
('users.create', 'Create new users', 'users', 'create'),
('users.manage', 'Manage existing users', 'users', 'update'),
('users.delete', 'Delete users', 'users', 'delete'),
('settings.view', 'View system settings', 'settings', 'read'),
('settings.edit', 'Edit system settings', 'settings', 'update'),
('analytics.view', 'View system analytics', 'analytics', 'read');

-- Разрешения для Admin
INSERT INTO role_permissions (role, permission_id) VALUES
('admin', 1), ('admin', 2), ('admin', 3), ('admin', 4), ('admin', 5), 
('admin', 6), ('admin', 7), ('admin', 8), ('admin', 9);

-- Разрешения для Editor  
INSERT INTO role_permissions (role, permission_id) VALUES
('editor', 1), ('editor', 2);
```

### **Phase 2: Обновление NextAuth.js конфигурации (1-2 дня)**

#### 2.1 Расширенная конфигурация NextAuth
```typescript
// src/lib/auth.ts
import NextAuth, { DefaultSession } from "next-auth"
import { JWT } from "next-auth/jwt"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import { getUserByEmail, createUser, updateUserLastLogin } from "./user-service"

// Расширяем типы NextAuth
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string
      role: string
      status: string
      permissions: string[]
    } & DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: string
    status: string
    permissions: string[]
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        
        const user = await authenticateUser(
          credentials.email as string, 
          credentials.password as string
        )
        
        return user
      }
    })
  ],
  
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        // При входе через Google создаем или находим пользователя
        let dbUser = await getUserByEmail(user.email!)
        
        if (!dbUser) {
          // Создаем нового пользователя с ролью editor по умолчанию
          dbUser = await createUser({
            email: user.email!,
            username: user.name,
            first_name: profile?.given_name,
            last_name: profile?.family_name,
            avatar_url: user.image,
            provider: 'google',
            provider_id: account.providerAccountId,
            role: 'editor' // По умолчанию все новые пользователи - редакторы
          })
        }
        
        // Проверяем статус пользователя
        if (dbUser.status !== 'active') {
          return false // Заблокированный пользователь не может войти
        }
        
        return true
      }
      
      return true
    },
    
    async jwt({ token, user, account }) {
      if (user) {
        const dbUser = await getUserByEmail(user.email!)
        if (dbUser) {
          token.id = dbUser.id.toString()
          token.role = dbUser.role
          token.status = dbUser.status
          token.permissions = await getUserPermissions(dbUser.role)
          
          // Обновляем время последнего входа
          await updateUserLastLogin(dbUser.id)
        }
      }
      
      return token
    },
    
    async session({ session, token }) {
      session.user.id = token.id
      session.user.role = token.role
      session.user.status = token.status
      session.user.permissions = token.permissions
      
      return session
    }
  },
  
  pages: {
    signIn: '/admin/login',
    error: '/admin/auth/error',
  }
})

// Утилиты для работы с пользователями
async function getUserPermissions(role: string): Promise<string[]> {
  const db = await database
  const permissions = await db.all(`
    SELECT p.name 
    FROM permissions p
    JOIN role_permissions rp ON p.id = rp.permission_id
    WHERE rp.role = ?
  `, [role])
  
  return permissions.map(p => p.name)
}
```

#### 2.2 Сервис для работы с пользователями
```typescript
// src/lib/user-service.ts
import bcrypt from 'bcryptjs'
import { database } from './database'

export interface CreateUserData {
  email: string
  username?: string
  password?: string
  first_name?: string
  last_name?: string
  avatar_url?: string
  provider?: string
  provider_id?: string
  role?: string
  created_by?: number
}

export async function createUser(data: CreateUserData) {
  const db = await database
  
  const passwordHash = data.password 
    ? await bcrypt.hash(data.password, 12)
    : null
  
  const result = await db.run(`
    INSERT INTO users (
      email, username, password_hash, first_name, last_name, 
      avatar_url, provider, provider_id, role, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    data.email,
    data.username,
    passwordHash,
    data.first_name,
    data.last_name,
    data.avatar_url,
    data.provider,
    data.provider_id,
    data.role || 'editor',
    data.created_by
  ])
  
  const user = await getUserById(result.lastID as number)
  
  // Логируем создание пользователя
  await logUserAction(data.created_by || null, 'user_create', 'user', user.id.toString(), {
    email: data.email,
    role: data.role || 'editor'
  })
  
  return user
}

export async function getUserByEmail(email: string) {
  const db = await database
  return await db.get('SELECT * FROM users WHERE email = ? AND status = "active"', [email])
}

export async function getUserById(id: number) {
  const db = await database
  return await db.get('SELECT * FROM users WHERE id = ?', [id])
}

export async function updateUserRole(userId: number, newRole: string, updatedBy: number) {
  const db = await database
  
  await db.run(`
    UPDATE users 
    SET role = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `, [newRole, updatedBy, userId])
  
  await logUserAction(updatedBy, 'role_change', 'user', userId.toString(), {
    new_role: newRole
  })
}

export async function authenticateUser(email: string, password: string) {
  const user = await getUserByEmail(email)
  if (!user || !user.password_hash) return null
  
  const isValid = await bcrypt.compare(password, user.password_hash)
  if (!isValid) return null
  
  return {
    id: user.id.toString(),
    email: user.email,
    name: `${user.first_name} ${user.last_name}`.trim() || user.username,
    image: user.avatar_url
  }
}

export async function logUserAction(
  userId: number | null, 
  actionType: string, 
  resourceType: string, 
  resourceId: string, 
  details: any,
  req?: Request
) {
  const db = await database
  
  await db.run(`
    INSERT INTO user_actions (
      user_id, action_type, resource_type, resource_id, 
      action_details, ip_address, user_agent
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    userId,
    actionType, 
    resourceType,
    resourceId,
    JSON.stringify(details),
    req?.headers.get('x-forwarded-for') || 'unknown',
    req?.headers.get('user-agent') || 'unknown'
  ])
}
```

### **Phase 3: Middleware для проверки прав (1 день)**

#### 3.1 Middleware для авторизации
```typescript
// src/middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'

// Маршруты и необходимые разрешения
const PROTECTED_ROUTES = {
  '/admin': ['settings.view'],
  '/admin/users': ['users.manage'],
  '/admin/settings': ['settings.edit'],
  '/admin/upload': ['files.upload'],
  '/admin/analytics': ['analytics.view'],
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Проверяем, защищен ли маршрут
  const requiredPermission = getRequiredPermission(pathname)
  if (!requiredPermission) {
    return NextResponse.next()
  }
  
  // Получаем сессию пользователя
  const session = await auth()
  
  if (!session?.user) {
    return NextResponse.redirect(new URL('/admin/login', request.url))
  }
  
  // Проверяем права доступа
  const hasPermission = session.user.permissions?.includes(requiredPermission)
  if (!hasPermission) {
    return NextResponse.redirect(new URL('/admin/access-denied', request.url))
  }
  
  return NextResponse.next()
}

function getRequiredPermission(pathname: string): string | null {
  for (const [route, permissions] of Object.entries(PROTECTED_ROUTES)) {
    if (pathname.startsWith(route)) {
      return permissions[0] // Берем первое необходимое разрешение
    }
  }
  return null
}

export const config = {
  matcher: ['/admin/:path*']
}
```

#### 3.2 Hook для проверки прав в компонентах
```typescript
// src/hooks/usePermissions.ts
import { useSession } from 'next-auth/react'

export function usePermissions() {
  const { data: session } = useSession()
  
  const hasPermission = (permission: string): boolean => {
    return session?.user?.permissions?.includes(permission) ?? false
  }
  
  const hasRole = (role: string): boolean => {
    return session?.user?.role === role
  }
  
  const isAdmin = (): boolean => hasRole('admin')
  const isEditor = (): boolean => hasRole('editor')
  
  return {
    hasPermission,
    hasRole,
    isAdmin,
    isEditor,
    permissions: session?.user?.permissions ?? [],
    role: session?.user?.role
  }
}
```

### **Phase 4: UI для управления пользователями (2-3 дня)**

#### 4.1 Страница управления пользователями
```typescript
// src/app/admin/users/page.tsx
import { auth } from '@/lib/auth'
import { getAllUsers } from '@/lib/user-service'
import { UserManagementTable } from '@/components/admin/UserManagementTable'
import { CreateUserButton } from '@/components/admin/CreateUserButton'

export default async function UsersPage() {
  const session = await auth()
  
  if (session?.user?.role !== 'admin') {
    return <div>Access Denied</div>
  }
  
  const users = await getAllUsers()
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">User Management</h1>
        <CreateUserButton />
      </div>
      
      <UserManagementTable users={users} currentUser={session.user} />
    </div>
  )
}
```

#### 4.2 Компонент таблицы пользователей
```typescript
// src/components/admin/UserManagementTable.tsx
'use client'

import { useState } from 'react'
import { usePermissions } from '@/hooks/usePermissions'

interface User {
  id: number
  email: string
  role: string
  status: string
  created_at: string
  last_login_at?: string
}

export function UserManagementTable({ users, currentUser }) {
  const { hasPermission } = usePermissions()
  const [selectedUsers, setSelectedUsers] = useState<number[]>([])
  
  const canManageUsers = hasPermission('users.manage')
  const canDeleteUsers = hasPermission('users.delete')
  
  return (
    <div className="bg-white shadow rounded-lg">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              User
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Role
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Last Login
            </th>
            {canManageUsers && (
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {users.map((user) => (
            <UserRow 
              key={user.id} 
              user={user} 
              canEdit={canManageUsers && user.id !== currentUser.id}
              canDelete={canDeleteUsers && user.id !== currentUser.id}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

## 📊 Ожидаемые результаты

### **Безопасность:**
- 🔐 **Разграничение доступа** по ролям
- 🛡️ **Защита критических операций** только для админов
- 📝 **Полный аудит** всех действий пользователей
- 🚫 **Блокировка подозрительных пользователей**

### **Управляемость:**
- 👥 **Централизованное управление** пользователями
- 🎭 **Гибкая система ролей** и разрешений  
- 📊 **Аналитика активности** пользователей
- ⚡ **Быстрое изменение** прав доступа

### **Масштабируемость:**
- 🔄 **Легкое добавление** новых ролей
- 🎯 **Точечные разрешения** для специфических задач
- 🌐 **OAuth интеграция** с корпоративными системами
- 🔧 **API для автоматизации** управления пользователями

## ✅ Критерии готовности

- [ ] Роли Admin и Editor работают корректно
- [ ] Middleware блокирует неавторизованный доступ
- [ ] UI для управления пользователями функционирует
- [ ] Аудит логи записываются для всех действий
- [ ] NextAuth.js интегрирован с новой системой ролей
- [ ] Миграция существующих пользователей завершена

---
*Система пользователей - основа для безопасного продакшн-развертывания.*