#!/usr/bin/env python3
"""
Comprehensive Backend Testing for Nike-inspired E-commerce Website
Tests all core backend functionality including authentication, products, cart, and orders.
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://attirezone-1.preview.emergentagent.com/api"
TEST_USER_EMAIL = "john.doe@example.com"
TEST_USER_PASSWORD = "securepassword123"
TEST_USER_NAME = "John Doe"

class BackendTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.auth_token = None
        self.test_user_id = None
        self.test_product_id = None
        self.test_results = {
            "sample_data_init": False,
            "user_registration": False,
            "user_login": False,
            "jwt_authentication": False,
            "product_retrieval": False,
            "product_filtering": False,
            "product_by_id": False,
            "cart_creation": False,
            "cart_add_items": False,
            "cart_remove_items": False,
            "order_creation": False,
            "order_retrieval": False,
            "database_operations": False
        }
        self.errors = []

    def log_error(self, test_name, error_msg):
        """Log test errors for detailed reporting"""
        error_entry = f"❌ {test_name}: {error_msg}"
        self.errors.append(error_entry)
        print(error_entry)

    def log_success(self, test_name, details=""):
        """Log successful tests"""
        success_msg = f"✅ {test_name}"
        if details:
            success_msg += f": {details}"
        print(success_msg)

    def test_sample_data_initialization(self):
        """Test /api/init-data endpoint to populate sample products"""
        print("\n🔄 Testing Sample Data Initialization...")
        try:
            response = requests.post(f"{self.base_url}/init-data", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "message" in data:
                    self.test_results["sample_data_init"] = True
                    self.log_success("Sample Data Initialization", data["message"])
                    return True
                else:
                    self.log_error("Sample Data Initialization", "Invalid response format")
            else:
                self.log_error("Sample Data Initialization", f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_error("Sample Data Initialization", f"Request failed: {str(e)}")
        
        return False

    def test_user_registration(self):
        """Test user registration endpoint"""
        print("\n🔄 Testing User Registration...")
        try:
            user_data = {
                "email": TEST_USER_EMAIL,
                "password": TEST_USER_PASSWORD,
                "full_name": TEST_USER_NAME
            }
            
            response = requests.post(f"{self.base_url}/auth/register", 
                                   json=user_data, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "user" in data and "token" in data:
                    self.auth_token = data["token"]
                    self.test_user_id = data["user"]["id"]
                    self.test_results["user_registration"] = True
                    self.log_success("User Registration", f"User ID: {self.test_user_id}")
                    return True
                else:
                    self.log_error("User Registration", "Missing user or token in response")
            elif response.status_code == 400:
                # User might already exist, try login instead
                print("⚠️  User already exists, will test login instead")
                return self.test_user_login()
            else:
                self.log_error("User Registration", f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_error("User Registration", f"Request failed: {str(e)}")
        
        return False

    def test_user_login(self):
        """Test user login endpoint"""
        print("\n🔄 Testing User Login...")
        try:
            login_data = {
                "email": TEST_USER_EMAIL,
                "password": TEST_USER_PASSWORD
            }
            
            response = requests.post(f"{self.base_url}/auth/login", 
                                   json=login_data, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "user" in data and "token" in data:
                    self.auth_token = data["token"]
                    self.test_user_id = data["user"]["id"]
                    self.test_results["user_login"] = True
                    self.log_success("User Login", f"Token received, User ID: {self.test_user_id}")
                    return True
                else:
                    self.log_error("User Login", "Missing user or token in response")
            else:
                self.log_error("User Login", f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_error("User Login", f"Request failed: {str(e)}")
        
        return False

    def test_jwt_authentication(self):
        """Test JWT authentication with /auth/me endpoint"""
        print("\n🔄 Testing JWT Authentication...")
        if not self.auth_token:
            self.log_error("JWT Authentication", "No auth token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            response = requests.get(f"{self.base_url}/auth/me", 
                                  headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "id" in data and "email" in data:
                    self.test_results["jwt_authentication"] = True
                    self.log_success("JWT Authentication", f"Authenticated as: {data['email']}")
                    return True
                else:
                    self.log_error("JWT Authentication", "Invalid user data in response")
            else:
                self.log_error("JWT Authentication", f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_error("JWT Authentication", f"Request failed: {str(e)}")
        
        return False

    def test_product_retrieval(self):
        """Test product retrieval endpoints"""
        print("\n🔄 Testing Product Retrieval...")
        try:
            # Test get all products
            response = requests.get(f"{self.base_url}/products", timeout=10)
            
            if response.status_code == 200:
                products = response.json()
                if isinstance(products, list) and len(products) > 0:
                    self.test_product_id = products[0]["id"]  # Store for later tests
                    self.test_results["product_retrieval"] = True
                    self.log_success("Product Retrieval", f"Retrieved {len(products)} products")
                    return True
                else:
                    self.log_error("Product Retrieval", "No products found or invalid format")
            else:
                self.log_error("Product Retrieval", f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_error("Product Retrieval", f"Request failed: {str(e)}")
        
        return False

    def test_product_filtering(self):
        """Test product filtering by category and featured status"""
        print("\n🔄 Testing Product Filtering...")
        try:
            # Test category filtering
            categories = ["shoes", "clothing", "accessories"]
            category_results = {}
            
            for category in categories:
                response = requests.get(f"{self.base_url}/products?category={category}", timeout=10)
                if response.status_code == 200:
                    products = response.json()
                    category_results[category] = len(products)
                else:
                    self.log_error("Product Filtering", f"Failed to filter by {category}")
                    return False
            
            # Test featured products
            response = requests.get(f"{self.base_url}/products?featured=true", timeout=10)
            if response.status_code == 200:
                featured_products = response.json()
                featured_count = len(featured_products)
                
                self.test_results["product_filtering"] = True
                self.log_success("Product Filtering", 
                               f"Categories: {category_results}, Featured: {featured_count}")
                return True
            else:
                self.log_error("Product Filtering", "Failed to filter featured products")
                
        except Exception as e:
            self.log_error("Product Filtering", f"Request failed: {str(e)}")
        
        return False

    def test_product_by_id(self):
        """Test retrieving specific product by ID"""
        print("\n🔄 Testing Product by ID...")
        if not self.test_product_id:
            self.log_error("Product by ID", "No product ID available for testing")
            return False
            
        try:
            response = requests.get(f"{self.base_url}/products/{self.test_product_id}", timeout=10)
            
            if response.status_code == 200:
                product = response.json()
                if "id" in product and product["id"] == self.test_product_id:
                    self.test_results["product_by_id"] = True
                    self.log_success("Product by ID", f"Retrieved: {product.get('name', 'Unknown')}")
                    return True
                else:
                    self.log_error("Product by ID", "Product ID mismatch")
            else:
                self.log_error("Product by ID", f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_error("Product by ID", f"Request failed: {str(e)}")
        
        return False

    def test_cart_operations(self):
        """Test shopping cart creation and operations"""
        print("\n🔄 Testing Cart Operations...")
        if not self.auth_token:
            self.log_error("Cart Operations", "No auth token available")
            return False
            
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        try:
            # Test get cart (should create empty cart if none exists)
            response = requests.get(f"{self.base_url}/cart", headers=headers, timeout=10)
            
            if response.status_code == 200:
                cart = response.json()
                if "id" in cart and "user_id" in cart:
                    self.test_results["cart_creation"] = True
                    self.log_success("Cart Creation", f"Cart ID: {cart['id']}")
                    return True
                else:
                    self.log_error("Cart Creation", "Invalid cart structure")
            else:
                self.log_error("Cart Creation", f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_error("Cart Creation", f"Request failed: {str(e)}")
        
        return False

    def test_cart_add_items(self):
        """Test adding items to cart"""
        print("\n🔄 Testing Add Items to Cart...")
        if not self.auth_token or not self.test_product_id:
            self.log_error("Add Items to Cart", "Missing auth token or product ID")
            return False
            
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        try:
            cart_item = {
                "product_id": self.test_product_id,
                "quantity": 2,
                "size": "M",
                "color": "Black"
            }
            
            response = requests.post(f"{self.base_url}/cart/add", 
                                   json=cart_item, headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "message" in data and "cart" in data:
                    cart = data["cart"]
                    if len(cart["items"]) > 0:
                        self.test_results["cart_add_items"] = True
                        self.log_success("Add Items to Cart", f"Added item, cart has {len(cart['items'])} items")
                        return True
                    else:
                        self.log_error("Add Items to Cart", "Item not added to cart")
                else:
                    self.log_error("Add Items to Cart", "Invalid response format")
            else:
                self.log_error("Add Items to Cart", f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_error("Add Items to Cart", f"Request failed: {str(e)}")
        
        return False

    def test_cart_remove_items(self):
        """Test removing items from cart"""
        print("\n🔄 Testing Remove Items from Cart...")
        if not self.auth_token or not self.test_product_id:
            self.log_error("Remove Items from Cart", "Missing auth token or product ID")
            return False
            
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        try:
            response = requests.delete(f"{self.base_url}/cart/remove/{self.test_product_id}", 
                                     headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "message" in data and "cart" in data:
                    self.test_results["cart_remove_items"] = True
                    self.log_success("Remove Items from Cart", "Item removed successfully")
                    return True
                else:
                    self.log_error("Remove Items from Cart", "Invalid response format")
            else:
                self.log_error("Remove Items from Cart", f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_error("Remove Items from Cart", f"Request failed: {str(e)}")
        
        return False

    def test_order_creation(self):
        """Test order placement"""
        print("\n🔄 Testing Order Creation...")
        if not self.auth_token or not self.test_product_id:
            self.log_error("Order Creation", "Missing auth token or product ID")
            return False
            
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        try:
            # First add item back to cart for order
            cart_item = {
                "product_id": self.test_product_id,
                "quantity": 1,
                "size": "L",
                "color": "Blue"
            }
            requests.post(f"{self.base_url}/cart/add", json=cart_item, headers=headers, timeout=10)
            
            # Create order
            order_data = {
                "items": [cart_item],
                "shipping_address": "123 Test Street, Test City, TC 12345"
            }
            
            response = requests.post(f"{self.base_url}/orders", 
                                   json=order_data, headers=headers, timeout=10)
            
            if response.status_code == 200:
                order = response.json()
                if "id" in order and "total_amount" in order:
                    self.test_results["order_creation"] = True
                    self.log_success("Order Creation", f"Order ID: {order['id']}, Total: ${order['total_amount']}")
                    return True
                else:
                    self.log_error("Order Creation", "Invalid order structure")
            else:
                self.log_error("Order Creation", f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_error("Order Creation", f"Request failed: {str(e)}")
        
        return False

    def test_order_retrieval(self):
        """Test retrieving order history"""
        print("\n🔄 Testing Order Retrieval...")
        if not self.auth_token:
            self.log_error("Order Retrieval", "No auth token available")
            return False
            
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        try:
            response = requests.get(f"{self.base_url}/orders", headers=headers, timeout=10)
            
            if response.status_code == 200:
                orders = response.json()
                if isinstance(orders, list):
                    self.test_results["order_retrieval"] = True
                    self.log_success("Order Retrieval", f"Retrieved {len(orders)} orders")
                    return True
                else:
                    self.log_error("Order Retrieval", "Invalid orders format")
            else:
                self.log_error("Order Retrieval", f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_error("Order Retrieval", f"Request failed: {str(e)}")
        
        return False

    def test_database_operations(self):
        """Test database operations by verifying data persistence"""
        print("\n🔄 Testing Database Operations...")
        
        # Check if we can retrieve data that was created/modified
        operations_working = True
        
        try:
            # Test 1: Verify products persist after initialization
            response = requests.get(f"{self.base_url}/products", timeout=10)
            if response.status_code != 200 or len(response.json()) == 0:
                operations_working = False
                self.log_error("Database Operations", "Products not persisting")
            
            # Test 2: Verify user authentication persists
            if self.auth_token:
                headers = {"Authorization": f"Bearer {self.auth_token}"}
                response = requests.get(f"{self.base_url}/auth/me", headers=headers, timeout=10)
                if response.status_code != 200:
                    operations_working = False
                    self.log_error("Database Operations", "User authentication not persisting")
            
            if operations_working:
                self.test_results["database_operations"] = True
                self.log_success("Database Operations", "MongoDB operations working correctly")
                return True
                
        except Exception as e:
            self.log_error("Database Operations", f"Request failed: {str(e)}")
        
        return False

    def run_all_tests(self):
        """Run all backend tests in sequence"""
        print("🚀 Starting Comprehensive Backend Testing for Nike E-commerce Website")
        print(f"🔗 Testing against: {self.base_url}")
        print("=" * 80)
        
        # Test sequence
        test_sequence = [
            self.test_sample_data_initialization,
            self.test_user_registration,
            self.test_jwt_authentication,
            self.test_product_retrieval,
            self.test_product_filtering,
            self.test_product_by_id,
            self.test_cart_operations,
            self.test_cart_add_items,
            self.test_cart_remove_items,
            self.test_order_creation,
            self.test_order_retrieval,
            self.test_database_operations
        ]
        
        for test_func in test_sequence:
            test_func()
        
        self.print_summary()

    def print_summary(self):
        """Print comprehensive test summary"""
        print("\n" + "=" * 80)
        print("📊 BACKEND TESTING SUMMARY")
        print("=" * 80)
        
        passed_tests = sum(1 for result in self.test_results.values() if result)
        total_tests = len(self.test_results)
        
        print(f"✅ Passed: {passed_tests}/{total_tests} tests")
        print(f"❌ Failed: {total_tests - passed_tests}/{total_tests} tests")
        
        print("\n📋 Detailed Results:")
        for test_name, result in self.test_results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"  {status} - {test_name.replace('_', ' ').title()}")
        
        if self.errors:
            print(f"\n🚨 Error Details ({len(self.errors)} errors):")
            for error in self.errors:
                print(f"  {error}")
        
        print("\n" + "=" * 80)
        
        # Return overall success status
        return passed_tests == total_tests

if __name__ == "__main__":
    tester = BackendTester()
    success = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)