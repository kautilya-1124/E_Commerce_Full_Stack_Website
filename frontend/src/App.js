import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = createContext();

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUser();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUser = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`);
      setUser(response.data);
    } catch (error) {
      localStorage.removeItem('token');
      delete axios.defaults.headers.common['Authorization'];
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API}/auth/login`, { email, password });
      const { user, token } = response.data;
      localStorage.setItem('token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(user);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Login failed' };
    }
  };

  const register = async (email, password, full_name) => {
    try {
      const response = await axios.post(`${API}/auth/register`, { email, password, full_name });
      const { user, token } = response.data;
      localStorage.setItem('token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(user);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Registration failed' };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// Cart Context
const CartContext = createContext();

const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

const CartProvider = ({ children }) => {
  const [cart, setCart] = useState({ items: [] });
  const [cartCount, setCartCount] = useState(0);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchCart();
    }
  }, [user]);

  const fetchCart = async () => {
    try {
      const response = await axios.get(`${API}/cart`);
      setCart(response.data);
      setCartCount(response.data.items.reduce((sum, item) => sum + item.quantity, 0));
    } catch (error) {
      console.error('Error fetching cart:', error);
    }
  };

  const addToCart = async (productId, quantity, size, color) => {
    try {
      await axios.post(`${API}/cart/add`, {
        product_id: productId,
        quantity,
        size,
        color
      });
      fetchCart();
      return true;
    } catch (error) {
      console.error('Error adding to cart:', error);
      return false;
    }
  };

  const removeFromCart = async (productId) => {
    try {
      await axios.delete(`${API}/cart/remove/${productId}`);
      fetchCart();
    } catch (error) {
      console.error('Error removing from cart:', error);
    }
  };

  return (
    <CartContext.Provider value={{ cart, cartCount, addToCart, removeFromCart, fetchCart }}>
      {children}
    </CartContext.Provider>
  );
};

