'use client';

import { useState } from 'react';
import ModernNavbar from '@/components/ModernNavbar';
import ModernFooter from '@/components/ModernFooter';
import AdminLoginModal from '@/components/AdminLoginModal';
import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';


// Sample data for image cards
const sportsCategories = [
  {
    id: 1,
    title: 'Swimming',
    description: 'Swimming',
    image: '/images/sports/swimming.jpg',
    count: '120+ Workouts'
  },
  {
    id: 2,
    title: 'Running',
    description: 'Running',
    image: '/images/sports/running.png',
    count: '85+ Programs'
  },
  {
    id: 3,
    title: 'Cycling',
    description: 'Cycling',
    image: '/images/sports/cycling.jpg',
    count: '65+ Sessions'
  },
  {
    id: 4,
    title: 'Weight Training',
    description: 'Yoga',
    image: '/images/sports/yoga.jpg',
    count: '200+ Exercises'
  },
  {
    id: 5,
    title: 'Yoga & Flexibility',
    description: 'Marching',
    image: '/images/sports/Marching.jpg',
    count: '90+ Routines'
  },
  {
    id: 6,
    title: 'Cross Training',
    description: 'Mixed discipline fitness programs',
    image: '/images/sports/skateboarding.jpg',
    count: '150+ Workouts'
  },
];

const newsArticles = [
  {
    id: 1,
    title: 'New Study Shows Benefits of Morning Workouts',
    excerpt: 'Research indicates morning exercise can boost metabolism throughout the day...',
    image: '/images/news/morning-workout.jpg',
    date: 'Dec 15, 2024',
    category: 'Research'
  },
  {
    id: 2,
    title: 'Top 5 Nutrition Tips for Athletes',
    excerpt: 'Learn how proper nutrition can enhance your performance and recovery...',
    image: '/images/news/nutrition-tips.jpg',
    date: 'Dec 12, 2024',
    category: 'Nutrition'
  },
  {
    id: 3,
    title: 'Winter Training Gear Guide',
    excerpt: 'Essential equipment and clothing for cold weather workouts...',
    image: '/images/news/winter-gear.jpg',
    date: 'Dec 10, 2024',
    category: 'Gear'
  },
];

const shoppingItems = [
  {
    id: 1,
    name: 'Pro Fitness Tracker',
    price: '$199.99',
    originalPrice: '$249.99',
    image: '/images/shopping/fitness-tracker.jpg',
    rating: 4.8,
    reviews: 1247
  },
  {
    id: 2,
    name: 'Premium Yoga Mat',
    price: '$89.99',
    originalPrice: '$119.99',
    image: '/images/shopping/yoga-mat.jpg',
    rating: 4.9,
    reviews: 892
  },
  {
    id: 3,
    name: 'Wireless Earbuds Pro',
    price: '$159.99',
    originalPrice: '$199.99',
    image: '/images/shopping/earbuds.jpg',
    rating: 4.7,
    reviews: 2156
  },
  {
    id: 4,
    name: 'Hydration Pack',
    price: '$49.99',
    originalPrice: '$69.99',
    image: '/images/shopping/hydration-pack.jpg',
    rating: 4.6,
    reviews: 567
  },
];

