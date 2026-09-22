'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  Tag, 
  ChevronDown, 
  ChevronRight,
  User, 
  Users, 
  Headphones, 
  Layers, 
  CheckSquare, 
  Package, 
  Settings, 
  Sliders, 
  LayoutTemplate, 
  Image, 
  MessageSquare, 
  Mail,
  Lock,
  FileText,
  HelpCircle,
  Globe,
  Edit,
  ShoppingCart,
  Star,
  Monitor,
  Dumbbell,
  Shirt,
  Utensils,
  Share2,
  Briefcase,
  Smartphone,
  Flag,
  Languages,
  Database,
  Key,
  LogOut,
  Trash2,
  UserCircle,
  ShoppingBasket,
  Truck,
  Badge,
  Radio,
  QrCode,
  CreditCard,
  Triangle,
  Gift,
  Users2
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Define types for sidebar items
interface SidebarItemType {
  label: string;
  icon?: any;
  hasLock?: boolean;
  hasSubmenu?: boolean;
  subItems?: SidebarItemType[];
  href?: string;
  id?: string;
}

interface SidebarSectionType {
  id: string;
  label: string;
  items: SidebarItemType[];
}

function SortableItem(props: { id: string, children: React.ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: props.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="mb-[1px]">
      {props.children}
    </div>
  );
}

interface SystemDashboardSidebarProps {
  isOpen?: boolean;
  onToggle?: () => void;
}

