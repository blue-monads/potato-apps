import { useState } from 'react';
import { Package, FolderTree } from 'lucide-react';
import CategoryList from './CategoryList';
import ProductList from './ProductList';

const ProductManagement = () => {
    const [activeTab, setActiveTab] = useState<'products' | 'categories'>('products');

    return (
        <div className="min-h-screen bg-[#F4F5F1] p-6 lg:p-8 font-sans">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl lg:text-3xl font-bold text-stone-900 font-display">Inventory & Catalogue</h1>
                    <p className="text-stone-500 mt-1 text-sm">Manage products, variants, pricing, pictures, and categories</p>
                </div>

                {/* Tabs */}
                <div className="bg-white rounded-xl border border-[#E1E3DB] shadow-sm mb-6 overflow-hidden">
                    <div className="border-b border-[#E1E3DB] bg-[#FAFBF9] px-6">
                        <nav className="flex -mb-px gap-6">
                            <button
                                onClick={() => setActiveTab('products')}
                                className={`flex items-center gap-2 py-4 text-sm font-semibold border-b-2 transition-colors ${
                                    activeTab === 'products'
                                        ? 'border-[#2E6E52] text-[#2E6E52]'
                                        : 'border-transparent text-stone-500 hover:text-stone-700 hover:border-stone-300'
                                }`}
                            >
                                <Package className="w-4 h-4" />
                                Products & Variants
                            </button>
                            <button
                                onClick={() => setActiveTab('categories')}
                                className={`flex items-center gap-2 py-4 text-sm font-semibold border-b-2 transition-colors ${
                                    activeTab === 'categories'
                                        ? 'border-[#2E6E52] text-[#2E6E52]'
                                        : 'border-transparent text-stone-500 hover:text-stone-700 hover:border-stone-300'
                                }`}
                            >
                                <FolderTree className="w-4 h-4" />
                                Categories
                            </button>
                        </nav>
                    </div>

                    {/* Tab Content */}
                    <div className="p-6">
                        {activeTab === 'products' ? <ProductList /> : <CategoryList />}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProductManagement;
