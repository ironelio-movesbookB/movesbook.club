import { UserCircle, HelpCircle, Settings, Home, Menu, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import MyPageFastMenu from '@/components/my-page/MyPageFastMenu';
import MubBannerStripControl from '@/components/mub/MubBannerStripControl';

interface PersonalBannerProps {
  user: any;
  currentTab: 'my-page' | 'my-entity'
}

export default function PersonalBanner({ user, currentTab }: PersonalBannerProps) {
  const router = useRouter();
  return (
    <div className="mb-6 flex-shrink-0 px-4">
      <div className="bg-gray-800 rounded-lg overflow-hidden shadow-lg relative">
        {/* Background image with overlay */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30"
          style={{
            backgroundImage: 'url(/images/banner.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        ></div>

        <div className="flex items-center justify-between px-4 py-3 text-sm relative z-10">
          {/* Left side - Profile Picture, FAQ and Most used buttons */}
          <div className="flex items-center gap-4">
            {/* Profile Picture */}
            <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
              {user ? (
                <UserCircle className="w-8 h-8 text-lime-400" />
              ) : (
                <UserCircle className="w-8 h-8 text-gray-400" />
              )}
            </div>
            <div className="flex items-center gap-6">
              <button className="text-lime-400 hover:text-lime-300 transition-colors flex items-center gap-2">
                <HelpCircle className="w-4 h-4" />
                <span>FAQ Suggest Movesbook</span>
              </button>
              <MubBannerStripControl />
            </div>
          </div>

          {/* Center - Navigation items */}
          <div className="flex items-center gap-4">
            <button className="text-gray-300 hover:text-white transition-colors flex items-center gap-2">
              <Home className="w-4 h-4" />
              <span>Home</span>
            </button>
            <button className="text-gray-300 hover:text-white transition-colors flex items-center gap-2">
              <Menu className="w-4 h-4" />
              <span>Overview</span>
            </button>
            <button className="text-gray-300 hover:text-white transition-colors">
              <span>Myworkout Section</span>
            </button>
            <button className="text-gray-300 hover:text-white transition-colors">
              <span>My Social Activities</span>
            </button>
            <button className="text-gray-300 hover:text-white transition-colors">
              <span>My Social Area</span>
            </button>
            <button className="text-gray-300 hover:text-white transition-colors">
              <span>My Internet Links</span>
            </button>
            <button className="text-gray-300 hover:text-white transition-colors">
              <span>Socials</span>
            </button>
            <button className="text-gray-300 hover:text-white transition-colors">
              <span>My Desk</span>
            </button>
          </div>

          {/* Right side — Fast menu + search */}
          <div className="flex items-center gap-3">
            {currentTab === 'my-page' ? <MyPageFastMenu /> : null}
            {currentTab == 'my-entity' ?
              <button
                className="text-orange-300 hover:text-white transition-colors px-4 py-2"
                onClick={() => router.push('/clubMembers/memberList')}
              >
                Club Management
              </button> : <></>
            }

            <button className="bg-red-700 hover:bg-red-800 text-lime-400 px-4 py-2 rounded transition-colors flex items-center gap-2">
              <span>Search in the Network</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

