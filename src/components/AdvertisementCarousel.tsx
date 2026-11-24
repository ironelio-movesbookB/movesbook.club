'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Advertisement {
  id: number;
  title: string;
  description: string;
  image: string;
  ctaText: string;
  ctaLink: string;
}

const advertisements: Advertisement[] = [
  {
    id: 1,
    title: "Premium Workout Gear",
    description: "Get 20% off on all premium workout equipment this month!",
    image: "/images/ads/workout-gear.jpg",
    ctaText: "Shop Now",
    ctaLink: "#"
  },
  {
    id: 2,
    title: "Personal Training",
    description: "Book a session with our certified personal trainers.",
    image: "/images/ads/personal-training.jpg",
    ctaText: "Learn More",
    ctaLink: "#"
  },
  {
    id: 3,
    title: "Nutrition Plans",
    description: "Customized nutrition plans to complement your training.",
    image: "/images/ads/nutrition.jpg",
    ctaText: "Get Plan",
    ctaLink: "#"
  }
];

export default function AdvertisementCarousel() {
  const [currentAd, setCurrentAd] = useState(0);

  const nextAd = () => {
    setCurrentAd((prev) => (prev + 1) % advertisements.length);
  };

  const prevAd = () => {
    setCurrentAd((prev) => (prev - 1 + advertisements.length) % advertisements.length);
  };

  useEffect(() => {
    const interval = setInterval(nextAd, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full h-64 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl overflow-hidden shadow-lg">
      {/* Background Image */}
      <div className="absolute inset-0 bg-black bg-opacity-30"></div>
      
      {/* Content */}
      <div className="relative z-10 h-full flex items-center justify-between p-8 text-white">
        {/* Ad Content */}
        <div className="flex-1">
          <h2 className="text-2xl font-bold mb-2">{advertisements[currentAd].title}</h2>
          <p className="text-lg mb-4 opacity-90">{advertisements[currentAd].description}</p>
          <button className="bg-white text-blue-600 px-6 py-2 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
            {advertisements[currentAd].ctaText}
          </button>
        </div>

        {/* Navigation */}
        <div className="flex space-x-2">
          <button
            onClick={prevAd}
            className="p-2 bg-white bg-opacity-20 rounded-full hover:bg-opacity-30 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={nextAd}
            className="p-2 bg-white bg-opacity-20 rounded-full hover:bg-opacity-30 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Indicators */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
        {advertisements.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentAd(index)}
            className={`w-3 h-3 rounded-full transition-colors ${
              index === currentAd ? 'bg-white' : 'bg-white bg-opacity-50'
            }`}
          />
        ))}
      </div>
    </div>
  );
}