// Components
const Header = () => {
  const { user, logout } = useAuth();
  const { cartCount } = useCart();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link to="/" className="text-2xl font-bold text-black">
              ATTIRE
            </Link>
          </div>
          
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-8">
              <Link to="/" className="text-gray-900 hover:text-gray-700 px-3 py-2 text-sm font-medium">
                Home
              </Link>
              <Link to="/products/shoes" className="text-gray-900 hover:text-gray-700 px-3 py-2 text-sm font-medium">
                Shoes
              </Link>
              <Link to="/products/clothing" className="text-gray-900 hover:text-gray-700 px-3 py-2 text-sm font-medium">
                Clothing
              </Link>
              <Link to="/products/accessories" className="text-gray-900 hover:text-gray-700 px-3 py-2 text-sm font-medium">
                Accessories
              </Link>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {user ? (
              <>
                <Link to="/cart" className="relative p-2">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m1.6 8L5 3H3m4 10v6a1 1 0 001 1h10a1 1 0 001-1v-6M9 21h6"/>
                  </svg>
                  {cartCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {cartCount}
                    </span>
                  )}
                </Link>
                <div className="relative">
                  <button
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="flex items-center space-x-2 text-gray-900 hover:text-gray-700"
                  >
                    <span className="text-sm font-medium">{user.full_name}</span>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                    </svg>
                  </button>
                  {isMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
                      <Link
                        to="/profile"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Profile
                      </Link>
                      <Link
                        to="/orders"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Orders
                      </Link>
                      <button
                        onClick={() => {
                          logout();
                          setIsMenuOpen(false);
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex space-x-4">
                <Link
                  to="/login"
                  className="text-gray-900 hover:text-gray-700 px-3 py-2 text-sm font-medium"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="bg-black text-white px-4 py-2 text-sm font-medium rounded-md hover:bg-gray-800"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
};

const Hero = () => {
  return (
    <div className="relative bg-gray-900 text-white">
      <div className="absolute inset-0">
        <img
          className="w-full h-full object-cover"
          src="https://images.unsplash.com/photo-1605408499391-6368c628ef42?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Nzd8MHwxfHNlYXJjaHwxfHxuaWtlJTIwc2hvZXN8ZW58MHx8fHwxNzU5NDAyMzE2fDA&ixlib=rb-4.1.0&q=85"
          alt="Nike shoes"
        />
        <div className="absolute inset-0 bg-gray-900 opacity-50"></div>
      </div>
      <div className="relative max-w-7xl mx-auto py-24 px-4 sm:py-32 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
          Just Do It
        </h1>
        <p className="mt-6 text-xl text-gray-300 max-w-3xl">
          Discover the latest collection of premium athletic wear and footwear. 
          Engineered for performance, designed for style.
        </p>
        <div className="mt-10">
          <Link
            to="/products/shoes"
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-black bg-white hover:bg-gray-100"
          >
            Shop Now
          </Link>
        </div>
      </div>
    </div>
  );
};

const ProductCard = ({ product }) => {
  return (
    <div className="group relative">
      <div className="aspect-w-1 aspect-h-1 w-full overflow-hidden rounded-lg bg-gray-200 group-hover:opacity-75">
        <img
          src={product.images[0]}
          alt={product.name}
          className="h-64 w-full object-cover object-center"
        />
      </div>
      <div className="mt-4 flex justify-between">
        <div>
          <h3 className="text-sm text-gray-700">
            <Link to={`/product/${product.id}`}>
              <span aria-hidden="true" className="absolute inset-0" />
              {product.name}
            </Link>
          </h3>
          <p className="mt-1 text-sm text-gray-500 capitalize">{product.category}</p>
        </div>
        <p className="text-sm font-medium text-gray-900">${product.price}</p>
      </div>
    </div>
  );
};

const Home = () => {
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initData = async () => {
      try {
        // Initialize sample data
        await axios.post(`${API}/init-data`);
        // Fetch featured products
        const response = await axios.get(`${API}/products?featured=true`);
        setFeaturedProducts(response.data);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    initData();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div>
      <Hero />
      
      {/* Featured Products */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 mb-8">
            Featured Products
          </h2>
          <div className="grid grid-cols-1 gap-y-10 gap-x-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 mb-8 text-center">
            Shop by Category
          </h2>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <Link
              to="/products/shoes"
              className="relative overflow-hidden rounded-lg shadow-lg group hover:shadow-xl transition-shadow"
            >
              <img
                className="w-full h-64 object-cover group-hover:scale-105 transition-transform"
                src="https://images.unsplash.com/photo-1542291026-7eec264c27ff?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Nzd8MHwxfHNlYXJjaHwzfHxuaWtlJTIwc2hvZXN8ZW58MHx8fHwxNzU5NDAyMzE2fDA&ixlib=rb-4.1.0&q=85"
                alt="Shoes"
              />
              <div className="absolute inset-0 bg-gray-900 opacity-25"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <h3 className="text-white text-2xl font-bold">Shoes</h3>
              </div>
            </Link>
            
            <Link
              to="/products/clothing"
              className="relative overflow-hidden rounded-lg shadow-lg group hover:shadow-xl transition-shadow"
            >
              <img
                className="w-full h-64 object-cover group-hover:scale-105 transition-transform"
                src="https://images.unsplash.com/photo-1645207803533-e2cfe1382f2c?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDN8MHwxfHNlYXJjaHwxfHxhdGhsZXRpYyUyMGNsb3RoaW5nfGVufDB8fHx8MTc1OTMzNzQyM3ww&ixlib=rb-4.1.0&q=85"
                alt="Clothing"
              />
              <div className="absolute inset-0 bg-gray-900 opacity-25"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <h3 className="text-white text-2xl font-bold">Clothing</h3>
              </div>
            </Link>
            
            <Link
              to="/products/accessories"
              className="relative overflow-hidden rounded-lg shadow-lg group hover:shadow-xl transition-shadow"
            >
              <img
                className="w-full h-64 object-cover group-hover:scale-105 transition-transform"
                src="https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDN8MHwxfHNlYXJjaHw1fHxhcHBhcmVsfGVufDB8fHx8MTc1OTMzNzQ3N3ww&ixlib=rb-4.1.0&q=85"
                alt="Accessories"
              />
              <div className="absolute inset-0 bg-gray-900 opacity-25"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <h3 className="text-white text-2xl font-bold">Accessories</h3>
              </div>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

const ProductListing = () => {
  const { category } = useParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const url = category ? `${API}/products?category=${category}` : `${API}/products`;
        const response = await axios.get(url);
        setProducts(response.data);
      } catch (error) {
        console.error('Error fetching products:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [category]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8 capitalize">
        {category || 'All Products'}
      </h1>
      <div className="grid grid-cols-1 gap-y-10 gap-x-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
};

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { addToCart } = useCart();

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const response = await axios.get(`${API}/products/${id}`);
        setProduct(response.data);
        setSelectedColor(response.data.colors[0]);
        setSelectedSize(response.data.sizes[0]);
      } catch (error) {
        console.error('Error fetching product:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  const handleAddToCart = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (!selectedSize || !selectedColor) {
      alert('Please select size and color');
      return;
    }

    const success = await addToCart(product.id, quantity, selectedSize, selectedColor);
    if (success) {
      alert('Product added to cart!');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!product) {
    return <div>Product not found</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="lg:grid lg:grid-cols-2 lg:gap-x-8 lg:items-start">
        {/* Image gallery */}
        <div className="flex flex-col-reverse">
          <div className="w-full aspect-w-1 aspect-h-1">
            <img
              src={product.images[0]}
              alt={product.name}
              className="w-full h-96 object-center object-cover rounded-lg"
            />
          </div>
        </div>

        {/* Product info */}
        <div className="mt-10 px-4 sm:px-0 sm:mt-16 lg:mt-0">
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
            {product.name}
          </h1>
          <div className="mt-3">
            <p className="text-3xl text-gray-900">${product.price}</p>
          </div>
          <div className="mt-6">
            <p className="text-base text-gray-500">{product.description}</p>
          </div>

          {/* Options */}
          <div className="mt-8">
            {/* Color picker */}
            <div>
              <h3 className="text-sm text-gray-900 font-medium">Color</h3>
              <div className="mt-2 flex space-x-2">
                {product.colors.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={`px-3 py-1 border rounded text-sm ${
                      selectedColor === color
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-gray-300 text-gray-900 hover:border-gray-400'
                    }`}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>

            {/* Size picker */}
            <div className="mt-6">
              <h3 className="text-sm text-gray-900 font-medium">Size</h3>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {product.sizes.map((size) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`px-3 py-2 border rounded text-sm ${
                      selectedSize === size
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-gray-300 text-gray-900 hover:border-gray-400'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity */}
            <div className="mt-6">
              <h3 className="text-sm text-gray-900 font-medium">Quantity</h3>
              <div className="mt-2 flex items-center space-x-3">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="px-3 py-1 border border-gray-300 rounded text-sm hover:border-gray-400"
                >
                  -
                </button>
                <span className="text-lg font-medium">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="px-3 py-1 border border-gray-300 rounded text-sm hover:border-gray-400"
                >
                  +
                </button>
              </div>
            </div>

            {/* Add to cart */}
            <div className="mt-8">
              <button
                onClick={handleAddToCart}
                className="w-full bg-black text-white py-3 px-8 rounded-md font-medium hover:bg-gray-800 transition-colors"
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(email, password);
    if (result.success) {
      navigate('/');
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">Sign In</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-black focus:border-black"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-black focus:border-black"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-black text-white py-2 px-4 rounded-md font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          {loading ? 'Signing In...' : 'Sign In'}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-gray-600">
        Don't have an account?{' '}
        <Link to="/register" className="font-medium text-black hover:text-gray-700">
          Sign up
        </Link>
      </p>
    </div>
  );
};

const Register = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await register(email, password, fullName);
    if (result.success) {
      navigate('/');
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">Sign Up</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700">Full Name</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-black focus:border-black"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-black focus:border-black"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-black focus:border-black"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-black text-white py-2 px-4 rounded-md font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          {loading ? 'Creating Account...' : 'Create Account'}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-gray-600">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-black hover:text-gray-700">
          Sign in
        </Link>
      </p>
    </div>
  );
};

const Cart = () => {
  const { cart, removeFromCart } = useCart();
  const [products, setProducts] = useState({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProductDetails = async () => {
      const productPromises = cart.items.map(item =>
        axios.get(`${API}/products/${item.product_id}`)
      );
      
      try {
        const responses = await Promise.all(productPromises);
        const productMap = {};
        responses.forEach(response => {
          productMap[response.data.id] = response.data;
        });
        setProducts(productMap);
      } catch (error) {
        console.error('Error fetching product details:', error);
      } finally {
        setLoading(false);
      }
    };

    if (cart.items.length > 0) {
      fetchProductDetails();
    } else {
      setLoading(false);
    }
  }, [cart.items]);

  const calculateTotal = () => {
    return cart.items.reduce((total, item) => {
      const product = products[item.product_id];
      return product ? total + (product.price * item.quantity) : total;
    }, 0).toFixed(2);
  };

  const handleCheckout = () => {
    navigate('/checkout');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Your cart is empty</h2>
        <Link
          to="/"
          className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-black hover:bg-gray-800"
        >
          Continue Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Shopping Cart</h1>
      
      <div className="lg:grid lg:grid-cols-12 lg:gap-x-12">
        <div className="lg:col-span-8">
          <div className="space-y-6">
            {cart.items.map((item) => {
              const product = products[item.product_id];
              if (!product) return null;

              return (
                <div key={`${item.product_id}-${item.size}-${item.color}`} className="flex items-center border-b pb-6">
                  <img
                    src={product.images[0]}
                    alt={product.name}
                    className="h-24 w-24 object-cover rounded-lg"
                  />
                  <div className="ml-4 flex-1">
                    <h3 className="text-lg font-medium text-gray-900">{product.name}</h3>
                    <p className="text-sm text-gray-500">Size: {item.size} | Color: {item.color}</p>
                    <p className="text-sm text-gray-500">Quantity: {item.quantity}</p>
                    <p className="text-lg font-medium text-gray-900">${(product.price * item.quantity).toFixed(2)}</p>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.product_id)}
                    className="ml-4 text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-4 mt-8 lg:mt-0">
          <div className="bg-gray-50 rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900">Order Summary</h2>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-base text-gray-900">Subtotal</span>
                <span className="text-base font-medium text-gray-900">${calculateTotal()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-base text-gray-900">Shipping</span>
                <span className="text-base font-medium text-gray-900">Free</span>
              </div>
              <div className="border-t pt-2 mt-4">
                <div className="flex justify-between">
                  <span className="text-lg font-medium text-gray-900">Total</span>
                  <span className="text-lg font-medium text-gray-900">${calculateTotal()}</span>
                </div>
              </div>
            </div>
            <button
              onClick={handleCheckout}
              className="w-full mt-6 bg-black text-white py-3 px-4 rounded-md font-medium hover:bg-gray-800 transition-colors"
            >
              Proceed to Checkout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Checkout = () => {
  const { cart } = useCart();
  const [products, setProducts] = useState({});
  const [shippingAddress, setShippingAddress] = useState('');
  const [loading, setLoading] = useState(true);
  const [orderLoading, setOrderLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProductDetails = async () => {
      const productPromises = cart.items.map(item =>
        axios.get(`${API}/products/${item.product_id}`)
      );
      
      try {
        const responses = await Promise.all(productPromises);
        const productMap = {};
        responses.forEach(response => {
          productMap[response.data.id] = response.data;
        });
        setProducts(productMap);
      } catch (error) {
        console.error('Error fetching product details:', error);
      } finally {
        setLoading(false);
      }
    };

    if (cart.items.length > 0) {
      fetchProductDetails();
    } else {
      navigate('/cart');
    }
  }, [cart.items, navigate]);

  const calculateTotal = () => {
    return cart.items.reduce((total, item) => {
      const product = products[item.product_id];
      return product ? total + (product.price * item.quantity) : total;
    }, 0).toFixed(2);
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    setOrderLoading(true);

    try {
      const response = await axios.post(`${API}/orders`, {
        items: cart.items,
        shipping_address: shippingAddress
      });
      
      alert('Order placed successfully!');
      navigate('/orders');
    } catch (error) {
      console.error('Error placing order:', error);
      alert('Failed to place order. Please try again.');
    } finally {
      setOrderLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Checkout</h1>
      
      <form onSubmit={handlePlaceOrder} className="lg:grid lg:grid-cols-12 lg:gap-x-12">
        <div className="lg:col-span-8">
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4">Shipping Address</h2>
              <textarea
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                required
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-black focus:border-black"
                placeholder="Enter your complete shipping address..."
              />
            </div>

            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4">Order Items</h2>
              <div className="space-y-4">
                {cart.items.map((item) => {
                  const product = products[item.product_id];
                  if (!product) return null;

                  return (
                    <div key={`${item.product_id}-${item.size}-${item.color}`} className="flex items-center border rounded-lg p-4">
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        className="h-16 w-16 object-cover rounded-lg"
                      />
                      <div className="ml-4 flex-1">
                        <h3 className="text-sm font-medium text-gray-900">{product.name}</h3>
                        <p className="text-sm text-gray-500">Size: {item.size} | Color: {item.color}</p>
                        <p className="text-sm text-gray-500">Qty: {item.quantity} × ${product.price}</p>
                      </div>
                      <p className="text-sm font-medium text-gray-900">${(product.price * item.quantity).toFixed(2)}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 mt-8 lg:mt-0">
          <div className="bg-gray-50 rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900">Order Summary</h2>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-base text-gray-900">Subtotal</span>
                <span className="text-base font-medium text-gray-900">${calculateTotal()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-base text-gray-900">Shipping</span>
                <span className="text-base font-medium text-gray-900">Free</span>
              </div>
              <div className="border-t pt-2 mt-4">
                <div className="flex justify-between">
                  <span className="text-lg font-medium text-gray-900">Total</span>
                  <span className="text-lg font-medium text-gray-900">${calculateTotal()}</span>
                </div>
              </div>
            </div>
            <button
              type="submit"
              disabled={orderLoading || !shippingAddress.trim()}
              className="w-full mt-6 bg-black text-white py-3 px-4 rounded-md font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {orderLoading ? 'Placing Order...' : 'Place Order'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await axios.get(`${API}/orders`);
        setOrders(response.data);
      } catch (error) {
        console.error('Error fetching orders:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">No orders yet</h2>
        <Link
          to="/"
          className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-black hover:bg-gray-800"
        >
          Start Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Your Orders</h1>
      
      <div className="space-y-6">
        {orders.map((order) => (
          <div key={order.id} className="border rounded-lg p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Order #{order.id.slice(-8)}</h3>
                <p className="text-sm text-gray-500">
                  Placed on {new Date(order.created_at).toLocaleDateString()}
                </p>
                <p className="text-sm text-gray-500 capitalize">Status: {order.status}</p>
              </div>
              <p className="text-lg font-medium text-gray-900">${order.total_amount.toFixed(2)}</p>
            </div>
            
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Items ({order.items.length})</h4>
              <div className="space-y-2">
                {order.items.map((item, index) => (
                  <div key={index} className="text-sm text-gray-600">
                    Product ID: {item.product_id} | Size: {item.size} | Color: {item.color} | Qty: {item.quantity}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const Profile = () => {
  const { user } = useAuth();

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Profile</h1>
      
      <div className="bg-white shadow rounded-lg p-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Full Name</label>
            <p className="mt-1 text-sm text-gray-900">{user.full_name}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <p className="mt-1 text-sm text-gray-900">{user.email}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Member Since</label>
            <p className="mt-1 text-sm text-gray-900">
              {new Date(user.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return user ? children : <Navigate to="/login" />;
};

const Footer = () => {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-lg font-semibold mb-4">ATTIRE</h3>
            <p className="text-gray-400 text-sm">
              Premium athletic wear and footwear for the modern athlete.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-medium mb-4">Products</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link to="/products/shoes" className="hover:text-white">Shoes</Link></li>
              <li><Link to="/products/clothing" className="hover:text-white">Clothing</Link></li>
              <li><Link to="/products/accessories" className="hover:text-white">Accessories</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-medium mb-4">Support</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><a href="#" className="hover:text-white">Contact Us</a></li>
              <li><a href="#" className="hover:text-white">Size Guide</a></li>
              <li><a href="#" className="hover:text-white">Returns</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-medium mb-4">Company</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><a href="#" className="hover:text-white">About Us</a></li>
              <li><a href="#" className="hover:text-white">Careers</a></li>
              <li><a href="#" className="hover:text-white">Privacy</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400">
          <p>&copy; 2025 ATTIRE. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <Router>
          <div className="min-h-screen bg-white">
            <Header />
            <main>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/products/:category" element={<ProductListing />} />
                <Route path="/products" element={<ProductListing />} />
                <Route path="/product/:id" element={<ProductDetail />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route
                  path="/cart"
                  element={
                    <ProtectedRoute>
                      <Cart />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/checkout"
                  element={
                    <ProtectedRoute>
                      <Checkout />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/orders"
                  element={
                    <ProtectedRoute>
                      <Orders />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </main>
            <Footer />
          </div>
        </Router>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;