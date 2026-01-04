'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, Product } from '@/lib/api';
import Header from '../components/Header';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async (searchQuery?: string) => {
    try {
      setLoading(true);
      const response = await api.getProducts({ 
        limit: 20,
        search: searchQuery 
      });
      setProducts(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadProducts(search);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Products</h1>

        <form onSubmit={handleSearch} className="mb-8">
          <div className="flex gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="flex-1 px-4 py-2 border rounded-lg"
            />
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Search
            </button>
          </div>
        </form>

        {loading && <div className="text-center py-12">Loading...</div>}
        {error && <div className="bg-red-50 p-4 rounded text-red-800">{error}</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product) => (
            <div key={product.id} className="bg-white rounded-lg shadow p-6">
              <div className="aspect-square bg-gray-100 rounded mb-4 flex items-center justify-center">
                <span className="text-gray-400 text-sm">No image</span>
              </div>
              <h3 className="font-semibold mb-2">{product.name}</h3>
              <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                {product.description || 'No description'}
              </p>
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold">${product.basePrice}</span>
                <Link
                  href={`/products/${product.id}`}
                  className="text-blue-600 hover:text-blue-800"
                >
                  View Details
                </Link>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
