'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, Cart, Order, PaymentIntent } from '@/lib/api';

export default function CheckoutPage() {
  const router = useRouter();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'CREDIT_CARD' | 'PAYPAL' | 'BANK_TRANSFER' | 'COD'>('CREDIT_CARD');
  const [user, setUser] = useState<any>(null);
  const [addressId, setAddressId] = useState<string | null>(null);
  
  // Mock address for testing (in production, load from user profile)
  const [shippingAddress] = useState({
    street: '123 Main St',
    city: 'New York',
    state: 'NY',
    zipCode: '10001',
    country: 'USA',
  });

  useEffect(() => {
    // Check if user is authenticated
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (!token) {
      router.push('/auth/login?redirect=/checkout');
      return;
    }
    
    loadCart();
    loadUserAndAddress();
  }, []);

  const loadCart = async () => {
    try {
      setLoading(true);
      const data = await api.getCart();
      setCart(data);
    } catch (err) {
      if (err instanceof Error && err.message.includes('Unauthorized')) {
        router.push('/auth/login?redirect=/checkout');
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to load cart');
    } finally {
      setLoading(false);
    }
  };

  const loadUserAndAddress = async () => {
    try {
      const userData = await api.getCurrentUser();
      setUser(userData);
      
      // Use user's first address or default address
      if (userData.addresses && userData.addresses.length > 0) {
        const defaultAddress = userData.addresses.find(a => a.isDefault) || userData.addresses[0];
        setAddressId(defaultAddress.id);
      } else {
        setError('No shipping address found. Please add an address to your profile first.');
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('Unauthorized')) {
        router.push('/auth/login?redirect=/checkout');
        return;
      }
      console.error('Failed to load user:', err);
      setError('Please login to continue with checkout.');
    }
  };

  const handlePlaceOrder = async () => {
    if (!cart || cart.items.length === 0) return;
    if (!addressId) {
      setError('Please wait while we set up your address...');
      return;
    }

    try {
      setProcessing(true);
      setError(null);

      // Step 1: Create order
      const order = await api.createOrder({
        shippingAddressId: addressId,
        paymentMethod: paymentMethod,
      });

      console.log('Order created:', order);

      // Step 2: Create payment intent
      const paymentIntent = await api.createPaymentIntent({
        orderId: order.id,
        amount: Math.round(order.total * 100), // Convert to cents
        currency: 'usd',
        idempotencyKey: `order-${order.id}-${Date.now()}`,
      });

      console.log('Payment intent created:', paymentIntent);

      // Step 3: In production, integrate Stripe Elements here
      // For testing, we'll show the payment details
      alert(`Order created! Order #${order.orderNumber}\n\nPayment Intent ID: ${paymentIntent.paymentIntentId}\n\nIn production, you would now use Stripe Elements to collect payment.`);
      
      router.push(`/orders/${order.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to place order');
      console.error('Checkout error:', err);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;
  if (!cart || cart.items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-2xl mx-auto text-center">
          <p className="mb-4">Your cart is empty</p>
          <Link href="/products" className="text-blue-600 hover:text-blue-800">
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  const tax = cart.summary.subtotal * 0.08; // 8% tax
  const shipping = 10; // Flat rate
  const total = cart.summary.subtotal + tax + shipping;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Link href="/cart" className="text-blue-600 hover:text-blue-800">
            ← Back to Cart
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Checkout</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {/* Shipping Address */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Shipping Address</h2>
              <div className="text-gray-700">
                <p>{shippingAddress.street}</p>
                <p>{shippingAddress.city}, {shippingAddress.state} {shippingAddress.zipCode}</p>
                <p>{shippingAddress.country}</p>
              </div>
              <p className="text-sm text-gray-500 mt-4">
                Note: Address management will be added in User Profile module
              </p>
            </div>

            {/* Order Items */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Order Items</h2>
              {cart.items.map((item) => (
                <div key={item.id} className="flex justify-between py-3 border-b last:border-b-0">
                  <div>
                    <p className="font-medium">{item.productVariant.product.name}</p>
                    <p className="text-sm text-gray-600">{item.productVariant.name}</p>
                    <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                  </div>
                  <p className="font-medium">
                    ${(item.priceAtAdd * item.quantity).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>

            {/* Payment Method */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Payment Method</h2>
              <div className="space-y-3">
                <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="CREDIT_CARD"
                    checked={paymentMethod === 'CREDIT_CARD'}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="mr-3"
                  />
                  <div>
                    <p className="font-medium">Credit Card (Stripe)</p>
                    <p className="text-sm text-gray-600">Pay securely with Stripe</p>
                  </div>
                </label>
                <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 opacity-50">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="PAYPAL"
                    disabled
                    className="mr-3"
                  />
                  <div>
                    <p className="font-medium">PayPal</p>
                    <p className="text-sm text-gray-600">Coming soon</p>
                  </div>
                </label>
                <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 opacity-50">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="BANK_TRANSFER"
                    disabled
                    className="mr-3"
                  />
                  <div>
                    <p className="font-medium">Bank Transfer</p>
                    <p className="text-sm text-gray-600">Coming soon</p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6 sticky top-4">
              <h2 className="text-xl font-semibold mb-4">Order Summary</h2>
              
              <div className="space-y-2 mb-4">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>${cart.summary.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax:</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Shipping:</span>
                  <span>${shipping.toFixed(2)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-bold text-lg">
                  <span>Total:</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded p-3 mb-4 text-sm text-red-800">
                  {error}
                </div>
              )}

              <button
                onClick={handlePlaceOrder}
                disabled={processing}
                className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
              >
                {processing ? 'Processing...' : 'Place Order'}
              </button>

              <p className="text-xs text-gray-500 mt-4 text-center">
                Test mode: Payment will be simulated
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
