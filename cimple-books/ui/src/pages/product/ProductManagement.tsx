import { useState } from 'react';
import { Package, FolderTree } from 'lucide-react';
import CategoryList from './CategoryList';
import ProductList from './ProductList';

const ProductManagement = () => {
    const [activeTab, setActiveTab] = useState<'categories' | 'products'>('categories');

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">Inventory</h1>
                    <p className="text-gray-600 mt-1">Manage categories and products</p>
                </div>

                {/* Tabs */}
                <div className="bg-white rounded-lg shadow mb-6">
                    <div className="border-b border-gray-200">
                        <nav className="flex -mb-px">
                            <button
                                onClick={() => setActiveTab('categories')}
                                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                                    activeTab === 'categories'
                                        ? 'border-blue-600 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                            >
                                <FolderTree className="w-5 h-5" />
                                Categories
                            </button>
                            <button
                                onClick={() => setActiveTab('products')}
                                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                                    activeTab === 'products'
                                        ? 'border-blue-600 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                            >
                                <Package className="w-5 h-5" />
                                Products
                            </button>
                        </nav>
                    </div>

                    {/* Tab Content */}
                    <div className="p-6">
                        {activeTab === 'categories' ? <CategoryList /> : <ProductList />}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProductManagement;

