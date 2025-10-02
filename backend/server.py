from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import bcrypt
import jwt
from enum import Enum

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer(auto_error=False)
JWT_SECRET = "nike-store-secret-key-2025"

# Enums
class ProductCategory(str, Enum):
    shoes = "shoes"
    clothing = "clothing"
    accessories = "accessories"

class OrderStatus(str, Enum):
    pending = "pending"
    confirmed = "confirmed"
    shipped = "shipped"
    delivered = "delivered"

# Pydantic Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    full_name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    email: str
    password: str
    full_name: str

class UserLogin(BaseModel):
    email: str
    password: str

class Product(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    price: float
    category: ProductCategory
    images: List[str]
    sizes: List[str]
    colors: List[str]
    stock: int
    featured: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProductCreate(BaseModel):
    name: str
    description: str
    price: float
    category: ProductCategory
    images: List[str]
    sizes: List[str]
    colors: List[str]
    stock: int
    featured: bool = False

class CartItem(BaseModel):
    product_id: str
    quantity: int
    size: str
    color: str

class Cart(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    items: List[CartItem]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Order(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    items: List[CartItem]
    total_amount: float
    status: OrderStatus
    shipping_address: str
    payment_intent_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class OrderCreate(BaseModel):
    items: List[CartItem]
    shipping_address: str

# Helper functions
def create_access_token(user_id: str):
    payload = {"user_id": user_id, "exp": datetime.now(timezone.utc).timestamp() + 86400}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        return None
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("user_id")
        if not user_id:
            return None
        user_data = await db.users.find_one({"id": user_id})
        return User(**user_data) if user_data else None
    except:
        return None

def prepare_for_mongo(data):
    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, datetime):
                data[key] = value.isoformat()
    return data

# Auth Routes
@api_router.post("/auth/register")
async def register(user_data: UserCreate):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Hash password
    password_hash = bcrypt.hashpw(user_data.password.encode('utf-8'), bcrypt.gensalt())
    
    # Create user
    user = User(email=user_data.email, full_name=user_data.full_name)
    user_dict = prepare_for_mongo(user.dict())
    user_dict["password_hash"] = password_hash.decode('utf-8')
    
    await db.users.insert_one(user_dict)
    
    # Create access token
    token = create_access_token(user.id)
    
    return {"user": user, "token": token}

@api_router.post("/auth/login")
async def login(login_data: UserLogin):
    # Find user
    user_data = await db.users.find_one({"email": login_data.email})
    if not user_data:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Check password
    if not bcrypt.checkpw(login_data.password.encode('utf-8'), user_data["password_hash"].encode('utf-8')):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    user = User(**user_data)
    token = create_access_token(user.id)
    
    return {"user": user, "token": token}

@api_router.get("/auth/me")
async def get_me(current_user: User = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return current_user

# Product Routes
@api_router.get("/products", response_model=List[Product])
async def get_products(category: Optional[ProductCategory] = None, featured: Optional[bool] = None):
    filter_query = {}
    if category:
        filter_query["category"] = category
    if featured is not None:
        filter_query["featured"] = featured
    
    products = await db.products.find(filter_query).to_list(1000)
    return [Product(**product) for product in products]

@api_router.get("/products/{product_id}", response_model=Product)
async def get_product(product_id: str):
    product = await db.products.find_one({"id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return Product(**product)

@api_router.post("/products", response_model=Product)
async def create_product(product_data: ProductCreate):
    product = Product(**product_data.dict())
    product_dict = prepare_for_mongo(product.dict())
    await db.products.insert_one(product_dict)
    return product

# Cart Routes
@api_router.get("/cart")
async def get_cart(current_user: User = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    cart = await db.carts.find_one({"user_id": current_user.id})
    if not cart:
        # Create empty cart
        new_cart = Cart(user_id=current_user.id, items=[])
        cart_dict = prepare_for_mongo(new_cart.dict())
        await db.carts.insert_one(cart_dict)
        return new_cart
    
    return Cart(**cart)

@api_router.post("/cart/add")
async def add_to_cart(cart_item: CartItem, current_user: User = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Get or create cart
    cart = await db.carts.find_one({"user_id": current_user.id})
    if not cart:
        cart = Cart(user_id=current_user.id, items=[])
        cart_dict = prepare_for_mongo(cart.dict())
        await db.carts.insert_one(cart_dict)
    else:
        cart = Cart(**cart)
    
    # Check if item already exists
    existing_item = None
    for item in cart.items:
        if (item.product_id == cart_item.product_id and 
            item.size == cart_item.size and 
            item.color == cart_item.color):
            existing_item = item
            break
    
    if existing_item:
        existing_item.quantity += cart_item.quantity
    else:
        cart.items.append(cart_item)
    
    cart.updated_at = datetime.now(timezone.utc)
    
    # Update in database
    cart_dict = prepare_for_mongo(cart.dict())
    await db.carts.update_one(
        {"user_id": current_user.id}, 
        {"$set": cart_dict}, 
        upsert=True
    )
    
    return {"message": "Item added to cart", "cart": cart}

@api_router.delete("/cart/remove/{product_id}")
async def remove_from_cart(product_id: str, current_user: User = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    cart = await db.carts.find_one({"user_id": current_user.id})
    if not cart:
        raise HTTPException(status_code=404, detail="Cart not found")
    
    cart = Cart(**cart)
    cart.items = [item for item in cart.items if item.product_id != product_id]
    cart.updated_at = datetime.now(timezone.utc)
    
    cart_dict = prepare_for_mongo(cart.dict())
    await db.carts.update_one({"user_id": current_user.id}, {"$set": cart_dict})
    
    return {"message": "Item removed from cart", "cart": cart}

# Order Routes
@api_router.post("/orders", response_model=Order)
async def create_order(order_data: OrderCreate, current_user: User = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Calculate total
    total_amount = 0.0
    for item in order_data.items:
        product = await db.products.find_one({"id": item.product_id})
        if product:
            total_amount += product["price"] * item.quantity
    
    # Create order
    order = Order(
        user_id=current_user.id,
        items=order_data.items,
        total_amount=total_amount,
        status=OrderStatus.pending,
        shipping_address=order_data.shipping_address,
        payment_intent_id=f"pi_{uuid.uuid4()}"  # Mock payment intent
    )
    
    order_dict = prepare_for_mongo(order.dict())
    await db.orders.insert_one(order_dict)
    
    # Clear cart
    await db.carts.update_one(
        {"user_id": current_user.id}, 
        {"$set": {"items": [], "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return order

@api_router.get("/orders", response_model=List[Order])
async def get_orders(current_user: User = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    orders = await db.orders.find({"user_id": current_user.id}).to_list(1000)
    return [Order(**order) for order in orders]

# Initialize sample data
@api_router.post("/init-data")
async def initialize_sample_data():
    # Check if products already exist
    existing_products = await db.products.count_documents({})
    if existing_products > 0:
        return {"message": "Sample data already exists"}
    
    # Sample products
    sample_products = [
        {
            "name": "Nike Air Force 1 '07",
            "description": "The radiance lives on in the Nike Air Force 1 '07, the basketball original that puts a fresh spin on what you know best: durably stitched overlays, clean finishes and the perfect amount of flash.",
            "price": 90.0,
            "category": "shoes",
            "images": [
                "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDN8MHwxfHNlYXJjaHwxfHxzbmVha2Vyc3xlbnwwfHx8fDE3NTkzMzc0MjN8MA&ixlib=rb-4.1.0&q=85",
                "https://images.unsplash.com/photo-1542291026-7eec264c27ff?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Nzd8MHwxfHNlYXJjaHwzfHxuaWtlJTIwc2hvZXN8ZW58MHx8fHwxNzU5NDAyMzE2fDA&ixlib=rb-4.1.0&q=85"
            ],
            "sizes": ["7", "7.5", "8", "8.5", "9", "9.5", "10", "10.5", "11", "11.5", "12"],
            "colors": ["White", "Black", "Red"],
            "stock": 50,
            "featured": True
        },
        {
            "name": "Nike Legend Essential 2",
            "description": "Comfortable, versatile and durable, the Nike Legend Essential 2 is perfect for circuit training, light running or any other workout you have in mind.",
            "price": 60.0,
            "category": "shoes",
            "images": [
                "https://images.unsplash.com/photo-1605408499391-6368c628ef42?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Nzd8MHwxfHNlYXJjaHwxfHxuaWtlJTIwc2hvZXN8ZW58MHx8fHwxNzU5NDAyMzE2fDA&ixlib=rb-4.1.0&q=85"
            ],
            "sizes": ["6", "6.5", "7", "7.5", "8", "8.5", "9", "9.5", "10"],
            "colors": ["Black", "Pink", "Blue"],
            "stock": 30,
            "featured": True
        },
        {
            "name": "Nike Dri-FIT Shirt",
            "description": "The Nike Dri-FIT Shirt helps you stay dry and comfortable with sweat-wicking fabric in a comfortable fit.",
            "price": 25.0,
            "category": "clothing",
            "images": [
                "https://images.unsplash.com/photo-1562157873-818bc0726f68?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDN8MHwxfHNlYXJjaHw0fHxhcHBhcmVsfGVufDB8fHx8MTc1OTMzNzQ3N3ww&ixlib=rb-4.1.0&q=85"
            ],
            "sizes": ["S", "M", "L", "XL", "XXL"],
            "colors": ["Blue", "Red", "Green", "Black", "White"],
            "stock": 100,
            "featured": False
        },
        {
            "name": "Nike Air Jordan 1",
            "description": "The Air Jordan 1 Retro High OG remains true to its original DNA with premium materials and Nike Air cushioning.",
            "price": 170.0,
            "category": "shoes",
            "images": [
                "https://images.unsplash.com/photo-1552346154-21d32810aba3?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDN8MHwxfHNlYXJjaHwzfHxzbmVha2Vyc3xlbnwwfHx8fDE3NTkzMzc0MjN8MA&ixlib=rb-4.1.0&q=85"
            ],
            "sizes": ["7", "7.5", "8", "8.5", "9", "9.5", "10", "10.5", "11", "11.5", "12"],
            "colors": ["Black/Red", "White/Black"],
            "stock": 25,
            "featured": True
        },
        {
            "name": "Nike Sportswear Hoodie",
            "description": "The Nike Sportswear Club Fleece Hoodie is made from soft fleece with a spacious fit for an elevated look that's comfortable all day.",
            "price": 55.0,
            "category": "clothing",
            "images": [
                "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDN8MHwxfHNlYXJjaHw1fHxhcHBhcmVsfGVufDB8fHx8MTc1OTMzNzQ3N3ww&ixlib=rb-4.1.0&q=85"
            ],
            "sizes": ["S", "M", "L", "XL", "XXL"],
            "colors": ["Black", "Grey", "Navy", "Red"],
            "stock": 75,
            "featured": False
        },
        {
            "name": "Nike SuperRep Go",
            "description": "Perfect for circuit training and HIIT workouts, the Nike SuperRep Go offers stability and flexibility for every movement.",
            "price": 80.0,
            "category": "shoes",
            "images": [
                "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Nzd8MHwxfHNlYXJjaHwyfHxuaWtlJTIwc2hvZXN8ZW58MHx8fHwxNzU5NDAyMzE2fDA&ixlib=rb-4.1.0&q=85"
            ],
            "sizes": ["6", "6.5", "7", "7.5", "8", "8.5", "9", "9.5", "10", "10.5"],
            "colors": ["Green", "Black", "White"],
            "stock": 40,
            "featured": False
        }
    ]
    
    # Create products
    for product_data in sample_products:
        product = Product(**product_data)
        product_dict = prepare_for_mongo(product.dict())
        await db.products.insert_one(product_dict)
    
    return {"message": "Sample data initialized successfully"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()