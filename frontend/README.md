# MODAKey Frontend

Next.js web application for the MODAKey e-commerce platform.

## Description

Modern, responsive frontend for the mechanical keyboard e-commerce store built with Next.js 16, TypeScript, and Tailwind CSS. Features product browsing, shopping cart, checkout with Stripe payment integration, and order management.

## Features

- ✅ Product catalog with search and filtering
- ✅ Product detail pages with variants
- ✅ Shopping cart functionality
- ✅ User authentication (login/register)
- ✅ Checkout flow with Stripe payment
- ✅ Order history and tracking
- ✅ Responsive design with Tailwind CSS
- ✅ Type-safe API client

## Documentation

See [docs/TESTING_GUIDE.md](./docs/TESTING_GUIDE.md) for testing workflows and flows.

## Tech Stack

- **Next.js 16** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first styling
- **React Hooks** - State management

## Prerequisites

- Node.js 20.x or higher
- npm or yarn
- Backend API running on http://localhost:3000

## Installation

```bash
# Install dependencies
npm install
```

## Environment Setup

Create a `.env.local` file:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
```

## Getting Started

Start the development server:

```bash
npm run dev
```

The frontend will be available at **http://localhost:3001**

## Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Create production build
npm run start        # Start production server
npm run lint         # Run ESLint
```

## Project Structure

```
frontend/
├── app/                    # Next.js App Router
│   ├── auth/              # Authentication pages
│   ├── cart/              # Shopping cart page
│   ├── checkout/          # Checkout flow
│   ├── orders/            # Order history
│   ├── products/          # Product pages
│   ├── components/        # Shared components
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── docs/                  # Documentation
│   └── TESTING_GUIDE.md   # Testing guide
├── lib/                   # Utilities
│   └── api.ts             # API client
└── public/                # Static assets
```

## Testing the Application

See [docs/TESTING_GUIDE.md](./docs/TESTING_GUIDE.md) for detailed testing instructions.

### Quick Test Flow

1. **Start Backend**: Ensure backend is running on http://localhost:3000
2. **Login**: Navigate to `/auth/login`
3. **Browse Products**: Visit `/products`
4. **Add to Cart**: Select product and add to cart
5. **Checkout**: Proceed to `/checkout` and place order
6. **View Orders**: Check order history at `/orders`

## API Integration

The frontend uses a TypeScript API client ([lib/api.ts](./lib/api.ts)) that communicates with the backend REST API.

Key features:
- Type-safe request/response handling
- Authentication token management
- Error handling
- Request interceptors

## Features Overview

### Authentication
- User registration with validation
- Login with JWT tokens
- Protected routes
- Session management

### Product Catalog
- Product listing with pagination
- Product search functionality
- Product detail pages
- Variant selection

### Shopping Cart
- Add/remove items
- Update quantities
- Persistent cart for authenticated users
- Real-time stock validation

### Checkout
- Address management
- Order summary
- Stripe payment integration
- Order confirmation

### Order Management
- Order history listing
- Order detail view
- Order status tracking

## Styling

The application uses Tailwind CSS for styling with:
- Responsive design (mobile-first)
- Custom color scheme
- Component-based utilities
- Dark mode support (coming soon)

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [TypeScript](https://www.typescriptlang.org/docs)

## Support

For issues or questions, refer to the main project repository.