// Icons for features
const FeatureIcons = {
  Calendar: ({ className }: { className?: string }) => (
    <svg className={className || "w-10 h-10"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  Chart: ({ className }: { className?: string }) => (
    <svg className={className || "w-10 h-10"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  Users: ({ className }: { className?: string }) => (
    <svg className={className || "w-10 h-10"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
    </svg>
  ),
  Target: ({ className }: { className?: string }) => (
    <svg className={className || "w-10 h-10"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
};

function getFeaturesForUserType(userType: string) {
  const features = {
    athlete: [
      {
        icon: FeatureIcons.Calendar,
        title: 'Personal Workout Planning',
        description: 'Create and manage your personal workout schedules with detailed moveframes and repetitions. Track your progress and achieve your fitness goals with our comprehensive planning tools.'
      },
      {
        icon: FeatureIcons.Chart,
        title: 'Progress Tracking & Analytics',
        description: 'Monitor your performance across all sports activities with detailed analytics and progress reports. Visualize your improvements over time and optimize your training strategy.'
      }
    ],
    coach: [
      {
        icon: FeatureIcons.Users,
        title: 'Athlete Management System',
        description: 'Efficiently manage multiple athletes, assign customized workouts, and track their progress all in one centralized platform. Streamline your coaching workflow.'
      },
      {
        icon: FeatureIcons.Calendar,
        title: 'Workout Assignment & Scheduling',
        description: 'Create and assign personalized workout plans to your athletes with detailed instructions, schedules, and performance targets. Monitor completion and provide feedback.'
      }
    ],
    team: [
      {
        icon: FeatureIcons.Users,
        title: 'Team Coordination Platform',
        description: 'Coordinate workouts and training schedules for your entire team efficiently. Manage group sessions and individual training plans while fostering team spirit.'
      },
      {
        icon: FeatureIcons.Target,
        title: 'Team Goals & Performance',
        description: 'Set and track team objectives with collective workout plans and comprehensive performance metrics. Analyze team progress and celebrate achievements together.'
      }
    ],
    group: [
      {
        icon: FeatureIcons.Users,
        title: 'Group Activity Management',
        description: 'Organize and manage group fitness activities with ease. Coordinate schedules, track participation, and create a collaborative training environment for all members.'
      },
      {
        icon: FeatureIcons.Calendar,
        title: 'Shared Workout Plans',
        description: 'Create and share workout plans within your group. Foster motivation through collective goals and shared progress tracking with real-time updates.'
      }
    ],
    club: [
      {
        icon: FeatureIcons.Users,
        title: 'Club Management Hub',
        description: 'Manage multiple teams and trainers within your club with centralized control. Streamline operations, coordinate schedules, and enhance overall club coordination.'
      },
      {
        icon: FeatureIcons.Chart,
        title: 'Performance Analytics Suite',
        description: 'Analyze club-wide performance data and optimize training programs. Make data-driven decisions for better results across all teams and individual athletes.'
      }
    ]
  };

  return features[userType as keyof typeof features] || features.athlete;
}

export default function HomePage() {
  const { t } = useLanguage();
  const [userType, setUserType] = useState<'athlete' | 'coach' | 'team' | 'group' | 'club'>('athlete');
  const [showAdminModal, setShowAdminModal] = useState(false);
  const { requireAuth } = useAuth();

  // Check URL parameters for admin modal
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('showAdmin') === 'true') {
      setShowAdminModal(true);
    }
  }, []);

  const handleLoginClick = () => {
    // Redirect to /login page instead of showing modal
    window.location.href = '/login';
  };

  const handleAdminClick = () => {
    setShowAdminModal(true);
  };

  const handleProtectedLinkClick = (href: string) => {
    if (!requireAuth(href)) {
      return false;
    }
    return true;
  };

  return (
    <div className="min-h-screen flex flex-col">
      <ModernNavbar 
        onLoginClick={handleLoginClick}
        onAdminClick={handleAdminClick}
      />

      {/* Admin Login Modal */}
      <AdminLoginModal 
        isOpen={showAdminModal}
        onClose={() => setShowAdminModal(false)}
        onSwitchToUserLogin={() => window.location.href = '/login'}
      />

      {/* Hero Section */}
      <div 
        className="relative bg-cover bg-center bg-fixed bg-no-repeat flex-1"
        style={{ 
          backgroundImage: "url('/images/dashboard_2.jpg')",
        }}
      >
        <div className="absolute inset-0 bg-black bg-opacity-50"></div>

        <div className="relative z-10 py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16 text-white">
              <h1 className="text-5xl md:text-7xl font-bold mb-6 drop-shadow-2xl">
                {t('home_title_professional')}
                <span className="text-blue-300"> {t('home_title_workout')}</span>
              </h1>
              <p className="text-2xl md:text-3xl mb-8 max-w-4xl mx-auto drop-shadow-lg opacity-95 leading-relaxed">
                {t('home_subtitle')}
              </p>
              
              {/* User Type Selection */}
              <div className="flex justify-center space-x-4 mb-12 flex-wrap gap-4">
                {[
                  { id: 'athlete' as const, label: t('user_type_athlete') },
                  { id: 'coach' as const, label: t('user_type_coach') },
                  { id: 'team' as const, label: t('user_type_team') },
                  { id: 'group' as const, label: t('user_type_group') },
                  { id: 'club' as const, label: t('user_type_club') }
                ].map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setUserType(type.id)}
                    className={`px-8 py-4 rounded-xl font-semibold transition-all duration-300 backdrop-blur-sm border-2 ${
                      userType === type.id
                        ? 'bg-blue-600 text-white shadow-2xl transform scale-105 border-blue-400'
                        : 'bg-white bg-opacity-15 text-white shadow-lg hover:bg-opacity-25 border-white border-opacity-30'
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>

              {/* Features Grid */}
              <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
                {getFeaturesForUserType(userType).map((feature, index) => (
                  <div key={index} className="bg-white bg-opacity-10 backdrop-blur-xl p-8 rounded-2xl shadow-2xl border border-white border-opacity-20 hover:bg-opacity-20 transition-all duration-500 hover:scale-105">
                    <div className="w-20 h-20 bg-blue-500 bg-opacity-60 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                      {(() => {
                        const Icon = feature.icon;
                        return <Icon className="w-10 h-10 text-white" />;
                      })()}
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-4 text-center">
                      {feature.title}
                    </h3>
                    <p className="text-blue-100 text-lg leading-relaxed text-center">{feature.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Image Cards Sections */}
      <div className="bg-gray-50 dark:bg-gray-900 transition-colors">
        {/* Sports Categories */}
        <section className="py-16 bg-white dark:bg-gray-800 transition-colors">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">{t('home_sports_categories')}</h2>
              <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                {t('home_sports_subtitle')}
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {sportsCategories.map((sport) => (
                <div key={sport.id} className="bg-white dark:bg-gray-700 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 overflow-hidden group">
                  <div className="h-48 bg-gradient-to-br from-blue-400 to-purple-500 relative overflow-hidden">
                    <div className="absolute inset-0 bg-black bg-opacity-20 group-hover:bg-opacity-10 transition-opacity"></div>
                    <div className="absolute bottom-4 left-4">
                      <span className="bg-white dark:bg-gray-800 bg-opacity-90 dark:bg-opacity-90 text-gray-800 dark:text-gray-200 px-3 py-1 rounded-full text-sm font-medium">
                        {sport.count}
                      </span>
                    </div>
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 text-center">{sport.title}</h3>
                    <p className="text-gray-600 dark:text-gray-300 mb-4 text-center">{sport.description}</p>
                    <button className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white py-3 rounded-xl font-semibold hover:from-blue-600 hover:to-purple-600 transition-all duration-200 text-center">
                      {t('home_explore_programs')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Latest News */}
        <section className="py-16 bg-gray-50 dark:bg-gray-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">{t('home_latest_news')}</h2>
              <p className="text-xl text-gray-600 dark:text-gray-300 text-center">{t('home_news_subtitle')}</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {newsArticles.map((article) => (
                <div key={article.id} className="bg-white dark:bg-gray-700 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group">
                  <div className="h-48 bg-gradient-to-br from-green-400 to-blue-500 relative overflow-hidden">
                    <div className="absolute inset-0 bg-black bg-opacity-20 group-hover:bg-opacity-10 transition-opacity"></div>
                    <div className="absolute top-4 left-4">
                      <span className="bg-white dark:bg-gray-800 bg-opacity-90 dark:bg-opacity-90 text-gray-800 dark:text-gray-200 px-3 py-1 rounded-full text-sm font-medium">
                        {article.category}
                      </span>
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="flex items-center text-sm text-gray-500 mb-3 justify-center">
                      <span>{article.date}</span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3 group-hover:text-blue-600 transition-colors text-center">
                      {article.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300 mb-4 text-center">{article.excerpt}</p>
                    <div className="flex justify-center">
                      <button className="text-blue-600 font-semibold hover:text-blue-700 transition-colors flex items-center">
                        {t('home_read_more')}
                        <span className="ml-2 transform group-hover:translate-x-1 transition-transform">→</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Shopping Items */}
        <section className="py-16 bg-white dark:bg-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">{t('home_featured_products')}</h2>
              <p className="text-xl text-gray-600 dark:text-gray-300 text-center">{t('home_products_subtitle')}</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {shoppingItems.map((product) => (
                <div key={product.id} className="bg-white dark:bg-gray-700 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 overflow-hidden group">
                  <div className="h-48 bg-gradient-to-br from-orange-400 to-red-500 relative overflow-hidden">
                    <div className="absolute inset-0 bg-black bg-opacity-20 group-hover:bg-opacity-10 transition-opacity"></div>
                    <div className="absolute top-4 right-4">
                      <span className="bg-red-500 text-white px-2 py-1 rounded text-sm font-bold">
                        SALE
                      </span>
                    </div>
                  </div>
                  <div className="p-6">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 text-center">{product.name}</h3>
                    <div className="flex items-center mb-3 justify-center">
                      <div className="flex text-yellow-400 mr-2">
                        {'★'.repeat(Math.floor(product.rating))}
                        <span className="text-gray-300">
                          {'★'.repeat(5 - Math.floor(product.rating))}
                        </span>
                      </div>
                      <span className="text-sm text-gray-500">({product.reviews})</span>
                    </div>
                    <div className="flex items-center space-x-2 mb-4 justify-center">
                      <span className="text-2xl font-bold text-gray-900 dark:text-white">{product.price}</span>
                      <span className="text-lg text-gray-500 line-through">{product.originalPrice}</span>
                    </div>
                    <button className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-3 rounded-xl font-semibold hover:from-orange-600 hover:to-red-600 transition-all duration-200 transform hover:scale-105 text-center">
                      Add to Cart
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <ModernFooter />
    </div>
  );
}