const SystemDashboardSidebarContent = ({ isOpen, onToggle }: SystemDashboardSidebarProps) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const foodsPanelActive =
    searchParams?.get('panel') === 'foods-and-dishes' || searchParams?.get('panel') === 'foods';
  const subscriptionUserType = searchParams?.get('userType');
  const isSubscriptionRoute = pathname?.startsWith('/subscriptions');

  const [internalIsOpen, setInternalIsOpen] = useState(true);
  const isSidebarOpen = isOpen !== undefined ? isOpen : internalIsOpen;
  // State for open sections (main categories)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    staff: true,
    subscriptions: true,
    system: true,
    messages: true,
    infos: false,
    faqs: false,
    html: false,
    promotions: false,
    settings_users: false,
    technical: false,
    general: false,
    management: false,
    apps: false,
    countries: false,
    operative: false,
    passwords: false,
    other: false,
    club_options: false,
    friends: false
  });

  // State for open sub-sections (nested menus)
  const [openSubSections, setOpenSubSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (foodsPanelActive) {
      setOpenSections((prev) => ({ ...prev, general: true }));
    }
  }, [foodsPanelActive]);

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleSubSection = (subSection: string) => {
    setOpenSubSections(prev => ({ ...prev, [subSection]: !prev[subSection] }));
  };

  // Define the sidebar data structure based on PHP implementation
  const [sidebarData, setSidebarData] = useState<SidebarSectionType[]>([
    {
      id: 'staff',
      label: 'Staff enabled',
      items: [
        { label: 'Super Admin', icon: User, href: '/settings/admin-management' },
        { label: 'All staff', icon: Users2, href: '/admin/all-staff' },
        { label: 'Co-administrators', icon: Users, href: '/operators/usersAssignedStaff' },
        { label: 'Operators', icon: Headphones, href: '/operators' }
      ]
    },
    {
      id: 'subscriptions',
      label: 'Subscriptions',
      items: [
        { label: 'Versions', icon: Layers, href: '/subscriptions/subscription_settings' },
        { label: 'Functions enabled', icon: CheckSquare, href: '/subscriptions/function_settings/1' },
        { label: 'Packages infos', icon: Package, href: '/subscriptions/package/5/en' },
        { label: 'Other Settings', icon: Settings }
      ]
    },
    {
      id: 'club_options',
      label: 'Club options',
      items: [
        { label: 'Club accounts', icon: UserCircle, href: '/admin/club-accounts' },
        { 
          label: 'Accounts', 
          icon: UserCircle,
          hasSubmenu: true,
          id: 'club_accounts',
          subItems: [
            { label: 'Price list', href: '/admin/accounts/price-list' },
            { label: 'Requests of accounts', href: '/admin/accounts/requests' }
          ]
        },
        { label: 'Identification cards', icon: ShoppingBasket, href: '/admin/identification-cards' },
        { label: 'Products purchased', icon: ShoppingBasket, href: '/admin/products-purchased' },
        { label: 'Order purchased', icon: Truck, href: '/admin/orders' },
        {
          label: 'Hardware',
          icon: Smartphone,
          hasSubmenu: true,
          id: 'club_hardware',
          subItems: [
            { label: 'Badges', href: '/admin/cards/badges/list' },
            { label: 'Rfids', href: '/admin/cards/rfids/list' },
            { label: 'QR Codes', href: '/admin/cards/qr-codes/list' },
            { label: 'Smartcards', href: '/admin/cards/smartcards/list' },
            { label: 'Hardware', href: '/admin/cards/hardware/list' }
          ]
        }
      ]
    },
    {
      id: 'friends',
      label: 'Friends',
      items: [
        { label: 'Online friends', icon: Users, href: '/admin/friends/online' },
        { label: 'Categories of friends', icon: Users, href: '/admin/friends/categories' }
      ]
    },
    {
      id: 'system',
      label: 'System mainpage',
      items: [
        {
          label: 'General',
          icon: Sliders,
          hasSubmenu: true,
          id: 'system_general',
          subItems: [
            {
              label: 'Frame settings',
              href: '/admin/global-settings/frame-settings',
            },
            {
              label: 'Links settings',
              id: 'system_links_settings',
              hasSubmenu: true,
              subItems: [
                {
                  label: 'Athletes',
                  href: '/admin/global-settings#',
                },
                {
                  label: 'Coaches',
                  href: '/admin/global-settings#',
                },
                {
                  label: 'Teams',
                  href: '/admin/global-settings#',
                },
                {
                  label: 'Groups',
                  href: '/admin/global-settings#',
                },
                {
                  label: 'Clubs',
                  href: '/admin/global-settings#',
                },
                {
                  label: 'Store',
                  href: '/admin/global-settings#',
                },
                {
                  label: 'Buy-sell',
                  href: '/admin/global-settings#',
                },
                {
                  label: 'Job offers',
                  href: '/admin/global-settings#',
                },
                {
                  label: 'Central frame',
                  href: '/admin/global-settings#',
                },
                {
                  label: 'IPAD',
                  href: '/admin/global-settings#',
                },
                {
                  label: 'iPhone',
                  href: '/admin/global-settings#',
                },
                {
                  label: 'Android',
                  href: '/admin/global-settings#',
                },
                {
                  label: 'Smartwatch',
                  href: '/admin/global-settings#',
                },
                {
                  label: 'Touch Mode',
                  href: '/admin/global-settings#',
                },
                {
                  label: 'Screen Optimized',
                  href: '/admin/global-settings#',
                },
                {
                  label: 'Fast Workout Tracking',
                  href: '/admin/global-settings#',
                },
                {
                  label: 'Workout Player',
                  href: '/admin/global-settings#',
                },
                {
                  label: 'Mobile Version',
                  href: '/admin/global-settings#',
                },
                {
                  label: 'Cloud Storage',
                  href: '/admin/global-settings#',
                },
              ],
            },
            {
              label: 'Sponsors Settings',
              href: '/admin/global-settings/sponsor-settings',
            },
          ],
        },
        { 
          label: 'Top Banner', 
          icon: LayoutTemplate, 
          hasSubmenu: true,
          id: 'system_topbanner',
          subItems: [
            { label: 'Why Movesbook', href: '/admin/global-settings/why-movesbook' },
            { label: 'Newsletters', href: '/admin/global-settings/newsletters' },
            { label: 'References', href: '/admin/global-settings/newsletters' },
            { label: 'About us', href: '/admin/global-settings/about-us' },
            { label: 'Product infos', href: '/admin/global-settings/newsletters' }
          ]
        },
        { 
          label: 'Main banner', 
          icon: Image, 
          hasSubmenu: true,
          id: 'system_mainbanner',
          subItems: [
            { label: 'Banner Tours', href: '/admin/global-settings/banner-tours' },
            { label: 'Sport banners', href: '/admin/global-settings/sport-banners' }
          ]
        }
      ]
    },
    {
      id: 'messages',
      label: 'Messages for users',
      items: [
        { 
          label: 'Messages auto', 
          icon: MessageSquare, 
          hasSubmenu: true,
          id: 'msg_auto',
          subItems: [
            { label: 'Messages at the login' },
            { label: 'Messages at the logout' },
            { label: 'After purchase ID cards' }
          ]
        },
        { 
          label: 'Mail auto', 
          icon: Mail, 
          hasSubmenu: true,
          id: 'mail_auto',
          subItems: [
            { label: 'Confirm activation' },
            { label: 'Invoice sending' }
          ]
        },
        {
          label: 'Info pressing buttons',
          icon: HelpCircle,
          hasSubmenu: true,
          id: 'info_buttons',
          subItems: [
            { label: 'Info last releases' },
            { label: 'QR code info' }
          ]
        },
        {
          label: 'Invites',
          icon: Share2,
          hasSubmenu: true,
          id: 'invites',
          subItems: [
            { label: 'Invite friends content' },
            { label: 'Invite social content' }
          ]
        }
      ]
    },
    {
      id: 'infos',
      label: 'Infos & Help docs',
      items: [
        {
          label: 'Info for users',
          icon: FileText,
          hasSubmenu: true,
          id: 'info_users',
          subItems: [
            { label: 'Our standards' },
            { label: 'Info & Intro' },
            { label: 'YouTube Link' },
            { label: 'User manual' }, 
            { label: 'Tutorial video' },
            { label: 'FAQs' },
            { label: 'Info copyright' },
            { label: 'Revenues for the club' }
          ]
        },
        { label: 'Documents Linked to the Page', icon: FileText },
        { label: 'Help system', icon: HelpCircle }
      ]
    },
    {
      id: 'faqs',
      label: 'Management Of FAQS',
      items: [
        { label: 'Editor', icon: Edit },
        { label: 'Management of the FAQS', icon: Settings },
        { label: 'Display of the FAQS', icon: Monitor }
      ]
    },
    {
      id: 'html',
      label: 'HTML builder',
      items: [
        {
          label: 'for Movebook users',
          icon: Globe,
          hasSubmenu: true,
          id: 'html_users',
          subItems: [
            { label: 'Document editor' },
            { label: 'Index for HTMLs' },
            { label: 'Processes for HTMLs' },
            { label: 'Displayed in mainpage' },
            { label: 'Items linked in mainpage' }
          ]
        },
        {
          label: 'Edited by Clubs',
          icon: Briefcase,
          hasSubmenu: true,
          id: 'html_clubs',
          subItems: [
            { label: 'Documents to mail' },
            { label: 'News of the club' }
          ]
        }
      ]
    },
    {
      id: 'promotions',
      label: 'Promotions',
      items: [
        { label: 'Catalog of products', icon: ShoppingCart },
        { label: 'Promocode subscriptions', icon: Gift, href: '/promocodes' },
        {
          label: 'Sponsors',
          icon: Star,
          hasSubmenu: true,
          id: 'promo_sponsors',
          subItems: [
            { label: 'Sponsors in Mainpage', href: '/admin/global-settings/sponsor-main' },
            { label: 'Investors of ads plans' }
          ]
        },
        {
          label: 'Advertisings',
          icon: Monitor,
          hasSubmenu: true,
          id: 'promo_ads',
          subItems: [
            { label: 'Price list setting' },
            { label: 'Ad plans purchased' },
            { label: 'Ad spaces for clubs' }
          ]
        }
      ]
    },
    {
      id: 'settings_users',
      label: 'Settings for users',
      items: [
        { label: 'Single users', icon: User, href: '/subscriptions/subscription_settings?userType=athlete' },
        { label: 'Coaches', icon: User, href: '/subscriptions/subscription_settings?userType=coach' },
        { label: 'Teams', icon: Users, href: '/subscriptions/subscription_settings?userType=team' },
        { label: 'Groups', icon: Users, href: '/subscriptions/subscription_settings?userType=group' },
        { label: 'Clubs', icon: Briefcase, href: '/subscriptions/subscription_settings?userType=club' }
      ]
    },
    {
      id: 'technical',
      label: 'Technical settings',
      items: [
        { label: 'Periods', href: '/settings?section=tools&tab=periods' },
        { label: 'Workout Sections', href: '/settings?section=tools&tab=sections' },
        { label: 'Execution techniques', href: '/settings?section=tools&tab=bodyBuildingTechniques' },
        { label: 'Equipment factories', href: '/settings?section=technical&tab=equipmentFactories' },
        { label: 'Muscle Settings', href: '/settings?section=technical&tab=muscles' },
        { label: 'Gym machines', href: '/settings?section=technical&tab=sportMachines' },
        { label: 'Exercise bank', href: '/settings?section=technical&tab=exercises' },
        { label: 'My library of exercises', href: '/settings?section=technical&tab=myLibrary' },
        { label: 'Sport devices enabled', href: '/settings?section=technical&tab=devices' },
        {
          label: 'Types of common daily settings',
          href: '/settings?section=tools&tab=commonDailyActions'
        },
        {
          label: 'Dropdown parameters for sport',
          href: '/settings?section=tools&tab=sportDropdownParameters'
        },
        {
          label: 'Parameters for calc workouts',
          hasSubmenu: true,
          id: 'workout_calc_params',
          subItems: [
            { label: 'Changes in the volume series', href: '/settings?section=workoutParameters&workoutTab=changesVolumesSeries' },
            { label: 'Parameters for each objective', href: '/settings?section=workoutParameters&workoutTab=parametersByObjective' }
          ]
        }
      ]
    },
    {
      id: 'general',
      label: 'General settings',
      items: [
        { label: 'User types' },
        { 
          label: 'Sports', 
          hasSubmenu: true,
          id: 'gen_sports',
          subItems: [
            { label: 'List of the sports' },
            { label: 'Workouts icons' },
            { label: 'Sports banners' }
          ]
        },
        {
          label: 'Activities for users',
          hasSubmenu: true,
          id: 'gen_activities',
          subItems: [
            { label: 'Activities for the user profile' },
            { label: 'Activities for the clubs' }
          ]
        },
        { label: 'Foods And Dishes', icon: Utensils, href: '/admin/global-settings?panel=foods-and-dishes' },
        { label: 'Path for social buttons', icon: Share2 }
      ]
    },
    {
      id: 'management',
      label: 'Management section',
      items: [
        { label: 'Club management info' },
        {
          label: 'Management',
          hasSubmenu: true,
          id: 'mgmt_main',
          subItems: [
            { label: 'Club password requests' },
            { label: 'Enablings management' },
            { label: 'Set functions enabled' },
            { label: 'Access control audio setting', href: '/admin/access-audio-settings' },
            { label: 'Defaultsettings' }
          ]
        },
        { label: 'Help support', icon: HelpCircle }
      ]
    },
    {
      id: 'apps',
      label: 'Movesbook Apps',
      items: [
        { label: 'Subscription setting' },
        { label: 'Html editor for app' },
        { label: 'Terms & Conditions' },
        { label: 'Policy & Privacy' },
        { label: 'Preferences' },
        { label: 'Partners' }
      ]
    },
    {
      id: 'countries',
      label: 'Countries & Languages',
      items: [
        { label: 'Countries settings', icon: Flag, href: '/countries' },
        {
          label: 'Languages',
          icon: Languages,
          hasSubmenu: true,
          id: 'lang_main',
          subItems: [
            { label: 'Set official languages' },
            { label: 'Languages settings' },
            { label: 'Languages long texts' }
          ]
        }
      ]
    },
    {
      id: 'operative',
      label: 'Operative Tools',
      items: [
        { label: 'Back Office', icon: Database },
        { label: 'CK Editor plugin' },
        { label: 'CK-Finder media folder' },
        { label: 'Newsletters editor' },
        { label: 'Assistance with chat service' }
      ]
    },
    {
      id: 'passwords',
      label: 'Passwords of access',
      items: [
        { label: 'S-Admin passwod', icon: Key },
        { label: 'Passwords Help & Language' },
        { label: 'Passwords other sections' }
      ]
    },
    {
      id: 'other',
      label: 'Other items',
      items: [
        { label: 'Back to S-Admin page', icon: User },
        { label: 'Deletions', icon: Trash2 },
        { label: 'Log out & Exit', icon: LogOut }
      ]
    }
  ]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const {active, over} = event;
    
    if (active.id !== over?.id) {
      setSidebarData((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over?.id);
        
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const SidebarItem = ({ 
    item, 
    level = 0,
    onClick 
  }: { 
    item: SidebarItemType, 
    level?: number,
    onClick?: () => void 
  }) => {
    const Icon = item.icon || ChevronRight;
    const isOpen = item.id ? openSubSections[item.id] : false;
    const hasSubmenu = item.hasSubmenu && item.subItems && item.subItems.length > 0;
    const isLevel0 = level === 0;

    // Different styling based on nesting level
    const paddingLeft = isLevel0 ? '45px' : `${45 + (level * 20)}px`;
    const iconLeft = isLevel0 ? '8px' : `${8 + (level * 20)}px`;
    const isActive =
      item.href &&
      isSubscriptionRoute &&
      (item.href === '/subscriptions/subscription_settings'
        ? pathname === '/subscriptions/subscription_settings' && !subscriptionUserType
        : item.href.startsWith('/subscriptions/subscription_settings?userType=')
          ? subscriptionUserType === new URL(item.href, 'http://local').searchParams.get('userType')
          : item.href.startsWith('/subscriptions/function_settings')
            ? Boolean(
                pathname?.startsWith('/subscriptions/function_settings') ||
                  pathname?.startsWith('/subscriptions/function_training_settings') ||
                  pathname?.startsWith('/subscriptions/function_settings_mang'),
              )
            : item.href.startsWith('/subscriptions/package/')
              ? pathname?.startsWith('/subscriptions/package/')
              : false);
    const bgClass = isActive
      ? 'bg-[#008080] hover:bg-[#009090]'
      : isLevel0
        ? 'bg-[#4e4e4e] hover:bg-[#5e5e5e]'
        : 'bg-[#333] hover:bg-[#444]';
    
    return (
      <div className="mb-[1px]">
        <Link 
          href={item.href || "#"} 
          onClick={(e) => {
            if (!item.href || hasSubmenu) e.preventDefault();
            if (hasSubmenu && item.id) {
              toggleSubSection(item.id);
            }
            if (onClick && !hasSubmenu) onClick();
          }}
          className={`relative block py-[10px] pr-0 border border-[#7f7f7f] text-white transition-colors ${bgClass}`}
          style={{ paddingLeft }}
        >
          <div
            className="absolute top-1/2 -translate-y-1/2 w-[24px] flex items-center justify-center"
            style={{ left: iconLeft }}
          >
            <Icon className="w-5 h-5 text-white" />
          </div>
          <span className="text-[13px] font-bold text-white flex items-center gap-1">
            {item.label}
            {item.hasLock && <Lock className="w-3 h-3 text-white ml-1" />}
          </span>
          {hasSubmenu && (
            <div className="absolute right-[13px] top-1/2 -translate-y-1/2 flex items-center">
              <Triangle className={`w-3 h-3 text-white fill-white transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>
          )}
        </Link>
        
        {/* Render submenu if open */}
        {hasSubmenu && isOpen && (
          <div className="">
            {item.subItems!.map((subItem, idx) => (
              <SidebarItem key={idx} item={subItem} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`relative h-full flex-shrink-0 transition-all duration-300 ${isSidebarOpen ? 'w-[280px]' : 'w-0'}`}>
      <div className={`w-[280px] flex-shrink-0 bg-[#2b2b2b] pb-1 min-h-screen overflow-y-auto ${!isSidebarOpen && 'hidden'}`}>
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext 
            items={sidebarData.map(item => item.id)}
            strategy={verticalListSortingStrategy}
          >
            {sidebarData.map((section) => (
              <SortableItem key={section.id} id={section.id}>
                <div className="mb-[1px] bg-[#2b2b2b]">
                  <h4 className="m-0 bg-[#004040] relative">
                    <a 
                      href="#" 
                      onClick={(e) => { e.preventDefault(); toggleSection(section.id); }}
                      className="block py-[10px] px-[35px] pl-[45px] text-white font-bold text-[15px] cursor-move"
                    >
                      <span className="absolute left-[10px] top-[8px] w-[22px]">
                        <Tag className="w-5 h-5 text-white" />
                      </span>
                      <span className="title">{section.label}</span>
                      <span className="absolute right-[13px] top-[8px]">
                        <ChevronDown className={`w-4 h-4 text-white transition-transform ${!openSections[section.id] ? '-rotate-90' : ''}`} />
                      </span>
                    </a>
                  </h4>
                  
                  {openSections[section.id] && (
                    <div className="p-[10px]">
                      {section.items.map((item, idx) => (
                        <SidebarItem key={idx} item={item} />
                      ))}
                    </div>
                  )}
                </div>
              </SortableItem>
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
};

export default function SystemDashboardSidebar(props: SystemDashboardSidebarProps) {
  return (
    <React.Suspense fallback={<div className="w-64 shrink-0 bg-gray-100" />}>
      <SystemDashboardSidebarContent {...props} />
    </React.Suspense>
  );
}

