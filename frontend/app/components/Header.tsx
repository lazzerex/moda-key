'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function Header() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      if (token) {
        const userData = await api.getCurrentUser();
        setUser(userData);
      }
    } catch (err) {
      console.error('Failed to load user:', err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
      setUser(null);
      router.push('/');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold text-gray-900">
            MODAKey
          </Link>
          <nav className="flex gap-6 items-center">
            <Link href="/products" className="text-gray-700 hover:text-gray-900">
              Products
            </Link>
            <Link href="/cart" className="text-gray-700 hover:text-gray-900">
              Cart
            </Link>
            <Link href="/orders" className="text-gray-700 hover:text-gray-900">
              Orders
            </Link>
            {!loading && (
              <>
                {user ? (
                  <div className="flex items-center gap-4">
                    <span className="text-gray-700">
                      Hello, {user.firstName || user.email}
                    </span>
                    <button
                      onClick={handleLogout}
                      className="text-red-600 hover:text-red-800 font-medium"
                    >
                      Logout
                    </button>
                  </div>
                ) : (
                  <Link href="/auth/login" className="text-gray-700 hover:text-gray-900">
                    Login
                  </Link>
                )}
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
