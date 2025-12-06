'use client'

import { signOut } from 'next-auth/react'

export default function LogoutButton() {
  const handleLogout = async () => {
    try {
      await signOut({ callbackUrl: '/moderator/login' })
    } catch (error) {
      console.error('Ошибка выхода:', error)
    }
  }

  return (
    <button
      onClick={handleLogout}
      className='text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium'
    >
      Выйти
    </button>
  )
}
