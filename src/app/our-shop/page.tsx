'use client';

import { ShoppingBag } from 'lucide-react';

export default function OurShopPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-cyan-400 to-purple-500 rounded-2xl flex items-center justify-center shadow-2xl">
              <ShoppingBag className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent mb-4">
            Our Shop
          </h1>
          <p className="text-cyan-200 text-lg">
            Browse our exclusive collection of sports gear
          </p>
        </div>
        
        <div className="bg-white bg-opacity-10 backdrop-blur-lg rounded-3xl p-8 border border-cyan-500 border-opacity-30">
          <p className="text-white text-center text-lg">
            Our Shop page content coming soon...
          </p>
        </div>
      </div>
    </div>
  );
}

